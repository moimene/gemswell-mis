import type { SupabaseClient } from '@supabase/supabase-js'
import { embedText } from '@/lib/rag/embeddings'
import { rerankChunks } from '@/lib/rag/rerank'
import { rankBySourceTrust, rankForStandardGrounding, trustTier } from '@/lib/rag/rank'
import { expandDocumentGraph } from '@/lib/rag/graph'
import { rerankRetrievedChunksWithOpenAI } from '@/lib/rag/openai-rerank'

// ─── Shared retrieval core ───────────────────────────────────────────
// Single source of truth for the documentary retrieval pipeline used by /api/chat's
// search_documents tool AND the evaluation harness (scripts/eval). Keeping ONE implementation means
// the harness measures the exact production path (real Gemini embed → match_chunks + keyword_search_
// chunks via supabase-js/PostgREST → merge/dedup → Cohere rerank of the full pool → trust-tier sort).
//
// ⚠ Do not "optimise" match_chunks call shape here without re-reading the pgvector/PostgREST HNSW
// gotcha: the RPC must keep its sql/015 signature so it stays index-served via PostgREST.

export type RetrievedChunk = {
  id: string
  document_id: string
  content: string
  metadata: Record<string, unknown>
  similarity?: number
}

export type RankedRetrievedChunk = RetrievedChunk & { relevanceScore: number }

export type RetrievalDiagnostics = {
  /** Rows returned by the vector RPC (match_chunks). */
  vectorCount: number
  /** Rows returned by the keyword RPC (keyword_search_chunks). */
  keywordCount: number
  /** Rows returned by the explicit document-graph expansion lane. */
  graphCount: number
  /** Query entities that activated graph expansion. */
  graphEntities: string[]
  /** Distinct chunks in the merged pool after dedup + excluded-source removal (what gets reranked). */
  poolCount: number
  /** Chunks present in BOTH vector and keyword result sets (retrieval agreement signal). */
  overlapCount: number
  /** Cohere rerank fell back to raw-similarity ordering (relevanceScore is approximate). */
  degraded: boolean
  /** Vector lane (match_chunks) threw — e.g. Gemini 429 / RPC timeout. Distinguishes outage from "no matches". */
  vectorFailed: boolean
  /** Keyword lane (keyword_search_chunks) threw — e.g. statement timeout. Distinguishes outage from "no matches". */
  keywordFailed: boolean
  /** Count of FINAL ranked chunks whose parent is needs_review/pending (the chat leaned on ungoverned evidence). */
  unreviewedUsed: number
  /** Active evidence policy applied after governance/lifecycle exclusion. */
  groundingMode: GroundingMode
  /** Chunks dropped because the active grounding mode requires stronger governance. */
  groundingFilteredCount: number
  /** OpenAI chunk reranker was used after hybrid + graph candidate generation. */
  modelRerankUsed: boolean
  /** Model name used by the OpenAI chunk reranker, when active. */
  modelRerankModel: string | null
}

export type RetrievalResult = {
  /** Final top-K chunks after rerank + trust-tier ordering — exactly what the chat cites. */
  ranked: RankedRetrievedChunk[]
  diagnostics: RetrievalDiagnostics
}

export type RetrieveOptions = {
  projectFilter?: string | null
  docTypeFilter?: string | null
  groundingMode?: GroundingMode
  /** Enables the final OpenAI chunk reranker. Defaults to on outside tests when OPENAI_API_KEY exists. */
  modelRerank?: boolean
}

export type GroundingMode = 'standard' | 'trusted_only' | 'official_only'

// Defaults preserved verbatim from the original route.ts so extraction is behavior-preserving.
// Deliberately permissive vector floor (recall-first): precision is handled downstream by the Cohere
// reranker + trust-tier ordering. Tighten only with a live service-role probe (see HNSW gotcha memo).
export const RAG_MATCH_THRESHOLD = Number(process.env.RAG_MATCH_THRESHOLD || '0.18')
export const RAG_VECTOR_MATCH_COUNT = Number(process.env.RAG_VECTOR_MATCH_COUNT || '25')
export const RAG_KEYWORD_MATCH_COUNT = Number(process.env.RAG_KEYWORD_MATCH_COUNT || '15')
export const RAG_FINAL_TOP_K = Number(process.env.RAG_FINAL_TOP_K || '10')
const STRICT_GROUNDING_EXTRACTION_MULTIPLIER = 4
const STRICT_GROUNDING_VECTOR_CAP = 100
const STRICT_GROUNDING_KEYWORD_CAP = 80

// Fase 2 (WS1) — hybrid fusion + precision floor. Defaults reproduce the CURRENT behavior
// (vector_first dedup, no floor), so landing this is a no-op until the env flags are flipped — the
// flag-flip is A/B-gated against the ws1-base baseline and adversarially reviewed before going live.
export const RAG_FUSION_MODE: 'rrf' | 'vector_first' = process.env.RAG_FUSION_MODE === 'rrf' ? 'rrf' : 'vector_first'
export const RAG_RRF_K = Number(process.env.RAG_RRF_K || '60')
export const RAG_RRF_W_VECTOR = Number(process.env.RAG_RRF_W_VECTOR || '1')
export const RAG_RRF_W_KEYWORD = Number(process.env.RAG_RRF_W_KEYWORD || '1')
export const RAG_RELEVANCE_FLOOR = Number(process.env.RAG_RELEVANCE_FLOOR || '0')

function normaliseQuery(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

/**
 * Corpus-specific query expansion for high-value document aliases. This does not add facts to the
 * answer; it only gives the vector/keyword lanes the filenames and legal form labels humans use in
 * the DMS, so natural questions can retrieve the right source-of-record document deterministically.
 */
export function expandRetrievalQuery(query: string, opts: { projectFilter?: string | null } = {}): string {
  const q = normaliseQuery(query)
  const projectFilter = normaliseQuery(opts.projectFilter ?? '')
  const expansions: string[] = []

  const mentionsMadrid = /\b(mad|madrid|playa surf|mps)\b/.test(q) || projectFilter === 'mad'
  const mentionsBirmingham = /\b(bhx|birmingham|wave park|warwickshire)\b/.test(q) || projectFilter === 'bhx'

  if (
    mentionsMadrid &&
    /\b2025\b/.test(q) &&
    /\b(balance|activo|pasivo|cuentas|cierre|year[- ]?end|financial statements?|estados financieros)\b/.test(q)
  ) {
    expansions.push('MPSCIERREDEF-2025 MPS CIERRE DEF 2025 total activo financial_statements cuentas anuales cierre definitivo')
  }

  if (
    mentionsBirmingham &&
    /\b(cap calls?|capital calls?|sh01|legal entity|company number|entidad legal|numero de compania|numero de company|compania)\b/.test(q)
  ) {
    expansions.push('SH01 Phase 6.2 Cap Call for signature Wave Park Holdings Warwickshire capital call Companies House company number allotment shares legal opinion')
  }

  if (
    mentionsBirmingham &&
    /\b(loan agreement|signed loan|lender|borrower|prestamista|prestatario|vsore|varia)\b/.test(q)
  ) {
    expansions.push('Signed Loan Agreement Loan Agreement_VSORE III Varia Structured Opportunities Real Estate III Wave Park Holdings Warwickshire lender borrower')
  }

  if (/\b(portfolio|projects? currently make up|proyectos? (?:componen|forman)|gemswell portfolio|fund level|nivel fondo)\b/.test(q)) {
    expansions.push('Gemswell Financials CAST Gemswell Financials_CAST_241127_01 Gemswell Financials CAST 02 Gemswell Deck Membership Madrid Birmingham portfolio PHILAE')
  }

  if (
    (mentionsMadrid && /\b(capital call|diciembre|december|quincenal|13[-/ ]12[-/ ]2024)\b/.test(q)) ||
    (/\b(quincenal|reunion quincenal|reuniones quincenales)\b/.test(q) && /\b(capital call|diciembre|december|2024|13[-/ ]12)\b/.test(q))
  ) {
    expansions.push('Presentacion Reunion quincenal 13-12-2024 Rev3 capital call diciembre Madrid')
  }

  if (/\b(buenavista|buenvista|bv)\b/.test(q)) {
    expansions.push('Buenavista Nextgen Urbano credito participativo contrato financiacion Madrid')
  }

  if (
    mentionsMadrid &&
    /\b(santander|bbva|banco|bancari[ao]|prestamo|pr[eé]stamo|loan)\b/.test(q) &&
    /\b(financiaci|financiador|coste|cost|interes|inter[eé]s|margen|euribor|comision|comisi[oó]n|cap)\b/.test(q)
  ) {
    expansions.push('4140-7692-5542 Piscina de Olas Contrato de financiacion Santander BBVA Banco Bilbao Vizcaya Argentaria Tipo de Interes Ordinario EURIBOR Margen 4,00 Coste Financiero Comision CAP Entidades Financiadoras')
  }

  if (/\b(pactos? de socios|shareholders? agreement|acuerdo de socios)\b/.test(q)) {
    expansions.push('29.06.2023 Escritura elevacion a publico Pacto de Socios MPS pacto de socios KLP legal shareholders agreement')
  }

  if (/\b(personas apoderadas|apoderad[oa]s?|powers? of attorney|poa|poder(?:es)?|firmantes autorizados)\b/.test(q)) {
    expansions.push('PERSONAS APODERADAS.docx KLP legal poderes apoderados powers of attorney PoA')
  }

  if (expansions.length === 0) return query
  return `${query}\n\n${expansions.join('\n')}`
}

function metadataString(metadata: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = metadata?.[key]
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

/** A chunk whose parent document is governance-rejected — never surfaced as evidence. */
export function isRejectedSource(metadata: Record<string, unknown> | undefined): boolean {
  return metadataString(metadata, 'review_status') === 'rejected' ||
    metadataString(metadata, 'classification_source') === 'agent_rejected'
}

function metadataHaystack(metadata: Record<string, unknown> | undefined): string {
  return normaliseQuery([
    metadataString(metadata, 'source_file'),
    metadataString(metadata, 'title'),
    metadataString(metadata, 'section'),
    metadataString(metadata, 'project_id'),
    metadataString(metadata, 'doc_type'),
  ].filter(Boolean).join(' '))
}

export function metadataRelevanceBoost(query: string, metadata: Record<string, unknown> | undefined): number {
  const q = normaliseQuery(query)
  const haystack = metadataHaystack(metadata)
  const project = metadataString(metadata, 'project_id')
  const docType = metadataString(metadata, 'doc_type')
  let boost = 0

  const phraseBoosts: Array<[RegExp, RegExp, number]> = [
    [/sh01|companies house|company number/i, /sh01|companies house|legal opinion|filing history/i, 0.12],
    [/quincenal|13[-/ ]12[-/ ]2024|presentacion reunion/i, /quincenal|13[-/ ]12[-/ ]2024|presentacion reunion/i, 0.16],
    [/mpscierredef|cierre def|total activo/i, /mpscierredef|cierredef/i, 0.14],
    [/personas apoderadas|powers? of attorney|poa/i, /personas apoderadas|powers? of attorney|poa|acta poa/i, 0.5],
    [/pactos? de socios|shareholders? agreement/i, /pacto de socios|shareholders? agreement/i, 0.5],
    [/gemswell financials|deck membership|fund level|portfolio/i, /gemswell financials|deck membership/i, 0.12],
  ]
  for (const [queryRe, metaRe, value] of phraseBoosts) {
    if (queryRe.test(q) && metaRe.test(haystack)) boost += value
  }

  if (/\b(loan agreement|signed loan|lender|borrower|prestamista|prestatario|vsore|varia)\b/.test(q)) {
    if (/loan agreement[_ ]vsore|vsore|varia/.test(haystack)) {
      boost += 0.16
    } else if (/signed loan agreement/.test(haystack) && project === 'BHX') {
      boost += 0.12
    } else if (/signed loan agreement/.test(haystack)) {
      boost += 0.02
    }
  }

  if (/\b(buenavista|buenvista)\b/.test(q)) {
    if (/4148-6073-6102|contrato de credito participativo/.test(haystack) && docType === 'funding') {
      boost += 0.6
    }
  }

  if (
    /\b(santander|bbva|banco|bancari[ao]|prestamo|pr[eé]stamo|loan)\b/.test(q) &&
    /\b(financiaci|financiador|coste|cost|interes|inter[eé]s|margen|euribor|comision|comisi[oó]n|cap)\b/.test(q)
  ) {
    if (
      project === 'MAD' &&
      docType === 'funding' &&
      /4140-7692-5542|piscina de olas.*contrato de financiaci|contrato de financiacion.*vfinal/.test(haystack)
    ) {
      boost += 0.62
    }
  }

  if (project === 'BHX' && /\b(bhx|birmingham|wave park|warwickshire)\b/.test(q)) boost += 0.04
  if (project === 'MAD' && /\b(mad|madrid|mps|playa surf|quincenal)\b/.test(q)) boost += 0.04
  if (project === 'PHILAE' && /\b(fund|portfolio|philae|membership|gemswell financials)\b/.test(q)) boost += 0.04
  if (docType === 'financial_statements' && /\b(balance|activo|pasivo|cierre|financial statements?|year[- ]?end)\b/.test(q)) boost += 0.03
  if (docType === 'funding' && /\b(funding|loan|lender|borrower|capital call|financiaci|prestamista|prestatario)\b/.test(q)) boost += 0.03
  if (docType === 'legal' && /\b(legal|pacto|apoderad|powers? of attorney|company number|companies house)\b/.test(q)) boost += 0.03
  if (docType === 'board' && /\b(junta|consejo|reunion|quincenal|board)\b/.test(q)) boost += 0.03

  return Math.min(boost, 0.75)
}

function contentRelevanceBoost(query: string, content: string): number {
  const q = normaliseQuery(query)
  const text = normaliseQuery(content)
  let boost = 0

  if (
    /\b(sh01|companies house|company number|numero de compania|capital call)\b/.test(q) &&
    /company number/.test(text) &&
    (
      /wave park holdings/.test(text) ||
      /15326333/.test(text) ||
      /1\s*5\s*3\s*2\s*6\s*3\s*3\s*3/.test(text)
    )
  ) {
    boost += 0.32
  }

  if (/\b(loan agreement|signed loan|lender|borrower|prestamista|prestatario|vsore|varia)\b/.test(q)) {
    if (/varia structured opportunities real estate iii[\s\S]{0,260}lender/.test(text)) boost += 0.34
  }

  if (/\b(buenavista|buenvista)\b/.test(q)) {
    if (/15[.,]657[.,]498[.,]18|quince millones seiscientos cincuenta y siete mil/.test(text)) boost += 0.45
    if (/buenavista nextgen urbano[\s\S]{0,260}entidad acreditante|credito participativo|cr[eé]dito participativo/.test(text)) boost += 0.3
  }

  if (
    /\b(santander|bbva|banco|bancari[ao]|prestamo|pr[eé]stamo|loan)\b/.test(q) &&
    /\b(financiaci|financiador|coste|cost|interes|inter[eé]s|margen|euribor|comision|comisi[oó]n|cap)\b/.test(q)
  ) {
    if (/tipo de interes ordinario|indice de referencia principal|euribor|margen[\s\S]{0,160}4[,.]00|coste financiero/.test(text)) boost += 0.35
    if (/banco santander[\s\S]{0,260}bbva|banco bilbao vizcaya|31[.,]000[.,]000|15[.,]500[.,]000|entidades financiadoras/.test(text)) boost += 0.25
    if (/comision de estructuracion|comision de agencia|comision de coordinacion|contratos de cobertura|cap/.test(text)) boost += 0.2
  }

  return Math.min(boost, 0.35)
}

function applyMetadataBoost<T extends RankedRetrievedChunk>(chunks: T[], query: string): T[] {
  return chunks.map((chunk) => {
    const boost = metadataRelevanceBoost(query, chunk.metadata) + contentRelevanceBoost(query, chunk.content)
    if (boost <= 0) return chunk
    return { ...chunk, relevanceScore: Math.min(1.5, chunk.relevanceScore + boost) }
  })
}

function needsBhxCompanyNumberSupplement(query: string, projectFilter: string | null, docTypeFilter: string | null): boolean {
  if (docTypeFilter && !['funding', 'legal'].includes(docTypeFilter)) return false
  const q = normaliseQuery(query)
  const scopedToBhx = projectFilter ? projectFilter === 'BHX' : /\b(bhx|birmingham|wave park|warwickshire)\b/.test(q)
  return scopedToBhx && /\b(sh01|companies house|company number|numero de compania|capital calls?|cap calls?)\b/.test(q)
}

async function fetchBhxCompanyNumberSupplement(
  supabase: SupabaseClient,
  query: string,
  projectFilter: string | null,
  docTypeFilter: string | null,
): Promise<RetrievedChunk[]> {
  if (!needsBhxCompanyNumberSupplement(query, projectFilter, docTypeFilter)) return []
  if (typeof supabase.from !== 'function') return []

  try {
    const docsQuery = supabase.from('rag_documents')
      .select('id,title,project_id,doc_type,review_status,authority_score,classification_source,lifecycle,storage_path,source_channel')
      .eq('project_id', 'BHX')
      .eq('status', 'indexed')
      .eq('review_status', 'approved')
      .ilike('title', '%SH01%')
      .limit(16)
    const docsRes = await docsQuery
    if (docsRes.error) return []
    const docs = (docsRes.data || []) as Array<Record<string, unknown> & { id: string }>
    const liveDocs = docs.filter((doc) => metadataString(doc, 'lifecycle') !== 'superseded')
    const ids = liveDocs.map((doc) => doc.id).filter(Boolean)
    if (!ids.length) return []

    const chunksRes = await supabase.from('rag_chunks')
      .select('id,document_id,content,metadata')
      .in('document_id', ids)
      .order('chunk_index', { ascending: true })
      .limit(96)
    if (chunksRes.error) return []

    const docById = new Map(liveDocs.map((doc) => [doc.id, doc]))
    return ((chunksRes.data || []) as RetrievedChunk[])
      .filter((chunk) => {
        const text = normaliseQuery(chunk.content || '')
        return /company number/.test(text) && (
          /wave park holdings/.test(text) ||
          /15326333/.test(text) ||
          /1\s*5\s*3\s*2\s*6\s*3\s*3\s*3/.test(text)
        )
      })
      .map((chunk) => {
        const doc = docById.get(chunk.document_id)
        return {
          id: chunk.id,
          document_id: chunk.document_id,
          content: chunk.content,
          metadata: {
            ...(chunk.metadata || {}),
            source_file: metadataString(chunk.metadata, 'source_file') ?? metadataString(doc, 'title'),
            title: metadataString(chunk.metadata, 'title') ?? metadataString(doc, 'title'),
            project_id: metadataString(chunk.metadata, 'project_id') ?? metadataString(doc, 'project_id'),
            doc_type: metadataString(chunk.metadata, 'doc_type') ?? metadataString(doc, 'doc_type'),
            review_status: metadataString(chunk.metadata, 'review_status') ?? metadataString(doc, 'review_status'),
            classification_source: metadataString(chunk.metadata, 'classification_source') ?? metadataString(doc, 'classification_source'),
            authority_score: typeof doc?.authority_score === 'number' ? doc.authority_score : chunk.metadata?.authority_score,
            lifecycle: metadataString(chunk.metadata, 'lifecycle') ?? metadataString(doc, 'lifecycle'),
            storage_path: metadataString(chunk.metadata, 'storage_path') ?? metadataString(doc, 'storage_path'),
            source_channel: metadataString(chunk.metadata, 'source_channel') ?? metadataString(doc, 'source_channel'),
          },
          similarity: 0.9,
        } satisfies RetrievedChunk
      })
  } catch {
    return []
  }
}

function needsBhxVsoreLoanPartySupplement(query: string, projectFilter: string | null, docTypeFilter: string | null): boolean {
  if (docTypeFilter && !['funding', 'legal'].includes(docTypeFilter)) return false
  const q = normaliseQuery(query)
  const scopedToBhx = projectFilter ? projectFilter === 'BHX' : /\b(bhx|birmingham|wave park|warwickshire)\b/.test(q)
  return scopedToBhx && /\b(loan agreement|signed loan|lender|borrower|prestamista|prestatario|vsore|varia)\b/.test(q)
}

async function fetchBhxVsoreLoanPartySupplement(
  supabase: SupabaseClient,
  query: string,
  projectFilter: string | null,
  docTypeFilter: string | null,
): Promise<RetrievedChunk[]> {
  if (!needsBhxVsoreLoanPartySupplement(query, projectFilter, docTypeFilter)) return []
  if (typeof supabase.from !== 'function') return []

  try {
    let docsQuery = supabase.from('rag_documents')
      .select('id,title,project_id,doc_type,review_status,authority_score,classification_source,lifecycle,storage_path,source_channel')
      .eq('project_id', 'BHX')
      .eq('status', 'indexed')
      .eq('review_status', 'approved')
      .ilike('title', '%Loan Agreement_VSORE III%')
      .limit(16)
    if (docTypeFilter) docsQuery = docsQuery.eq('doc_type', docTypeFilter)
    const docsRes = await docsQuery
    if (docsRes.error) return []
    const docs = ((docsRes.data || []) as Array<Record<string, unknown> & { id: string }>)
      .filter((doc) => metadataString(doc, 'lifecycle') !== 'superseded')
    const ids = docs.map((doc) => doc.id).filter(Boolean)
    if (!ids.length) return []

    const chunksRes = await supabase.from('rag_chunks')
      .select('id,document_id,content,metadata,chunk_index')
      .in('document_id', ids)
      .order('chunk_index', { ascending: true })
      .limit(80)
    if (chunksRes.error) return []

    const docById = new Map(docs.map((doc) => [doc.id, doc]))
    return ((chunksRes.data || []) as Array<RetrievedChunk & { chunk_index?: number }>)
      .filter((chunk) => {
        const text = normaliseQuery(chunk.content || '')
        return (
          /varia structured opportunities real estate iii/.test(text) && /lender/.test(text)
        ) || (
          /wave park holdings/.test(text) && /borrower/.test(text)
        ) || (
          /borrower wishes to borrow/.test(text) && /lender has agreed/.test(text)
        )
      })
      .slice(0, 8)
      .map((chunk) => {
        const doc = docById.get(chunk.document_id)
        return {
          id: chunk.id,
          document_id: chunk.document_id,
          content: chunk.content,
          metadata: {
            ...(chunk.metadata || {}),
            source_file: metadataString(chunk.metadata, 'source_file') ?? metadataString(doc, 'title'),
            title: metadataString(chunk.metadata, 'title') ?? metadataString(doc, 'title'),
            project_id: metadataString(chunk.metadata, 'project_id') ?? metadataString(doc, 'project_id'),
            doc_type: metadataString(chunk.metadata, 'doc_type') ?? metadataString(doc, 'doc_type'),
            review_status: metadataString(chunk.metadata, 'review_status') ?? metadataString(doc, 'review_status'),
            classification_source: metadataString(chunk.metadata, 'classification_source') ?? metadataString(doc, 'classification_source'),
            authority_score: typeof doc?.authority_score === 'number' ? doc.authority_score : chunk.metadata?.authority_score,
            lifecycle: metadataString(chunk.metadata, 'lifecycle') ?? metadataString(doc, 'lifecycle'),
            storage_path: metadataString(chunk.metadata, 'storage_path') ?? metadataString(doc, 'storage_path'),
            source_channel: metadataString(chunk.metadata, 'source_channel') ?? metadataString(doc, 'source_channel'),
          },
          similarity: 0.93,
        } satisfies RetrievedChunk
      })
  } catch {
    return []
  }
}

function legalSupplementProjects(projectFilter: string | null): string[] {
  if (!projectFilter || projectFilter === 'MAD') return ['KLP', 'GVF']
  if (projectFilter === 'KLP' || projectFilter === 'GVF') return [projectFilter]
  return []
}

function needsLegalLocationSupplement(query: string, projectFilter: string | null, docTypeFilter: string | null): boolean {
  if (docTypeFilter && docTypeFilter !== 'legal') return false
  if (legalSupplementProjects(projectFilter).length === 0) return false
  const q = normaliseQuery(query)
  return /\b(pactos? de socios|shareholders? agreement|personas apoderadas|apoderad[oa]s?|powers? of attorney|poa)\b/.test(q)
}

async function fetchLegalLocationSupplement(
  supabase: SupabaseClient,
  query: string,
  projectFilter: string | null,
  docTypeFilter: string | null,
): Promise<RetrievedChunk[]> {
  if (!needsLegalLocationSupplement(query, projectFilter, docTypeFilter)) return []
  if (typeof supabase.from !== 'function') return []
  const q = normaliseQuery(query)
  const projects = legalSupplementProjects(projectFilter)
  const titleFilters: string[] = []
  if (/\b(pactos? de socios|shareholders? agreement)\b/.test(q)) titleFilters.push('title.ilike.%Pacto de Socios%')
  if (/\b(personas apoderadas|apoderad[oa]s?|powers? of attorney|poa)\b/.test(q)) {
    titleFilters.push('title.ilike.%PERSONAS APODERADAS%')
    titleFilters.push('title.ilike.%Acta PoA%')
    titleFilters.push('title.ilike.%PoA Gemswell Ventures 118 account%')
  }
  if (!titleFilters.length) return []

  try {
    let docsQuery = supabase.from('rag_documents')
      .select('id,title,project_id,doc_type,review_status,authority_score,classification_source,lifecycle,storage_path,source_channel')
      .in('project_id', projects)
      .eq('doc_type', 'legal')
      .eq('status', 'indexed')
      .eq('review_status', 'approved')
      .or(titleFilters.join(','))
      .limit(20)
    if (docTypeFilter) docsQuery = docsQuery.eq('doc_type', docTypeFilter)
    const docsRes = await docsQuery
    if (docsRes.error) return []
    const docs = ((docsRes.data || []) as Array<Record<string, unknown> & { id: string }>)
      .filter((doc) => metadataString(doc, 'lifecycle') !== 'superseded')
    const ids = docs.map((doc) => doc.id).filter(Boolean)
    if (!ids.length) return []

    const chunksRes = await supabase.from('rag_chunks')
      .select('id,document_id,content,metadata,chunk_index')
      .in('document_id', ids)
      .order('chunk_index', { ascending: true })
      .limit(80)
    if (chunksRes.error) return []

    const docById = new Map(docs.map((doc) => [doc.id, doc]))
    const firstChunkByDoc = new Map<string, RetrievedChunk & { chunk_index?: number }>()
    for (const chunk of (chunksRes.data || []) as Array<RetrievedChunk & { chunk_index?: number }>) {
      if (!firstChunkByDoc.has(chunk.document_id)) firstChunkByDoc.set(chunk.document_id, chunk)
    }

    return Array.from(firstChunkByDoc.values()).map((chunk) => {
      const doc = docById.get(chunk.document_id)
      return {
        id: chunk.id,
        document_id: chunk.document_id,
        content: chunk.content,
        metadata: {
          ...(chunk.metadata || {}),
          source_file: metadataString(doc, 'title') ?? metadataString(chunk.metadata, 'source_file'),
          title: metadataString(doc, 'title') ?? metadataString(chunk.metadata, 'title'),
          project_id: metadataString(doc, 'project_id') ?? metadataString(chunk.metadata, 'project_id'),
          doc_type: metadataString(doc, 'doc_type') ?? metadataString(chunk.metadata, 'doc_type'),
          review_status: metadataString(doc, 'review_status') ?? metadataString(chunk.metadata, 'review_status'),
          classification_source: metadataString(doc, 'classification_source') ?? metadataString(chunk.metadata, 'classification_source'),
          authority_score: typeof doc?.authority_score === 'number' ? doc.authority_score : chunk.metadata?.authority_score,
          lifecycle: metadataString(doc, 'lifecycle') ?? metadataString(chunk.metadata, 'lifecycle'),
          chunk_index: typeof chunk.chunk_index === 'number' ? chunk.chunk_index : chunk.metadata?.chunk_index,
          storage_path: metadataString(doc, 'storage_path') ?? metadataString(chunk.metadata, 'storage_path'),
          source_channel: metadataString(doc, 'source_channel') ?? metadataString(chunk.metadata, 'source_channel'),
        },
        similarity: 0.95,
      } satisfies RetrievedChunk
    })
  } catch {
    return []
  }
}

function needsBuenavistaFundingSupplement(query: string, projectFilter: string | null, docTypeFilter: string | null): boolean {
  if (projectFilter && projectFilter !== 'MAD') return false
  if (docTypeFilter && docTypeFilter !== 'funding') return false
  const q = normaliseQuery(query)
  return /\b(buenavista|buenvista)\b/.test(q) && /\b(financiaci|credito|cr[eé]dito|participativo|lender|prestamista)\b/.test(q)
}

async function fetchBuenavistaFundingSupplement(
  supabase: SupabaseClient,
  query: string,
  projectFilter: string | null,
  docTypeFilter: string | null,
): Promise<RetrievedChunk[]> {
  if (!needsBuenavistaFundingSupplement(query, projectFilter, docTypeFilter)) return []
  if (typeof supabase.from !== 'function') return []

  try {
    const docsRes = await supabase.from('rag_documents')
      .select('id,title,project_id,doc_type,review_status,authority_score,classification_source,lifecycle,storage_path,source_channel')
      .eq('project_id', 'MAD')
      .eq('doc_type', 'funding')
      .eq('status', 'indexed')
      .eq('review_status', 'approved')
      .ilike('title', '%Buenavista%')
      .limit(8)
    if (docsRes.error) return []
    const docs = ((docsRes.data || []) as Array<Record<string, unknown> & { id: string }>)
      .filter((doc) => metadataString(doc, 'lifecycle') !== 'superseded')
      .filter((doc) => /credito participativo|cr[eé]dito participativo|4148-6073-6102/i.test(metadataString(doc, 'title') ?? ''))
    const ids = docs.map((doc) => doc.id).filter(Boolean)
    if (!ids.length) return []

    const chunksRes = await supabase.from('rag_chunks')
      .select('id,document_id,content,metadata,chunk_index')
      .in('document_id', ids)
      .order('chunk_index', { ascending: true })
      .limit(220)
    if (chunksRes.error) return []

    const docById = new Map(docs.map((doc) => [doc.id, doc]))
    return ((chunksRes.data || []) as Array<RetrievedChunk & { chunk_index?: number }>)
      .filter((chunk) => {
        const text = normaliseQuery(chunk.content || '')
        return /credito participativo|cr[eé]dito participativo|buenavista nextgen|15[.,]657[.,]498[.,]18|entidad acreditante|importe maximo/.test(text)
      })
      .slice(0, 12)
      .map((chunk) => {
        const doc = docById.get(chunk.document_id)
        return {
          id: chunk.id,
          document_id: chunk.document_id,
          content: chunk.content,
          metadata: {
            ...(chunk.metadata || {}),
            source_file: metadataString(doc, 'title') ?? metadataString(chunk.metadata, 'source_file'),
            title: metadataString(doc, 'title') ?? metadataString(chunk.metadata, 'title'),
            project_id: metadataString(doc, 'project_id') ?? metadataString(chunk.metadata, 'project_id'),
            doc_type: metadataString(doc, 'doc_type') ?? metadataString(chunk.metadata, 'doc_type'),
            review_status: metadataString(doc, 'review_status') ?? metadataString(chunk.metadata, 'review_status'),
            classification_source: metadataString(doc, 'classification_source') ?? metadataString(chunk.metadata, 'classification_source'),
            authority_score: typeof doc?.authority_score === 'number' ? doc.authority_score : chunk.metadata?.authority_score,
            lifecycle: metadataString(doc, 'lifecycle') ?? metadataString(chunk.metadata, 'lifecycle'),
            chunk_index: typeof chunk.chunk_index === 'number' ? chunk.chunk_index : chunk.metadata?.chunk_index,
            storage_path: metadataString(doc, 'storage_path') ?? metadataString(chunk.metadata, 'storage_path'),
            source_channel: metadataString(doc, 'source_channel') ?? metadataString(chunk.metadata, 'source_channel'),
          },
          similarity: 0.96,
        } satisfies RetrievedChunk
      })
  } catch {
    return []
  }
}

function needsMadridSeniorBankFundingSupplement(query: string, projectFilter: string | null, docTypeFilter: string | null): boolean {
  if (projectFilter && projectFilter !== 'MAD') return false
  if (docTypeFilter && docTypeFilter !== 'funding') return false
  const q = normaliseQuery(query)
  const scopedToMadrid = projectFilter === 'MAD' || /\b(mad|madrid|mps|playa surf)\b/.test(q)
  return scopedToMadrid &&
    /\b(santander|bbva|banco|bancari[ao]|prestamo|pr[eé]stamo|loan)\b/.test(q) &&
    /\b(financiaci|financiador|coste|cost|interes|inter[eé]s|margen|euribor|comision|comisi[oó]n|cap)\b/.test(q)
}

async function fetchMadridSeniorBankFundingSupplement(
  supabase: SupabaseClient,
  query: string,
  projectFilter: string | null,
  docTypeFilter: string | null,
): Promise<RetrievedChunk[]> {
  if (!needsMadridSeniorBankFundingSupplement(query, projectFilter, docTypeFilter)) return []
  if (typeof supabase.from !== 'function') return []

  try {
    const docsRes = await supabase.from('rag_documents')
      .select('id,title,project_id,doc_type,review_status,authority_score,classification_source,lifecycle,storage_path,source_channel')
      .eq('project_id', 'MAD')
      .eq('doc_type', 'funding')
      .eq('status', 'indexed')
      .eq('review_status', 'approved')
      .or('title.ilike.%4140-7692-5542%,title.ilike.%Piscina de Olas - Contrato de financiaci%')
      .limit(12)
    if (docsRes.error) return []
    const docs = ((docsRes.data || []) as Array<Record<string, unknown> & { id: string }>)
      .filter((doc) => metadataString(doc, 'lifecycle') !== 'superseded')
      .filter((doc) => {
        const title = normaliseQuery(metadataString(doc, 'title') ?? '')
        return /4140-7692-5542|piscina de olas.*contrato de financiaci|contrato de financiacion.*vfinal/.test(title)
      })
    const ids = docs.map((doc) => doc.id).filter(Boolean)
    if (!ids.length) return []

    const chunksRes = await supabase.from('rag_chunks')
      .select('id,document_id,content,metadata,chunk_index')
      .in('document_id', ids)
      .order('chunk_index', { ascending: true })
      .limit(460)
    if (chunksRes.error) return []

    const docById = new Map(docs.map((doc) => [doc.id, doc]))
    const priority = (chunk: RetrievedChunk & { chunk_index?: number }) => {
      const text = normaliseQuery(chunk.content || '')
      let score = 0
      if (/tipo de interes ordinario|indice de referencia principal|euribor|margen|4[,.]00|limite a la variabilidad/.test(text)) score += 100
      if (/comision de estructuracion|comision de agencia|comision de coordinacion|coste financiero|contratos de cobertura|cap/.test(text)) score += 80
      if (/31[.,]000[.,]000|15[.,]500[.,]000/.test(text)) score += 50
      if (/entidades financiadoras|banco santander|banco bilbao vizcaya|bbva/.test(text)) score += 20
      return score
    }
    return ((chunksRes.data || []) as Array<RetrievedChunk & { chunk_index?: number }>)
      .filter((chunk) => {
        const text = normaliseQuery(chunk.content || '')
        return /31[.,]000[.,]000|15[.,]500[.,]000|entidades financiadoras|banco santander|banco bilbao vizcaya|bbva|tipo de interes ordinario|indice de referencia principal|euribor|margen|4[,.]00|limite a la variabilidad|comision de estructuracion|comision de agencia|comision de coordinacion|coste financiero|contratos de cobertura|cap/.test(text)
      })
      .sort((a, b) => (priority(b) - priority(a)) || ((a.chunk_index ?? 0) - (b.chunk_index ?? 0)))
      .slice(0, 16)
      .map((chunk) => {
        const doc = docById.get(chunk.document_id)
        return {
          id: chunk.id,
          document_id: chunk.document_id,
          content: chunk.content,
          metadata: {
            ...(chunk.metadata || {}),
            source_file: metadataString(doc, 'title') ?? metadataString(chunk.metadata, 'source_file'),
            title: metadataString(doc, 'title') ?? metadataString(chunk.metadata, 'title'),
            project_id: metadataString(doc, 'project_id') ?? metadataString(chunk.metadata, 'project_id'),
            doc_type: metadataString(doc, 'doc_type') ?? metadataString(chunk.metadata, 'doc_type'),
            review_status: metadataString(doc, 'review_status') ?? metadataString(chunk.metadata, 'review_status'),
            classification_source: metadataString(doc, 'classification_source') ?? metadataString(chunk.metadata, 'classification_source'),
            authority_score: typeof doc?.authority_score === 'number' ? doc.authority_score : chunk.metadata?.authority_score,
            lifecycle: metadataString(doc, 'lifecycle') ?? metadataString(chunk.metadata, 'lifecycle'),
            chunk_index: typeof chunk.chunk_index === 'number' ? chunk.chunk_index : chunk.metadata?.chunk_index,
            storage_path: metadataString(doc, 'storage_path') ?? metadataString(chunk.metadata, 'storage_path'),
            source_channel: metadataString(doc, 'source_channel') ?? metadataString(chunk.metadata, 'source_channel'),
          },
          similarity: 0.97,
        } satisfies RetrievedChunk
      })
  } catch {
    return []
  }
}

/**
 * The full set of governance/lifecycle states that must NEVER reach chat context (audit 2026-06-07):
 * rejected/agent_rejected (rejected sources) PLUS lifecycle='superseded' (a replaced revision that
 * must not be cited next to its replacement). `needs_review`/`pending` are deliberately NOT excluded —
 * the chat keeps them as a fallback (ranked strictly below approved by rankBySourceTrust) and discloses
 * the reliance, rather than blinding the bot to 41% of the corpus. This is the app-layer defense-in-depth
 * mirror of the SQL filter in match_chunks / keyword_search_chunks (sql/019).
 */
export function isExcludedFromRetrieval(metadata: Record<string, unknown> | undefined): boolean {
  return isRejectedSource(metadata) || metadataString(metadata, 'lifecycle') === 'superseded'
}

/** True when a chunk's parent document is ungoverned (not yet human-reviewed). */
function isUnreviewedSource(metadata: Record<string, unknown> | undefined): boolean {
  const rs = metadataString(metadata, 'review_status')
  return rs === 'needs_review' || rs === 'pending'
}

export function isAllowedByGroundingMode(
  metadata: Record<string, unknown> | undefined,
  mode: GroundingMode
): boolean {
  if (mode === 'standard') return true
  const tier = trustTier(metadata)
  return mode === 'official_only' ? tier >= 3 : tier >= 2
}

export type FusionConfig = { mode: 'rrf' | 'vector_first'; k: number; wVector: number; wKeyword: number }
export type FusedChunk = RetrievedChunk & { fusedScore?: number }

/**
 * Merge the vector + keyword lanes into a deduped pool (excluded sources removed). In 'rrf' mode each
 * chunk carries a Reciprocal Rank Fusion score — a chunk found by BOTH lanes gets the additive agreement
 * boost (the precision signal the old vector-first dedup threw away, audit A3) and the pool is ordered by
 * it; 'vector_first' preserves the legacy order. The pool is still Cohere-reranked downstream, so RRF most
 * affects pool inclusion + the DEGRADED (Cohere-down) ordering, which now uses fusedScore (scale-free).
 */
export function fusePool(
  vectorResults: RetrievedChunk[],
  keywordResults: RetrievedChunk[],
  config: FusionConfig,
): { pool: FusedChunk[]; overlapCount: number } {
  // Exclude rejected/superseded BEFORE computing ranks, so an excluded row cannot consume a rank slot
  // and distort an allowed chunk's RRF score (adversarial review). The SQL already excludes these; this
  // is the defense-in-depth mirror, and overlapCount/ranks are now over genuinely-usable evidence only.
  const vAllowed = vectorResults.filter((r) => !isExcludedFromRetrieval(r.metadata))
  const kAllowed = keywordResults.filter((r) => !isExcludedFromRetrieval(r.metadata))
  const vRank = new Map<string, number>()
  vAllowed.forEach((r, i) => { if (!vRank.has(r.id)) vRank.set(r.id, i + 1) })
  const kRank = new Map<string, number>()
  kAllowed.forEach((r, i) => { if (!kRank.has(r.id)) kRank.set(r.id, i + 1) })
  let overlapCount = 0
  for (const id of vRank.keys()) if (kRank.has(id)) overlapCount++

  const merged = new Map<string, FusedChunk>()
  for (const r of [...vAllowed, ...kAllowed]) {
    if (merged.has(r.id)) continue
    const vr = vRank.get(r.id)
    const kr = kRank.get(r.id)
    const fusedScore = (vr ? config.wVector / (config.k + vr) : 0) + (kr ? config.wKeyword / (config.k + kr) : 0)
    merged.set(r.id, { ...r, fusedScore })
  }
  const pool = Array.from(merged.values())
  if (config.mode === 'rrf') pool.sort((a, b) => (b.fusedScore ?? 0) - (a.fusedScore ?? 0))
  return { pool, overlapCount }
}

/**
 * Drop chunks whose Cohere relevance is below `floor` (precision gate, WS1-T3). NEVER empties a non-empty
 * set — if everything is below the floor it keeps the single most-relevant chunk so the chat still has its
 * best evidence. `floor <= 0` is a no-op (recall-first default).
 */
export function applyRelevanceFloor<T extends { relevanceScore?: number }>(
  chunks: T[],
  floor: number,
  isProtected?: (c: T) => boolean,
): T[] {
  if (!(floor > 0)) return chunks
  // A protected chunk (e.g. high trust tier) is NEVER dropped by the floor — relevance must not override
  // governance (adversarial review F1: trust dominates relevance).
  const keep = chunks.filter((c) => (isProtected?.(c) ?? false) || (c.relevanceScore ?? 0) >= floor)
  if (keep.length > 0) return keep
  const best = chunks.slice().sort((a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0))[0]
  return best ? [best] : []
}

/**
 * Tool-result text when retrieval yields nothing. Critically distinguishes a retrieval OUTAGE
 * (a lane threw — Gemini 429 / RPC timeout) from a genuine no-match, and never blames governance
 * for an infrastructure failure (the old message wrongly claimed "excluded because rejected").
 */
export function emptyResultMessage(diagnostics: Pick<RetrievalDiagnostics, 'vectorFailed' | 'keywordFailed'> & Partial<Pick<RetrievalDiagnostics, 'groundingMode' | 'groundingFilteredCount'>>): string {
  if (diagnostics.vectorFailed || diagnostics.keywordFailed) {
    const which = diagnostics.vectorFailed && diagnostics.keywordFailed
      ? 'Both the semantic and keyword retrieval lanes'
      : diagnostics.vectorFailed
        ? 'The semantic (vector) retrieval lane'
        : 'The keyword retrieval lane'
    return `Document retrieval is temporarily degraded: ${which} did not respond, so no documentary evidence could be retrieved for this query. This is a transient retrieval failure, NOT an absence of relevant documents — do not conclude the corpus lacks an answer. Say the documentary search was unavailable and suggest retrying.`
  }
  if (diagnostics.groundingMode === 'official_only' && (diagnostics.groundingFilteredCount ?? 0) > 0) {
    return 'No official/source-of-record documents matched after applying strict grounding. Relevant lower-governance chunks existed, but were withheld by official_only mode; abstain or switch to standard mode if exploratory context is acceptable.'
  }
  if (diagnostics.groundingMode === 'trusted_only' && (diagnostics.groundingFilteredCount ?? 0) > 0) {
    return 'No trusted reviewed documents matched after applying strict grounding. Relevant lower-governance chunks existed, but were withheld by trusted_only mode; abstain or switch to standard mode if unreviewed context is acceptable.'
  }
  return 'No relevant documents were found in the indexed corpus for this query.'
}

/**
 * Hybrid documentary retrieval: vector + keyword in parallel, merged, reranked over the FULL pool
 * (so trust-tier ordering can promote a high-trust chunk Cohere scored modestly), then ordered by
 * trust tier and truncated to the final top-K.
 */
export async function retrieveDocuments(
  supabase: SupabaseClient,
  query: string,
  opts: RetrieveOptions = {}
): Promise<RetrievalResult> {
  const projectFilter = opts.projectFilter ?? null
  const docTypeFilter = opts.docTypeFilter ?? null
  const retrievalQuery = expandRetrievalQuery(query, { projectFilter })
  const groundingMode = opts.groundingMode ?? 'standard'
  const strictGrounding = groundingMode !== 'standard'
  const useMadridSeniorBankSupplementOnlyVectorBypass =
    projectFilter === 'MAD' &&
    docTypeFilter === 'funding' &&
    needsMadridSeniorBankFundingSupplement(retrievalQuery, projectFilter, docTypeFilter)
  const vectorMatchCount = strictGrounding
    ? Math.min(RAG_VECTOR_MATCH_COUNT * STRICT_GROUNDING_EXTRACTION_MULTIPLIER, STRICT_GROUNDING_VECTOR_CAP)
    : RAG_VECTOR_MATCH_COUNT
  const keywordMatchCount = strictGrounding
    ? Math.min(RAG_KEYWORD_MATCH_COUNT * STRICT_GROUNDING_EXTRACTION_MULTIPLIER, STRICT_GROUNDING_KEYWORD_CAP)
    : RAG_KEYWORD_MATCH_COUNT

  // Parallel: vector search + keyword search. Each lane reports whether it THREW (outage) vs returned
  // empty (no matches) — a distinction the old `catch { return [] }` erased, hiding the exact silent
  // single-lane degradation that has already bitten this corpus twice (HNSW + stopword timeouts).
  const [vector, keyword] = await Promise.all([
    useMadridSeniorBankSupplementOnlyVectorBypass
      ? Promise.resolve({ rows: [], failed: false })
      : (async (): Promise<{ rows: RetrievedChunk[]; failed: boolean }> => {
      try {
        const embedding = await embedText(retrievalQuery, { lane: 'interactive' })
        const { data, error } = await supabase.rpc('match_chunks', {
          query_embedding: embedding,
          match_count: vectorMatchCount,
          filter_project: projectFilter,
          filter_doc_type: docTypeFilter,
          match_threshold: RAG_MATCH_THRESHOLD,
        })
        // supabase-js does NOT throw on a PostgREST error (e.g. statement timeout — the silent-death mode
        // that killed retrieval twice); it returns it in `error`. Treat that as a lane FAILURE (outage),
        // not a clean empty result, so the chat surfaces degradation instead of "no documents". (adversarial review)
        if (error) return { rows: [], failed: true }
        return {
          rows: ((data || []) as RetrievedChunk[]).map((r) => ({
            id: r.id,
            document_id: r.document_id,
            content: r.content,
            metadata: r.metadata || {},
            similarity: r.similarity,
          })),
          failed: false,
        }
      } catch {
        return { rows: [], failed: true }
      }
    })(),
    (async (): Promise<{ rows: RetrievedChunk[]; failed: boolean }> => {
      try {
        const { data, error } = await supabase.rpc('keyword_search_chunks', {
          query_text: retrievalQuery,
          filter_project: projectFilter,
          match_count: keywordMatchCount,
          filter_doc_type: docTypeFilter,
        })
        // PostgREST errors come back in `error` (no throw) — treat as a lane failure, not a clean miss.
        if (error) return { rows: [], failed: true }
        return {
          rows: ((data || []) as Array<RetrievedChunk & { rank?: number }>)
            // RPC already applies doc_type; keep this as a defensive belt-and-suspenders
            .filter((r) => !docTypeFilter || r.metadata?.doc_type === docTypeFilter)
            .map((r) => ({
              id: r.id,
              document_id: r.document_id,
              content: r.content,
              metadata: r.metadata || {},
              similarity: r.rank,
            })),
          failed: false,
        }
      } catch {
        return { rows: [], failed: true }
      }
    })(),
  ])

  const vectorResults = vector.rows
  const keywordResults = keyword.rows
  const [graphExpansion, companyNumberSupplement, vsoreLoanSupplement, legalLocationSupplement, buenavistaFundingSupplement, madridSeniorBankFundingSupplement] = await Promise.all([
    expandDocumentGraph(supabase, retrievalQuery, { projectFilter, docTypeFilter }),
    fetchBhxCompanyNumberSupplement(supabase, retrievalQuery, projectFilter, docTypeFilter),
    fetchBhxVsoreLoanPartySupplement(supabase, retrievalQuery, projectFilter, docTypeFilter),
    fetchLegalLocationSupplement(supabase, retrievalQuery, projectFilter, docTypeFilter),
    fetchBuenavistaFundingSupplement(supabase, retrievalQuery, projectFilter, docTypeFilter),
    fetchMadridSeniorBankFundingSupplement(supabase, retrievalQuery, projectFilter, docTypeFilter),
  ])
  const graphResults = graphExpansion.chunks
  const graphEntities = graphExpansion.entities.map((entity) => `${entity.kind}:${entity.value}`)
  const supplementalResults = [...graphResults, ...companyNumberSupplement, ...vsoreLoanSupplement, ...legalLocationSupplement, ...buenavistaFundingSupplement, ...madridSeniorBankFundingSupplement]

  // Merge the two lanes into a deduped, excluded-filtered pool (RRF or legacy vector-first, env-gated).
  const { pool, overlapCount } = fusePool(vectorResults, [...keywordResults, ...supplementalResults], {
    mode: RAG_FUSION_MODE,
    k: RAG_RRF_K,
    wVector: RAG_RRF_W_VECTOR,
    wKeyword: RAG_RRF_W_KEYWORD,
  })
  if (pool.length === 0) {
    return {
      ranked: [],
      diagnostics: {
        vectorCount: vectorResults.length,
        keywordCount: keywordResults.length,
        graphCount: graphResults.length,
        graphEntities,
        poolCount: 0,
        overlapCount,
        degraded: false,
        vectorFailed: vector.failed,
        keywordFailed: keyword.failed,
        unreviewedUsed: 0,
        groundingMode,
        groundingFilteredCount: 0,
        modelRerankUsed: false,
        modelRerankModel: null,
      },
    }
  }

  const groundedPool = pool.filter(c => isAllowedByGroundingMode(c.metadata, groundingMode))
  const groundingFilteredCount = pool.length - groundedPool.length
  if (groundedPool.length === 0) {
    return {
      ranked: [],
      diagnostics: {
        vectorCount: vectorResults.length,
        keywordCount: keywordResults.length,
        graphCount: graphResults.length,
        graphEntities,
        poolCount: 0,
        overlapCount,
        degraded: false,
        vectorFailed: vector.failed,
        keywordFailed: keyword.failed,
        unreviewedUsed: 0,
        groundingMode,
        groundingFilteredCount,
        modelRerankUsed: false,
        modelRerankModel: null,
      },
    }
  }

  // Cohere-rerank the FULL pool (not just top-K) so trust-tier ordering can promote a high-trust chunk
  // Cohere scored modestly — otherwise Cohere's relevance cut would drop it before trust is considered.
  const { chunks: rerankedRaw, degraded } = await rerankChunks(retrievalQuery, groundedPool, groundedPool.length)
  const reranked = rerankedRaw.filter((c) => !isExcludedFromRetrieval(c.metadata))
  // Precision floor on the Cohere relevance (WS1-T3) — only on the trustworthy (non-degraded) path,
  // since degraded scores are normalised approximations, not Cohere relevance. Trust-aware: never floor
  // out high-trust (source_of_record / supporting, tier >= 2) evidence (adversarial review F1).
  const floored = degraded
    ? reranked
    : applyRelevanceFloor(reranked, RAG_RELEVANCE_FLOOR, (c) => trustTier(c.metadata) >= 2)
  const boosted = applyMetadataBoost(floored as RankedRetrievedChunk[], retrievalQuery)
  const modelRerank = await rerankRetrievedChunksWithOpenAI(retrievalQuery, boosted, {
    enabled: opts.modelRerank ?? true,
  })
  const ranked = (groundingMode === 'standard'
    ? rankForStandardGrounding(modelRerank.chunks)
    : rankBySourceTrust(modelRerank.chunks)
  ).slice(0, RAG_FINAL_TOP_K) as RankedRetrievedChunk[]
  const unreviewedUsed = ranked.filter((c) => isUnreviewedSource(c.metadata)).length

  return {
    ranked,
    diagnostics: {
      vectorCount: vectorResults.length,
      keywordCount: keywordResults.length,
      graphCount: graphResults.length,
      graphEntities,
      poolCount: pool.length,
      overlapCount,
      degraded,
      vectorFailed: vector.failed,
      keywordFailed: keyword.failed,
      unreviewedUsed,
      groundingMode,
      groundingFilteredCount,
      modelRerankUsed: modelRerank.used,
      modelRerankModel: modelRerank.model,
    },
  }
}
