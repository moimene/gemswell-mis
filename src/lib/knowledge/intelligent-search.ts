import OpenAI from 'openai'
import type { SupabaseClient } from '@supabase/supabase-js'
import { retrieveDocuments, type RankedRetrievedChunk } from '@/lib/rag/retrieve'
import { LIST_COLUMNS } from '@/lib/knowledge/documents-query'
import { DOC_TYPES, PROJECT_IDS, type DocType, type ProjectId } from '@/lib/knowledge/contracts'
import { openAIErrorSummary } from '@/lib/openai-error'

const SMART_SEARCH_MODEL = process.env.DOCUMENT_SMART_SEARCH_MODEL || process.env.OPENAI_CHAT_MODEL || 'gpt-5.5'
const MODEL_ENABLED = process.env.DOCUMENT_SMART_SEARCH_MODEL_ENABLED !== 'false'
const CACHE_TTL_MS = Number(process.env.DOCUMENT_SMART_SEARCH_CACHE_TTL_MS || '300000')
const CACHE_MAX_ENTRIES = Number(process.env.DOCUMENT_SMART_SEARCH_CACHE_MAX || '80')

export type SmartDocumentSearchFilters = {
  project?: string | null
  doc_type?: string | null
  review_status?: string | null
  authority_min?: number | null
  channel?: string | null
  includeRetired?: boolean
  onlyNoMarkdown?: boolean
  onlyErrors?: boolean
}

export type SmartDocumentSearchOptions = {
  query: string
  filters?: SmartDocumentSearchFilters
  limit?: number
  modelEnabled?: boolean
  cacheEnabled?: boolean
  reranker?: SmartDocumentReranker
}

export type SmartSearchSnippet = {
  chunk_id: string
  chunk_index: number | null
  text: string
  relevance: number
}

export type SmartSearchEntity = {
  kind: 'bank' | 'amount' | 'date' | 'project' | 'document_role'
  value: string
}

export type SmartDocumentSearchResult = {
  id: string
  title: string | null
  project_id: string | null
  doc_type: string | null
  period: string | null
  review_status: string
  authority_score: number | null
  authority_tier: string | null
  classification_source: string
  status: string
  source_channel: string | null
  chunk_count: number | null
  summary: string | null
  md_path: string | null
  smart_score: number
  smart_reason: string
  smart_role: string
  smart_entities: SmartSearchEntity[]
  smart_snippets: SmartSearchSnippet[]
}

export type SmartDocumentSearchResponse = {
  items: SmartDocumentSearchResult[]
  total: number
  query: string
  degraded: boolean
  retrievalIncomplete: boolean
  graphUsed: boolean
  graphEntities: string[]
  modelRerankUsed: boolean
  modelUsed: boolean
  model: string | null
  cacheHit: boolean
}

export type SmartDocumentReranker = (
  input: { query: string; candidates: SmartDocumentSearchResult[] }
) => Promise<Array<{ id: string; score?: number; reason?: string; role?: string }>>

type DocumentRow = Omit<SmartDocumentSearchResult, 'smart_score' | 'smart_reason' | 'smart_role' | 'smart_entities' | 'smart_snippets'>
type CachedSmartSearch = { expiresAt: number; value: SmartDocumentSearchResponse }
const smartSearchCache = new Map<string, CachedSmartSearch>()

function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, value))
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function docTypeFilter(value: string | null | undefined): DocType | null {
  return value && (DOC_TYPES as readonly string[]).includes(value) ? value as DocType : null
}

function projectFilter(value: string | null | undefined): ProjectId | null {
  return value && (PROJECT_IDS as readonly string[]).includes(value) ? value as ProjectId : null
}

function safeSnippet(content: string): string {
  return content.replace(/\s+/g, ' ').trim().slice(0, 420)
}

function normalise(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function snippetRank(query: string, snippet: SmartSearchSnippet): number {
  const text = normalise(snippet.text)
  const tokens = Array.from(new Set(normalise(query).split(/[^a-z0-9]+/).filter((token) => token.length >= 4)))
  const coverage = tokens.filter((token) => text.includes(token)).length * 0.04
  const financeCoverage = [
    /euribor/.test(text),
    /margen/.test(text),
    /tipo de interes/.test(text),
    /15[.,]657[.,]498/.test(text),
    /31[.,]000[.,]000/.test(text),
    /disposicion/.test(text),
    /importe maximo/.test(text),
  ].filter(Boolean).length * 0.09
  return snippet.relevance + coverage + financeCoverage
}

function addEntity(entities: SmartSearchEntity[], kind: SmartSearchEntity['kind'], value: string) {
  const cleaned = value.replace(/\s+/g, ' ').trim()
  if (!cleaned) return
  if (!entities.some((entity) => entity.kind === kind && entity.value.toLowerCase() === cleaned.toLowerCase())) {
    entities.push({ kind, value: cleaned })
  }
}

export function extractSmartEntities(text: string, fallbackRole?: string): SmartSearchEntity[] {
  const entities: SmartSearchEntity[] = []
  const haystack = text.replace(/\s+/g, ' ')
  const lower = haystack.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

  if (/santander/.test(lower)) addEntity(entities, 'bank', 'Banco Santander')
  if (/bbva|bilbao vizcaya/.test(lower)) addEntity(entities, 'bank', 'BBVA')
  if (/caixabank/.test(lower)) addEntity(entities, 'bank', 'CaixaBank')
  if (/buenavista/.test(lower)) addEntity(entities, 'bank', 'Buenavista')

  for (const project of PROJECT_IDS) {
    if (new RegExp(`\\b${project.toLowerCase()}\\b`).test(lower)) addEntity(entities, 'project', project)
  }
  if (/madrid playa surf|playa surf|\bmps\b/.test(lower)) addEntity(entities, 'project', 'MAD')
  if (/birmingham|wave park|warwickshire|\bbhx\b/.test(lower)) addEntity(entities, 'project', 'BHX')

  const amountRe = /\b\d{1,3}(?:[.,]\d{3})+(?:,\d{2})?\s*(?:€|eur|euros?)/gi
  for (const match of haystack.matchAll(amountRe)) addEntity(entities, 'amount', match[0])
  const dateRe = /\b(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{1,2}\s+de\s+[a-záéíóúñ]+\s+de\s+\d{4})\b/gi
  for (const match of haystack.matchAll(dateRe)) addEntity(entities, 'date', match[0])

  if (/contrato de financiaci|loan agreement|credito participativo|cr[eé]dito participativo/.test(lower)) addEntity(entities, 'document_role', 'contrato')
  if (/pacto de socios|shareholders agreement/.test(lower)) addEntity(entities, 'document_role', 'pacto de socios')
  if (/junta|consejo|acta|board|shareholder/.test(lower)) addEntity(entities, 'document_role', 'acta')
  if (/mandato|term sheet|carta/.test(lower)) addEntity(entities, 'document_role', 'carta/mandato')
  if (/business plan|bp model|modelo financiero|reporting model/.test(lower)) addEntity(entities, 'document_role', 'modelo')
  if (fallbackRole) addEntity(entities, 'document_role', fallbackRole)

  return entities.slice(0, 12)
}

function reasonFor(result: SmartDocumentSearchResult, query: string): string {
  const bits = [
    result.project_id,
    result.doc_type,
    result.review_status === 'approved' ? 'aprobado' : result.review_status,
    result.authority_score != null ? `auth ${result.authority_score}` : null,
  ].filter(Boolean).join(' · ')
  const snippet = result.smart_snippets[0]?.text
  return snippet
    ? `Coincide con "${query}" en contenido indexado (${bits}). Fragmento: ${snippet.slice(0, 180)}`
    : `Coincide con "${query}" en contenido indexado (${bits}).`
}

function roleFor(docType: string | null): string {
  if (docType === 'funding') return 'financiacion'
  if (docType === 'board') return 'acta/acuerdo'
  if (docType === 'legal') return 'legal'
  if (docType === 'financial_statements' || docType === 'annual_accounts') return 'cuentas/estados financieros'
  if (docType === 'bp_model') return 'modelo financiero'
  return 'documento'
}

export function aggregateSmartDocumentResults(
  chunks: RankedRetrievedChunk[],
  docs: DocumentRow[],
  query: string,
  limit = 12,
): SmartDocumentSearchResult[] {
  const docById = new Map(docs.map((doc) => [doc.id, doc]))
  const grouped = new Map<string, SmartDocumentSearchResult>()

  for (const chunk of chunks) {
    const doc = docById.get(chunk.document_id)
    if (!doc) continue
    const existing = grouped.get(doc.id)
    const authorityBoost = clamp((doc.authority_score ?? 0) / 100, 0, 1) * 0.12
    const reviewBoost = doc.review_status === 'approved' ? 0.08 : doc.review_status === 'needs_review' ? -0.04 : 0
    const score = clamp(chunk.relevanceScore + authorityBoost + reviewBoost, 0, 1.5)
    const snippet: SmartSearchSnippet = {
      chunk_id: chunk.id,
      chunk_index: asNumber(chunk.metadata?.chunk_index) ?? asNumber((chunk as unknown as { chunk_index?: unknown }).chunk_index),
      text: safeSnippet(chunk.content),
      relevance: clamp(chunk.relevanceScore),
    }

    if (!existing) {
      grouped.set(doc.id, {
        ...doc,
        smart_score: score,
        smart_reason: '',
        smart_role: roleFor(doc.doc_type),
        smart_entities: [],
        smart_snippets: [snippet],
      })
    } else {
      existing.smart_score = Math.max(existing.smart_score, score)
      if (!existing.smart_snippets.some((s) => s.chunk_id === snippet.chunk_id)) {
        existing.smart_snippets.push(snippet)
        existing.smart_snippets.sort((a, b) => snippetRank(query, b) - snippetRank(query, a))
        existing.smart_snippets = existing.smart_snippets.slice(0, 5)
      }
    }
  }

  return Array.from(grouped.values())
    .map((result) => ({
      ...result,
      smart_entities: extractSmartEntities([
        query,
        result.title,
        result.project_id,
        result.doc_type,
        result.smart_role,
        result.smart_snippets.map((snippet) => snippet.text).join(' '),
      ].filter(Boolean).join(' '), result.smart_role),
      smart_reason: reasonFor(result, query),
    }))
    .sort((a, b) => b.smart_score - a.smart_score)
    .slice(0, limit)
}

function parseModelJson(text: string): Array<{ id: string; score?: number; reason?: string; role?: string }> {
  const cleaned = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim()
  const parsed = JSON.parse(cleaned) as unknown
  const rows = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object' && Array.isArray((parsed as { results?: unknown }).results)
      ? (parsed as { results: unknown[] }).results
      : []
  return rows
    .filter((row): row is Record<string, unknown> => !!row && typeof row === 'object')
    .map((row) => ({
      id: String(row.id ?? ''),
      score: typeof row.score === 'number' ? row.score : undefined,
      reason: asString(row.reason) ?? undefined,
      role: asString(row.role) ?? undefined,
    }))
    .filter((row) => row.id)
}

export async function rerankSmartDocumentsWithOpenAI(
  { query, candidates }: { query: string; candidates: SmartDocumentSearchResult[] },
): Promise<Array<{ id: string; score?: number; reason?: string; role?: string }>> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey || !MODEL_ENABLED || candidates.length === 0) return []
  const client = new OpenAI({ apiKey })
  const payload = candidates.slice(0, 20).map((candidate) => ({
    id: candidate.id,
    title: candidate.title,
    project_id: candidate.project_id,
    doc_type: candidate.doc_type,
    review_status: candidate.review_status,
    authority_score: candidate.authority_score,
    snippets: candidate.smart_snippets.map((snippet) => snippet.text),
  }))
  const response = await client.responses.create({
    model: SMART_SEARCH_MODEL,
    store: false,
    max_output_tokens: 1600,
    instructions: [
      'Eres un reranker de búsqueda documental para un gestor documental.',
      'No respondas a la pregunta del usuario. Ordena documentos por utilidad para encontrar la fuente.',
      'Usa solo los metadatos y snippets proporcionados.',
      'Devuelve JSON válido: {"results":[{"id":"...","score":0.0-1.0,"role":"contrato|acta|modelo|carta|otro","reason":"frase breve en español"}]}.',
    ].join('\n'),
    input: JSON.stringify({ query, candidates: payload }),
  })
  return parseModelJson(response.output_text ?? '')
}

function applyModelRerank(
  candidates: SmartDocumentSearchResult[],
  modelRows: Array<{ id: string; score?: number; reason?: string; role?: string }>,
): SmartDocumentSearchResult[] {
  if (modelRows.length === 0) return candidates
  const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]))
  const seen = new Set<string>()
  const ranked: SmartDocumentSearchResult[] = []

  for (const row of modelRows) {
    const candidate = byId.get(row.id)
    if (!candidate || seen.has(row.id)) continue
    seen.add(row.id)
    ranked.push({
      ...candidate,
      smart_score: row.score != null ? clamp(row.score) : candidate.smart_score,
      smart_reason: row.reason ?? candidate.smart_reason,
      smart_role: row.role ?? candidate.smart_role,
      smart_entities: extractSmartEntities([
        candidate.title,
        row.role ?? candidate.smart_role,
        candidate.smart_entities.map((entity) => entity.value).join(' '),
        candidate.smart_snippets.map((snippet) => snippet.text).join(' '),
      ].filter(Boolean).join(' '), row.role ?? candidate.smart_role),
    })
  }
  for (const candidate of candidates) {
    if (!seen.has(candidate.id)) ranked.push(candidate)
  }
  return ranked.sort((a, b) => b.smart_score - a.smart_score)
}

function cacheKey(opts: {
  query: string
  filters: SmartDocumentSearchFilters
  limit: number
  modelEnabled: boolean
}): string {
  return JSON.stringify({
    query: opts.query.trim().toLowerCase(),
    filters: {
      project: opts.filters.project ?? null,
      doc_type: opts.filters.doc_type ?? null,
      review_status: opts.filters.review_status ?? null,
      authority_min: opts.filters.authority_min ?? null,
      channel: opts.filters.channel ?? null,
      includeRetired: Boolean(opts.filters.includeRetired),
      onlyNoMarkdown: Boolean(opts.filters.onlyNoMarkdown),
      onlyErrors: Boolean(opts.filters.onlyErrors),
    },
    limit: opts.limit,
    modelEnabled: opts.modelEnabled,
  })
}

function getCachedSmartSearch(key: string): SmartDocumentSearchResponse | null {
  const hit = smartSearchCache.get(key)
  if (!hit) return null
  if (hit.expiresAt < Date.now()) {
    smartSearchCache.delete(key)
    return null
  }
  smartSearchCache.delete(key)
  smartSearchCache.set(key, hit)
  return { ...hit.value, cacheHit: true }
}

function setCachedSmartSearch(key: string, value: SmartDocumentSearchResponse) {
  if (!(CACHE_TTL_MS > 0) || !(CACHE_MAX_ENTRIES > 0)) return
  smartSearchCache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value: { ...value, cacheHit: false } })
  while (smartSearchCache.size > CACHE_MAX_ENTRIES) {
    const oldest = smartSearchCache.keys().next().value
    if (!oldest) break
    smartSearchCache.delete(oldest)
  }
}

async function fetchDocumentsByIds(supabase: SupabaseClient, ids: string[]): Promise<DocumentRow[]> {
  if (ids.length === 0) return []
  const { data, error } = await supabase
    .from('rag_documents')
    .select(LIST_COLUMNS)
    .in('id', ids)
  if (error) throw new Error(`smart document metadata lookup failed: ${error.message}`)
  return (data ?? []) as unknown as DocumentRow[]
}

function filterDocumentRows(rows: DocumentRow[], filters: SmartDocumentSearchFilters): DocumentRow[] {
  return rows.filter((row) => {
    if (filters.onlyErrors && row.status !== 'error') return false
    if (!filters.onlyErrors && !filters.includeRetired && row.status !== 'indexed') return false
    if (filters.review_status && row.review_status !== filters.review_status) return false
    if (filters.authority_min != null && (row.authority_score ?? 0) < filters.authority_min) return false
    if (filters.channel && row.source_channel !== filters.channel) return false
    if (filters.onlyNoMarkdown && row.md_path != null) return false
    return true
  })
}

export async function searchDocumentsIntelligently(
  supabase: SupabaseClient,
  opts: SmartDocumentSearchOptions,
): Promise<SmartDocumentSearchResponse> {
  const query = opts.query.trim()
  if (query.length < 3) {
    return {
      items: [],
      total: 0,
      query,
      degraded: false,
      retrievalIncomplete: false,
      graphUsed: false,
      graphEntities: [],
      modelRerankUsed: false,
      modelUsed: false,
      model: null,
      cacheHit: false,
    }
  }
  const filters = opts.filters ?? {}
  const project = projectFilter(filters.project)
  const docType = docTypeFilter(filters.doc_type)
  const limit = Math.min(Math.max(opts.limit ?? 12, 1), 25)
  const modelEnabled = opts.modelEnabled ?? true
  const useCache = opts.cacheEnabled ?? true
  const key = cacheKey({ query, filters, limit, modelEnabled })
  if (useCache) {
    const cached = getCachedSmartSearch(key)
    if (cached) return cached
  }

  const { ranked, diagnostics } = await retrieveDocuments(supabase, query, {
    projectFilter: project,
    docTypeFilter: docType,
    groundingMode: 'standard',
    modelRerank: modelEnabled,
  })
  const docs = filterDocumentRows(await fetchDocumentsByIds(supabase, ranked.map((chunk) => chunk.document_id)), filters)
  let items = aggregateSmartDocumentResults(ranked, docs, query, limit)

  let modelUsed = false
  if (modelEnabled) {
    const reranker = opts.reranker ?? rerankSmartDocumentsWithOpenAI
    try {
      const modelRows = await reranker({ query, candidates: items })
      modelUsed = modelRows.length > 0
      items = applyModelRerank(items, modelRows).slice(0, limit)
    } catch (err) {
      console.warn('[intelligent-search] model rerank failed, using deterministic ranking:', openAIErrorSummary(err))
    }
  }

  const response = {
    items,
    total: items.length,
    query,
    degraded: diagnostics.degraded,
    retrievalIncomplete: diagnostics.vectorFailed || diagnostics.keywordFailed,
    graphUsed: diagnostics.graphCount > 0,
    graphEntities: diagnostics.graphEntities,
    modelRerankUsed: diagnostics.modelRerankUsed,
    modelUsed,
    model: modelUsed ? SMART_SEARCH_MODEL : null,
    cacheHit: false,
  }
  if (useCache) setCachedSmartSearch(key, response)
  return response
}
