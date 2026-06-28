import type { SupabaseClient } from '@supabase/supabase-js'
import { DOC_TYPES, PROJECT_IDS } from '@/lib/knowledge/contracts'

export type GraphEntityKind =
  | 'project'
  | 'bank'
  | 'counterparty'
  | 'document_role'
  | 'finance_term'
  | 'legal_term'
  | 'amount'
  | 'date'
  | 'document_code'

export type GraphQueryEntity = {
  kind: GraphEntityKind
  value: string
  aliases: string[]
  weight: number
}

export type GraphRetrievedChunk = {
  id: string
  document_id: string
  content: string
  metadata: Record<string, unknown>
  similarity?: number
}

type GraphDocumentRow = {
  id: string
  title?: string | null
  project_id?: string | null
  doc_type?: string | null
  review_status?: string | null
  authority_score?: number | null
  authority_tier?: string | null
  classification_source?: string | null
  lifecycle?: string | null
  storage_path?: string | null
  source_channel?: string | null
}

type GraphChunkRow = GraphRetrievedChunk & { chunk_index?: number | null }

export type GraphExpansionOptions = {
  projectFilter?: string | null
  docTypeFilter?: string | null
  maxDocuments?: number
  maxChunks?: number
}

export type GraphExpansionResult = {
  chunks: GraphRetrievedChunk[]
  entities: GraphQueryEntity[]
  documentIds: string[]
}

function normalise(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function uniq<T>(values: T[]): T[] {
  return Array.from(new Set(values))
}

function addEntity(
  entities: GraphQueryEntity[],
  kind: GraphEntityKind,
  value: string,
  aliases: string[],
  weight: number,
) {
  const cleanedAliases = uniq([value, ...aliases].map((alias) => alias.trim()).filter(Boolean))
  if (entities.some((entity) => entity.kind === kind && entity.value.toLowerCase() === value.toLowerCase())) return
  entities.push({ kind, value, aliases: cleanedAliases, weight })
}

function includesAny(haystack: string, aliases: string[]): boolean {
  return aliases.some((alias) => normalise(alias).length >= 2 && haystack.includes(normalise(alias)))
}

export function extractGraphQueryEntities(query: string, opts: { projectFilter?: string | null } = {}): GraphQueryEntity[] {
  void opts
  const q = normalise(query)
  const entities: GraphQueryEntity[] = []

  if (/\b(mad|mps|madrid|playa surf|madrid playa surf|piscina de olas)\b/.test(q)) {
    addEntity(entities, 'project', 'MAD', ['MPS', 'Madrid Playa Surf', 'Piscina de Olas'], 7)
  }
  if (/\b(bhx|birmingham|wave park|warwickshire)\b/.test(q)) {
    addEntity(entities, 'project', 'BHX', ['Birmingham', 'Wave Park', 'Warwickshire'], 7)
  }
  if (/\b(klp|kelpa)\b/.test(q)) addEntity(entities, 'project', 'KLP', ['Kelpa', 'Kelpa HoldCo'], 6)
  if (/\b(philae|fund level|portfolio|gemswell financials)\b/.test(q)) {
    addEntity(entities, 'project', 'PHILAE', ['Philae', 'Gemswell Financials', 'portfolio'], 5)
  }
  if (/\b(gvf|gemswell ventures|grupo gemswell)\b/.test(q)) {
    addEntity(entities, 'project', 'GVF', ['Gemswell Ventures', 'grupo Gemswell'], 5)
  }
  if (/\b(etp|enea tech|technology platform)\b/.test(q)) addEntity(entities, 'project', 'ETP', ['Enea Tech Platform'], 5)

  if (/santander/.test(q)) addEntity(entities, 'bank', 'Banco Santander', ['Santander'], 8)
  if (/bbva|bilbao vizcaya/.test(q)) addEntity(entities, 'bank', 'BBVA', ['Banco Bilbao Vizcaya Argentaria'], 8)
  if (/buenavista|buenvista/.test(q)) addEntity(entities, 'counterparty', 'Buenavista', ['Buenavista Nextgen Urbano', 'Buenvista'], 8)
  if (/caixabank/.test(q)) addEntity(entities, 'bank', 'CaixaBank', ['CaixaBank'], 6)
  if (/vsore|varia structured|varia/.test(q)) {
    addEntity(entities, 'counterparty', 'Varia / VSORE III', ['VSORE III', 'Varia Structured Opportunities Real Estate III', 'Varia'], 7)
  }

  if (/\b(financiaci|funding|loan|prestamo|pr[eé]stamo|deuda|facility|lender|borrower|prestamista|prestatario)\b/.test(q)) {
    addEntity(entities, 'document_role', 'contrato de financiacion', ['contrato de financiacion', 'contrato de financiación', 'loan agreement', 'facility agreement'], 7)
  }
  if (/\b(credito participativo|cr[eé]dito participativo|participative credit)\b/.test(q)) {
    addEntity(entities, 'document_role', 'credito participativo', ['credito participativo', 'crédito participativo', 'participative credit'], 8)
  }
  if (/\b(pactos? de socios|shareholders? agreement|acuerdo de socios)\b/.test(q)) {
    addEntity(entities, 'legal_term', 'pacto de socios', ['pacto de socios', 'shareholders agreement', 'acuerdo de socios'], 8)
  }
  if (/\b(personas apoderadas|apoderad[oa]s?|powers? of attorney|poa|poder(?:es)?)\b/.test(q)) {
    addEntity(entities, 'legal_term', 'personas apoderadas', ['PERSONAS APODERADAS', 'powers of attorney', 'PoA', 'poderes'], 8)
  }
  if (/\b(sh01|companies house|company number|numero de compania|capital calls?|cap calls?)\b/.test(q)) {
    addEntity(entities, 'document_role', 'SH01 capital call', ['SH01', 'Companies House', 'company number', 'capital call'], 7)
  }
  if (/\b(junta|consejo|acta|board|shareholder meeting|reunion|reuni[oó]n)\b/.test(q)) {
    addEntity(entities, 'document_role', 'acta', ['acta', 'junta', 'consejo', 'board', 'meeting'], 5)
  }
  if (/\b(balance|cuentas|financial statements?|annual accounts|cierre)\b/.test(q)) {
    addEntity(entities, 'document_role', 'cuentas', ['financial statements', 'annual accounts', 'cuentas', 'balance', 'cierre'], 6)
  }

  if (/\b(euribor|margen|inter[eé]s|interest|comisi[oó]n|commission|coste|cost|cap\b|tipo de interes)\b/.test(q)) {
    addEntity(entities, 'finance_term', 'coste financiero', ['EURIBOR', 'margen', 'tipo de interes', 'tipo de interés', 'comision', 'comisión', 'coste financiero', 'CAP'], 7)
  }

  for (const match of query.matchAll(/\b\d{1,3}(?:[.,]\d{3})+(?:,\d{2})?\s*(?:€|eur|euros?)?/gi)) {
    addEntity(entities, 'amount', match[0], [match[0]], 4)
  }
  for (const match of query.matchAll(/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g)) {
    addEntity(entities, 'date', match[0], [match[0]], 4)
  }
  for (const match of query.matchAll(/\b\d{4}-\d{4}-\d{4}\b/g)) {
    addEntity(entities, 'document_code', match[0], [match[0]], 9)
  }
  if (/4140-7692-5542/.test(q)) addEntity(entities, 'document_code', '4140-7692-5542', ['4140-7692-5542'], 9)
  if (/4148-6073-6102/.test(q)) addEntity(entities, 'document_code', '4148-6073-6102', ['4148-6073-6102'], 9)
  if (/mpscierredef/.test(q)) addEntity(entities, 'document_code', 'MPSCIERREDEF-2025', ['MPSCIERREDEF-2025', 'MPS CIERRE DEF 2025'], 9)

  return entities
}

function inferProjectScopes(entities: GraphQueryEntity[], projectFilter: string | null): string[] {
  const scopes = projectFilter && PROJECT_IDS.includes(projectFilter as never)
    ? [projectFilter]
    : entities.filter((entity) => entity.kind === 'project').map((entity) => entity.value)
  const hasLegalGroupQuery = entities.some((entity) =>
    entity.kind === 'legal_term' || /pacto|apoderadas|powers/i.test(entity.value)
  )
  if ((scopes.includes('MAD') || scopes.length === 0) && hasLegalGroupQuery) {
    scopes.push('KLP', 'GVF')
  }
  if (entities.some((entity) => entity.value === 'PHILAE')) scopes.push('PHILAE')
  return uniq(scopes.filter((scope) => PROJECT_IDS.includes(scope as never)))
}

function inferDocTypes(entities: GraphQueryEntity[], docTypeFilter: string | null): string[] {
  if (docTypeFilter && DOC_TYPES.includes(docTypeFilter as never)) return [docTypeFilter]
  const out: string[] = []
  if (entities.some((entity) => ['bank', 'counterparty', 'finance_term'].includes(entity.kind) || /financiacion|credito|SH01|loan/i.test(entity.value))) out.push('funding')
  if (entities.some((entity) => entity.kind === 'legal_term')) out.push('legal')
  if (entities.some((entity) => entity.value === 'acta')) out.push('board')
  if (entities.some((entity) => entity.value === 'cuentas')) out.push('financial_statements', 'annual_accounts')
  return uniq(out.filter((docType) => DOC_TYPES.includes(docType as never)))
}

function constrainedProjects(entities: GraphQueryEntity[]): string[] {
  const projects = entities.filter((entity) => entity.kind === 'project').map((entity) => entity.value)
  for (const entity of entities) {
    if (entity.value === 'Buenavista' || entity.value === '4140-7692-5542' || entity.value === '4148-6073-6102') projects.push('MAD')
    if (entity.value === 'SH01 capital call' || entity.value === 'Varia / VSORE III') projects.push('BHX')
  }
  return uniq(projects.filter((project) => PROJECT_IDS.includes(project as never)))
}

function metadataString(row: Record<string, unknown> | null | undefined, key: string): string | null {
  const value = row?.[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function documentText(doc: GraphDocumentRow): string {
  return normalise([
    doc.title,
    doc.project_id,
    doc.doc_type,
    doc.authority_tier,
  ].filter(Boolean).join(' '))
}

function scoreDocument(doc: GraphDocumentRow, entities: GraphQueryEntity[]): number {
  const text = documentText(doc)
  let score = 0
  for (const entity of entities) {
    if (includesAny(text, entity.aliases)) score += entity.weight
  }
  if (doc.review_status === 'approved') score += 3
  if ((doc.authority_score ?? 0) >= 90) score += 3
  else if ((doc.authority_score ?? 0) >= 75) score += 1
  return score
}

function scoreChunk(chunk: GraphChunkRow, doc: GraphDocumentRow, entities: GraphQueryEntity[], query: string): number {
  const text = normalise([
    doc.title,
    chunk.content,
    metadataString(chunk.metadata, 'section'),
  ].filter(Boolean).join(' '))
  let score = scoreDocument(doc, entities) * 0.45
  let matchedKinds = 0
  for (const entity of entities) {
    if (includesAny(text, entity.aliases)) {
      score += entity.weight
      matchedKinds++
    }
  }

  const q = normalise(query)
  const tokens = uniq(q.split(/[^a-z0-9]+/).filter((token) => token.length >= 4))
  score += Math.min(8, tokens.filter((token) => text.includes(token)).length)
  if (matchedKinds >= 2) score += 4
  if (matchedKinds >= 3) score += 4
  if (/euribor|margen|tipo de interes|comision|coste financiero|31[.,]000[.,]000|15[.,]657[.,]498/.test(text)) score += 4
  return score
}

function graphSimilarity(score: number): number {
  return Math.min(0.98, Math.max(0.52, 0.52 + score / 42))
}

async function fetchGraphDocuments(
  supabase: SupabaseClient,
  scopes: string[],
  docTypes: string[],
  maxDocuments: number,
): Promise<GraphDocumentRow[]> {
  const docs = new Map<string, GraphDocumentRow>()
  const scopeValues = scopes.length ? scopes : [null]
  const docTypeValues = docTypes.length ? docTypes : [null]
  const perQueryLimit = Math.max(12, Math.ceil(maxDocuments / Math.max(1, scopeValues.length * docTypeValues.length)))

  for (const scope of scopeValues) {
    for (const docType of docTypeValues) {
      let query = supabase
        .from('rag_documents')
        .select('id,title,project_id,doc_type,review_status,authority_score,authority_tier,classification_source,lifecycle,storage_path,source_channel')
        .eq('status', 'indexed')
        .limit(perQueryLimit)
      if (scope) query = query.eq('project_id', scope)
      if (docType) query = query.eq('doc_type', docType)
      const { data, error } = await query
      if (error) continue
      for (const doc of (data ?? []) as GraphDocumentRow[]) {
        if (!doc.id) continue
        if (doc.review_status === 'rejected' || doc.classification_source === 'agent_rejected') continue
        if (doc.lifecycle === 'superseded') continue
        docs.set(doc.id, doc)
      }
    }
  }

  return Array.from(docs.values())
}

export async function expandDocumentGraph(
  supabase: SupabaseClient,
  query: string,
  opts: GraphExpansionOptions = {},
): Promise<GraphExpansionResult> {
  if (typeof supabase.from !== 'function') return { chunks: [], entities: [], documentIds: [] }
  const projectFilter = opts.projectFilter ?? null
  const docTypeFilter = opts.docTypeFilter ?? null
  const entities = extractGraphQueryEntities(query, { projectFilter })
  if (entities.length === 0) return { chunks: [], entities, documentIds: [] }

  const constrained = constrainedProjects(entities)
  if (projectFilter && constrained.length > 0 && !constrained.includes(projectFilter)) {
    return { chunks: [], entities, documentIds: [] }
  }

  const scopes = inferProjectScopes(entities, projectFilter)
  const docTypes = inferDocTypes(entities, docTypeFilter)
  if (projectFilter && scopes.length === 0) return { chunks: [], entities, documentIds: [] }
  if (docTypeFilter && docTypes.length === 0) return { chunks: [], entities, documentIds: [] }
  if (scopes.length === 0 && docTypes.length === 0) return { chunks: [], entities, documentIds: [] }

  try {
    const docs = (await fetchGraphDocuments(supabase, scopes, docTypes, opts.maxDocuments ?? 90))
      .map((doc) => ({ doc, score: scoreDocument(doc, entities) }))
      .filter(({ score }) => score >= 3 || docTypes.length > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, opts.maxDocuments ?? 32)
      .map(({ doc }) => doc)
    const ids = docs.map((doc) => doc.id)
    if (ids.length === 0) return { chunks: [], entities, documentIds: [] }

    const { data, error } = await supabase.from('rag_chunks')
      .select('id,document_id,content,metadata,chunk_index')
      .in('document_id', ids)
      .order('chunk_index', { ascending: true })
      .limit(opts.maxChunks ?? 1400)
    if (error) return { chunks: [], entities, documentIds: ids }

    const docById = new Map(docs.map((doc) => [doc.id, doc]))
    const scored = ((data ?? []) as GraphChunkRow[])
      .map((chunk) => {
        const doc = docById.get(chunk.document_id)
        if (!doc) return null
        const graphScore = scoreChunk(chunk, doc, entities, query)
        return { chunk, doc, graphScore }
      })
      .filter((row): row is { chunk: GraphChunkRow; doc: GraphDocumentRow; graphScore: number } => !!row && row.graphScore >= 7)
      .sort((a, b) => (b.graphScore - a.graphScore) || ((a.chunk.chunk_index ?? 0) - (b.chunk.chunk_index ?? 0)))
      .slice(0, 28)

    const chunks = scored.map(({ chunk, doc, graphScore }) => ({
      id: chunk.id,
      document_id: chunk.document_id,
      content: chunk.content,
      metadata: {
        ...(chunk.metadata || {}),
        source_file: metadataString(chunk.metadata, 'source_file') ?? doc.title,
        title: metadataString(chunk.metadata, 'title') ?? doc.title,
        project_id: metadataString(chunk.metadata, 'project_id') ?? doc.project_id,
        doc_type: metadataString(chunk.metadata, 'doc_type') ?? doc.doc_type,
        review_status: metadataString(chunk.metadata, 'review_status') ?? doc.review_status,
        classification_source: metadataString(chunk.metadata, 'classification_source') ?? doc.classification_source,
        authority_score: typeof doc.authority_score === 'number' ? doc.authority_score : chunk.metadata?.authority_score,
        authority_tier: metadataString(chunk.metadata, 'authority_tier') ?? doc.authority_tier,
        lifecycle: metadataString(chunk.metadata, 'lifecycle') ?? doc.lifecycle,
        chunk_index: typeof chunk.chunk_index === 'number' ? chunk.chunk_index : chunk.metadata?.chunk_index,
        storage_path: metadataString(chunk.metadata, 'storage_path') ?? doc.storage_path,
        source_channel: metadataString(chunk.metadata, 'source_channel') ?? doc.source_channel,
        retrieval_lane: 'graph',
        graph_score: graphScore,
        graph_entities: entities.map((entity) => `${entity.kind}:${entity.value}`).join('|'),
      },
      similarity: graphSimilarity(graphScore),
    }))

    return { chunks, entities, documentIds: uniq(chunks.map((chunk) => chunk.document_id)) }
  } catch {
    return { chunks: [], entities, documentIds: [] }
  }
}
