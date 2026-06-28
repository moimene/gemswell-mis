import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the two external services so the test is deterministic and offline. The merge/dedup/reject
// logic and the REAL trust-tier sort (rankBySourceTrust) are what we exercise here.
vi.mock('@/lib/rag/embeddings', () => ({
  embedText: vi.fn(async () => new Array(768).fill(0.1)),
}))
vi.mock('@/lib/rag/rerank', () => ({
  // Deterministic reranker: use supplied similarity when a test needs explicit relevance, otherwise
  // preserve input order with descending scores.
  rerankChunks: vi.fn(async (_q: string, chunks: Array<{ id: string; similarity?: number }>) => ({
    chunks: chunks.map((c, i) => ({ ...c, relevanceScore: typeof c.similarity === 'number' ? c.similarity : 1 - i * 0.01 })),
    degraded: false,
  })),
}))
vi.mock('@/lib/rag/openai-rerank', () => ({
  rerankRetrievedChunksWithOpenAI: vi.fn(async (_q: string, chunks: unknown[]) => ({
    chunks,
    used: false,
    model: null,
  })),
}))

import {
  retrieveDocuments,
  isRejectedSource,
  isExcludedFromRetrieval,
  emptyResultMessage,
  fusePool,
  applyRelevanceFloor,
  isAllowedByGroundingMode,
  expandRetrievalQuery,
  metadataRelevanceBoost,
  RAG_KEYWORD_MATCH_COUNT,
  RAG_VECTOR_MATCH_COUNT,
} from '@/lib/rag/retrieve'
import { rerankRetrievedChunksWithOpenAI } from '@/lib/rag/openai-rerank'

type Row = { id: string; document_id: string; content: string; metadata: Record<string, unknown>; similarity?: number; rank?: number }
type DocRow = Record<string, unknown> & { id: string; title?: string; project_id?: string; doc_type?: string }

function fakeSupabase(vectorRows: Row[], keywordRows: Row[]) {
  // 2nd param typed so `.mock.calls[i][1]` (the RPC args object) is type-safe in assertions below.
  const rpc = vi.fn(async (name: string, params?: Record<string, unknown>) => {
    void params
    if (name === 'match_chunks') return { data: vectorRows, error: null }
    if (name === 'keyword_search_chunks') return { data: keywordRows, error: null }
    return { data: [], error: null }
  })
  return { client: { rpc } as never, rpc }
}

function fakeSupabaseWithTables(vectorRows: Row[], keywordRows: Row[], docs: DocRow[], chunks: Row[]) {
  const { rpc } = fakeSupabase(vectorRows, keywordRows)
  const from = vi.fn((table: string) => {
    const state = {
      eq: [] as Array<[string, unknown]>,
      in: null as [string, unknown[]] | null,
      ilike: null as [string, string] | null,
      limit: null as number | null,
    }
    const query: Record<string, unknown> = {}
    query.select = vi.fn(() => query)
    query.eq = vi.fn((column: string, value: unknown) => { state.eq.push([column, value]); return query })
    query.in = vi.fn((column: string, values: unknown[]) => { state.in = [column, values]; return query })
    query.ilike = vi.fn((column: string, pattern: string) => { state.ilike = [column, pattern]; return query })
    query.or = vi.fn(() => query)
    query.order = vi.fn(() => query)
    query.limit = vi.fn((value: number) => { state.limit = value; return query })
    query.then = (resolve: (value: { data: unknown[]; error: null }) => unknown, reject: (reason: unknown) => unknown) => {
      let data: unknown[] = table === 'rag_documents' ? docs : chunks
      for (const [column, value] of state.eq) data = data.filter((row) => (row as Record<string, unknown>)[column] === value)
      if (state.in) {
        const [column, values] = state.in
        const allowed = new Set(values)
        data = data.filter((row) => allowed.has((row as Record<string, unknown>)[column]))
      }
      if (state.ilike) {
        const [column, pattern] = state.ilike
        const re = new RegExp(`^${pattern.replace(/%/g, '.*')}$`, 'i')
        data = data.filter((row) => re.test(String((row as Record<string, unknown>)[column] ?? '')))
      }
      if (state.limit != null) data = data.slice(0, state.limit)
      return Promise.resolve({ data, error: null }).then(resolve, reject)
    }
    return query
  })
  return { client: { rpc, from } as never, rpc, from }
}

const approved = { authority_score: 95, review_status: 'approved', classification_source: 'human' }

beforeEach(() => {
  vi.clearAllMocks()
  ;(rerankRetrievedChunksWithOpenAI as ReturnType<typeof vi.fn>).mockImplementation(async (_q: string, chunks: unknown[]) => ({
    chunks,
    used: false,
    model: null,
  }))
})

describe('retrieveDocuments', () => {
  it('merges + dedups vector and keyword pools and counts overlap', async () => {
    const vector: Row[] = [
      { id: 'a', document_id: 'da', content: 'alpha', metadata: {}, similarity: 0.9 },
      { id: 'b', document_id: 'db', content: 'beta', metadata: {}, similarity: 0.8 },
    ]
    const keyword: Row[] = [
      { id: 'b', document_id: 'db', content: 'beta', metadata: {}, rank: 0.5 }, // overlap
      { id: 'c', document_id: 'dc', content: 'gamma', metadata: {}, rank: 0.4 },
    ]
    const { client } = fakeSupabase(vector, keyword)
    const { ranked, diagnostics } = await retrieveDocuments(client, 'q')
    expect(diagnostics.vectorCount).toBe(2)
    expect(diagnostics.keywordCount).toBe(2)
    expect(diagnostics.poolCount).toBe(3) // a, b, c (b deduped)
    expect(diagnostics.overlapCount).toBe(1) // b in both
    expect(diagnostics.vectorFailed).toBe(false) // a successful lane is NEVER failed
    expect(diagnostics.keywordFailed).toBe(false)
    expect(ranked.map((c) => c.id).sort()).toEqual(['a', 'b', 'c'])
  })

  it('drops rejected sources from the pool', async () => {
    const vector: Row[] = [
      { id: 'a', document_id: 'da', content: 'ok', metadata: {}, similarity: 0.9 },
      { id: 'x', document_id: 'dx', content: 'rejected', metadata: { review_status: 'rejected' }, similarity: 0.95 },
    ]
    const { client } = fakeSupabase(vector, [])
    const { ranked, diagnostics } = await retrieveDocuments(client, 'q')
    expect(diagnostics.poolCount).toBe(1)
    expect(ranked.map((c) => c.id)).toEqual(['a'])
  })

  it('returns empty ranked + poolCount 0 when nothing is retrieved', async () => {
    const { client } = fakeSupabase([], [])
    const { ranked, diagnostics } = await retrieveDocuments(client, 'q')
    expect(ranked).toEqual([])
    expect(diagnostics.poolCount).toBe(0)
    // A clean no-match is NOT an outage: both lanes ran and returned empty.
    expect(diagnostics.vectorFailed).toBe(false)
    expect(diagnostics.keywordFailed).toBe(false)
  })

  it('lets trust tier override ordinary/moderate Cohere relevance', async () => {
    // Standard mode still allows trust to lead when relevance is in the ordinary range.
    const vector: Row[] = [
      { id: 'lowtrust', document_id: 'd1', content: 'moderate relevance, no governance', metadata: {}, similarity: 0.49 },
      { id: 'highauth', document_id: 'd2', content: 'authoritative', metadata: approved, similarity: 0.4 },
    ]
    const { client } = fakeSupabase(vector, [])
    const { ranked } = await retrieveDocuments(client, 'q')
    expect(ranked[0].id).toBe('highauth')
  })

  it('boosts exact metadata title/source-file matches after rerank', async () => {
    const vector: Row[] = [
      { id: 'decoy', document_id: 'd1', content: 'loan agreement sibling', metadata: { ...approved, project_id: 'KLP', doc_type: 'legal', source_file: 'USCL WPH Signed Loan Agreement.pdf' }, similarity: 0.8 },
      { id: 'exact', document_id: 'd2', content: 'loan agreement target', metadata: { ...approved, project_id: 'BHX', doc_type: 'funding', source_file: 'Signed Loan Agreement .pdf' }, similarity: 0.74 },
    ]
    const { client } = fakeSupabase(vector, [])
    const { ranked } = await retrieveDocuments(client, 'signed Birmingham Wave Park loan agreement lender borrower')
    expect(ranked[0].id).toBe('exact')
  })

  it('promotes WPH SH01 company-number chunks over generic capital-call memos', async () => {
    const vector: Row[] = [
      { id: 'memo', document_id: 'd1', content: 'Birmingham phase memo capital call subscription shares Wave Park Holdings', metadata: { ...approved, project_id: 'BHX', doc_type: 'funding', source_file: '20250808_Memo Phase 7_Birmingham.docx' }, similarity: 0.88 },
      { id: 'sh01', document_id: 'd2', content: 'Company number 1 5 3 2 6 3 3 3 Company name in full WAVE PARK HOLDINGS (WARWICKSHIRE) LTD', metadata: { ...approved, project_id: 'BHX', doc_type: 'funding', source_file: 'SH01 - Phase 6.2 Cap Call - for signature.pdf' }, similarity: 0.62 },
    ]
    const { client } = fakeSupabase(vector, [])
    const { ranked } = await retrieveDocuments(client, 'capital calls company number', { projectFilter: 'BHX' })
    expect(ranked[0].id).toBe('sh01')
  })

  it('promotes the Buenavista participative-credit contract over generic Buenavista funding noise', async () => {
    const vector: Row[] = [
      {
        id: 'disposition',
        document_id: 'd1',
        content: 'Solicitud de disposicion para Buenavista Nextgen Urbano con cuadro operativo sin importe maximo contractual.',
        metadata: { ...approved, project_id: 'MAD', doc_type: 'funding', source_file: 'Solicitud disposicion Buenavista.pdf' },
        similarity: 0.89,
      },
      {
        id: 'contract',
        document_id: 'd2',
        content: 'Contrato de Credito Participativo. Entidad Acreditante: Buenavista Nextgen Urbano. Importe maximo: 15.657.498,18 euros.',
        metadata: { ...approved, project_id: 'MAD', doc_type: 'funding', source_file: '4148-6073-6102 v 1, 1.- MPS_Contrato de Credito Participativo (Buenavista)_vFF.pdf' },
        similarity: 0.52,
      },
    ]
    const { client } = fakeSupabase(vector, [])
    const { ranked } = await retrieveDocuments(client, 'Como es la financiacion de Buenvista?')
    expect(ranked[0].id).toBe('contract')
  })

  it('promotes the Santander/BBVA senior financing contract cost clauses over mandate noise', async () => {
    const vector: Row[] = [
      {
        id: 'mandate',
        document_id: 'd1',
        content: 'Carta de mandato Santander para estructuracion y coordinacion de una potencial financiacion bancaria.',
        metadata: { ...approved, project_id: 'MAD', doc_type: 'funding', source_file: 'Mandato Madrid Playa Surf.docx' },
        similarity: 0.89,
      },
      {
        id: 'contract-cost',
        document_id: 'd2',
        content: 'Tipo de Interes Ordinario: Indice de Referencia EURIBOR mas Margen. El Margen es 4,00% anual.',
        metadata: { ...approved, project_id: 'MAD', doc_type: 'funding', source_file: '4140-7692-5542 v 1, Piscina de Olas - Contrato de financiacion (vfinal).pdf' },
        similarity: 0.52,
      },
    ]
    const { client } = fakeSupabase(vector, [])
    const { ranked } = await retrieveDocuments(client, 'cual es para mps el coste de la financiacion bancaria del prestamo santander y bbva?')
    expect(ranked[0].id).toBe('contract-cost')
  })

  it('preserves storage_path metadata on Buenavista supplemental chunks', async () => {
    const docs: DocRow[] = [{
      id: 'doc-bv',
      title: '4148-6073-6102 v 1, 1.- MPS_Contrato de Credito Participativo (Buenavista)_vFF.pdf',
      project_id: 'MAD',
      doc_type: 'funding',
      status: 'indexed',
      review_status: 'approved',
      authority_score: 95,
      storage_path: 'uploads/doc-bv/original.pdf',
      source_channel: 'upload',
    }]
    const chunks: Row[] = [{
      id: 'chunk-bv',
      document_id: 'doc-bv',
      content: 'Contrato de Credito Participativo. Entidad Acreditante: Buenavista Nextgen Urbano. Importe maximo: 15.657.498,18 euros.',
      metadata: {},
    }]
    const { client } = fakeSupabaseWithTables([], [], docs, chunks)
    const { ranked } = await retrieveDocuments(client, 'Como es la financiacion de Buenvista?')
    expect(ranked[0].metadata.storage_path).toBe('uploads/doc-bv/original.pdf')
    expect(ranked[0].metadata.source_channel).toBe('upload')
  })

  it('preserves metadata on Santander/BBVA senior financing supplemental cost chunks', async () => {
    const docs: DocRow[] = [{
      id: 'doc-bank',
      title: '4140-7692-5542 v 1, Piscina de Olas - Contrato de financiacion (vfinal).pdf',
      project_id: 'MAD',
      doc_type: 'funding',
      status: 'indexed',
      review_status: 'approved',
      authority_score: 95,
      storage_path: 'uploads/doc-bank/original.pdf',
      source_channel: 'manual_admin',
    }]
    const chunks: Row[] = [{
      id: 'chunk-bank',
      document_id: 'doc-bank',
      content: 'Tipo de Interes Ordinario: Indice de Referencia Principal EURIBOR mas Margen. El Margen es 4,00% anual.',
      metadata: {},
    }]
    const { client } = fakeSupabaseWithTables([], [], docs, chunks)
    const { ranked } = await retrieveDocuments(client, 'coste financiacion bancaria MPS Santander BBVA')
    expect(ranked[0].id).toBe('chunk-bank')
    expect(ranked[0].metadata.storage_path).toBe('uploads/doc-bank/original.pdf')
    expect(ranked[0].metadata.source_channel).toBe('manual_admin')
  })

  it('uses graph expansion as a third retrieval lane when vector and keyword miss', async () => {
    const docs: DocRow[] = [{
      id: 'doc-bank',
      title: '4140-7692-5542 v 1, Piscina de Olas - Contrato de financiacion (vfinal).pdf',
      project_id: 'MAD',
      doc_type: 'funding',
      status: 'indexed',
      review_status: 'approved',
      authority_score: 95,
      classification_source: 'agent_reviewed',
      source_channel: 'manual_admin',
    }]
    const chunks: Row[] = [{
      id: 'chunk-graph-cost',
      document_id: 'doc-bank',
      content: 'Tipo de Interes Ordinario: EURIBOR mas Margen 4,00%. Entidades financiadoras Banco Santander y BBVA.',
      metadata: {},
    }]
    const { client } = fakeSupabaseWithTables([], [], docs, chunks)
    const { ranked, diagnostics } = await retrieveDocuments(client, 'coste financiacion bancaria MPS Santander BBVA EURIBOR margen', {
      projectFilter: 'MAD',
      docTypeFilter: 'funding',
      modelRerank: false,
    })

    expect(diagnostics.vectorCount).toBe(0)
    expect(diagnostics.keywordCount).toBe(0)
    expect(diagnostics.graphCount).toBe(1)
    expect(diagnostics.graphEntities).toContain('bank:BBVA')
    expect(ranked[0].id).toBe('chunk-graph-cost')
    expect(ranked[0].metadata.retrieval_lane).toBe('graph')
  })

  it('uses the OpenAI chunk reranker before final trust-aware ranking when enabled', async () => {
    const vector: Row[] = [
      { id: 'weak', document_id: 'd1', content: 'generic financing mention', metadata: approved, similarity: 0.9 },
      { id: 'strong', document_id: 'd2', content: 'EURIBOR margen 4,00 coste financiero exacto', metadata: approved, similarity: 0.4 },
    ]
    ;(rerankRetrievedChunksWithOpenAI as ReturnType<typeof vi.fn>).mockImplementationOnce(async (_q: string, chunks: Array<Row & { relevanceScore: number }>) => ({
      chunks: [
        { ...chunks.find((chunk) => chunk.id === 'strong')!, relevanceScore: 0.99, metadata: { ...chunks.find((chunk) => chunk.id === 'strong')!.metadata, reranked_by: 'openai' } },
        { ...chunks.find((chunk) => chunk.id === 'weak')!, relevanceScore: 0.2, metadata: { ...chunks.find((chunk) => chunk.id === 'weak')!.metadata, reranked_by: 'openai' } },
      ],
      used: true,
      model: 'gpt-5.5',
    }))

    const { client } = fakeSupabase(vector, [])
    const { ranked, diagnostics } = await retrieveDocuments(client, 'coste financiero EURIBOR margen', { modelRerank: true })

    expect(ranked[0].id).toBe('strong')
    expect(ranked[0].metadata.reranked_by).toBe('openai')
    expect(diagnostics.modelRerankUsed).toBe(true)
    expect(diagnostics.modelRerankModel).toBe('gpt-5.5')
  })

  it('does not add Buenavista supplemental chunks under an incompatible explicit project filter', async () => {
    const { client, from } = fakeSupabaseWithTables([], [], [], [])
    const { ranked } = await retrieveDocuments(client, 'Como es la financiacion de Buenvista?', { projectFilter: 'BHX' })
    expect(ranked).toEqual([])
    expect(from).not.toHaveBeenCalled()
  })

  it('does not add Santander/BBVA senior financing supplemental chunks under an incompatible explicit project filter', async () => {
    const { client, from } = fakeSupabaseWithTables([], [], [], [])
    const { ranked } = await retrieveDocuments(client, 'coste financiacion bancaria MPS Santander BBVA', { projectFilter: 'BHX' })
    expect(ranked).toEqual([])
    expect(from).not.toHaveBeenCalled()
  })

  it('keeps a high-relevance unreviewed exact match in the final top-k in standard mode', async () => {
    const trustedNoise: Row[] = Array.from({ length: 12 }, (_, i) => ({
      id: `trusted-${i}`,
      document_id: `dt-${i}`,
      content: `approved but weakly related ${i}`,
      metadata: approved,
      similarity: 0.08,
    }))
    const vector: Row[] = [
      ...trustedNoise,
      {
        id: 'new-upload',
        document_id: 'du',
        content: 'unique beta upload token',
        metadata: { review_status: 'needs_review', classification_source: 'rule', authority_score: 0 },
        similarity: 0.91,
      },
    ]
    const { client } = fakeSupabase(vector, [])
    const { ranked, diagnostics } = await retrieveDocuments(client, 'unique beta upload token')
    expect(ranked[0].id).toBe('new-upload')
    expect(ranked.map(c => c.id)).toContain('new-upload')
    expect(diagnostics.unreviewedUsed).toBe(1)
  })

  it('passes filters + threshold to the RPCs', async () => {
    const { client, rpc } = fakeSupabase([], [])
    await retrieveDocuments(client, 'q', { projectFilter: 'MAD', docTypeFilter: 'legal' })
    const matchCall = rpc.mock.calls.find((c) => c[0] === 'match_chunks')
    const kwCall = rpc.mock.calls.find((c) => c[0] === 'keyword_search_chunks')
    expect(matchCall?.[1]).toMatchObject({ filter_project: 'MAD', filter_doc_type: 'legal', match_threshold: 0.18 })
    expect(kwCall?.[1]).toMatchObject({ filter_project: 'MAD', filter_doc_type: 'legal' })
  })

  it('bypasses the scoped vector lane for deterministic Santander/BBVA bank-cost retrieval', async () => {
    const { client, rpc } = fakeSupabase([], [])
    const { diagnostics } = await retrieveDocuments(client, 'coste financiacion bancaria MPS Santander BBVA', { projectFilter: 'MAD', docTypeFilter: 'funding' })
    expect(rpc.mock.calls.some((c) => c[0] === 'match_chunks')).toBe(false)
    expect(rpc.mock.calls.some((c) => c[0] === 'keyword_search_chunks')).toBe(true)
    expect(diagnostics.vectorFailed).toBe(false)
  })

  it('expands high-value document aliases before calling vector and keyword RPCs', async () => {
    const { client, rpc } = fakeSupabase([], [])
    await retrieveDocuments(client, '¿Cuál es el total activo del balance de Madrid Playa Surf a cierre de 2025?')
    const matchCall = rpc.mock.calls.find((c) => c[0] === 'match_chunks')
    const kwCall = rpc.mock.calls.find((c) => c[0] === 'keyword_search_chunks')
    expect(String(kwCall?.[1]?.query_text)).toContain('MPSCIERREDEF-2025')
    expect(matchCall?.[1]?.query_embedding).toHaveLength(768)
  })

  it('over-extracts before app-layer strict grounding filters', async () => {
    const { client, rpc } = fakeSupabase([], [])
    await retrieveDocuments(client, 'q', { groundingMode: 'official_only' })
    const matchCall = rpc.mock.calls.find((c) => c[0] === 'match_chunks')
    const kwCall = rpc.mock.calls.find((c) => c[0] === 'keyword_search_chunks')
    expect(matchCall?.[1]).toMatchObject({ match_count: Math.min(RAG_VECTOR_MATCH_COUNT * 4, 100) })
    expect(kwCall?.[1]).toMatchObject({ match_count: Math.min(RAG_KEYWORD_MATCH_COUNT * 4, 80) })
  })
})

describe('expandRetrievalQuery', () => {
  it('adds Madrid 2025 closing-account aliases for balance questions', () => {
    expect(expandRetrievalQuery('total activo del balance de Madrid Playa Surf a cierre de 2025')).toContain('MPSCIERREDEF-2025')
  })

  it('adds Birmingham SH01 aliases for cap-call entity questions', () => {
    expect(expandRetrievalQuery('Which legal entity issues the Birmingham cap calls and what is its company number?')).toContain('SH01')
  })

  it('uses project scope to add Birmingham aliases when the query is terse', () => {
    const expanded = expandRetrievalQuery('capital calls company number', { projectFilter: 'BHX' })
    expect(expanded).toContain('SH01')
    expect(expanded).toContain('Wave Park Holdings Warwickshire')
  })

  it('adds Birmingham signed-loan aliases for lender/borrower questions', () => {
    const expanded = expandRetrievalQuery('Who is the lender and borrower in the Birmingham loan agreement?')
    expect(expanded).toContain('Signed Loan Agreement')
    expect(expanded).toContain('Varia Structured Opportunities')
  })

  it('adds Madrid quincenal aliases even when the question omits Madrid', () => {
    expect(expandRetrievalQuery('capital call de diciembre de 2024 en la reunión quincenal')).toContain('13-12-2024')
  })

  it('adds exact legal-document aliases for shareholders agreements and powers of attorney', () => {
    const expanded = expandRetrievalQuery('¿Dónde están documentados el pacto de socios y las personas apoderadas?')
    expect(expanded).toContain('29.06.2023 Escritura elevacion a publico Pacto de Socios MPS')
    expect(expanded).toContain('PERSONAS APODERADAS.docx')
  })

  it('adds Buenavista participative-credit aliases for misspelled financing questions', () => {
    const expanded = expandRetrievalQuery('Como es la financiacion de Buenvista?')
    expect(expanded).toContain('Buenavista Nextgen Urbano')
    expect(expanded).toContain('credito participativo')
  })

  it('adds Santander/BBVA senior financing aliases for MPS bank-cost questions', () => {
    const expanded = expandRetrievalQuery('cual es para mps el coste de la financiacion bancaria del prestamo santander y bbva?')
    expect(expanded).toContain('4140-7692-5542')
    expect(expanded).toContain('Tipo de Interes Ordinario')
    expect(expanded).toContain('EURIBOR')
  })

  it('leaves unrelated queries unchanged', () => {
    expect(expandRetrievalQuery('resumen operativo semanal')).toBe('resumen operativo semanal')
  })
})

describe('metadataRelevanceBoost', () => {
  it('boosts exact source_file aliases and project/type hints', () => {
    const boost = metadataRelevanceBoost('signed Birmingham Wave Park loan agreement lender borrower', {
      source_file: 'Signed Loan Agreement .pdf',
      project_id: 'BHX',
      doc_type: 'funding',
    })
    expect(boost).toBeGreaterThanOrEqual(0.18)

    const decoyBoost = metadataRelevanceBoost('signed Birmingham Wave Park loan agreement lender borrower', {
      source_file: 'USCL WPH Signed Loan Agreement.pdf',
      project_id: 'KLP',
      doc_type: 'legal',
    })
    expect(decoyBoost).toBeLessThan(boost)
  })

  it('strongly boosts exact Buenavista participative-credit contract metadata', () => {
    const boost = metadataRelevanceBoost('Como es la financiacion de Buenvista?', {
      source_file: '4148-6073-6102 v 1, 1.- MPS_Contrato de Credito Participativo (Buenavista)_vFF.pdf',
      project_id: 'MAD',
      doc_type: 'funding',
    })
    const decoyBoost = metadataRelevanceBoost('Como es la financiacion de Buenvista?', {
      source_file: 'Solicitud disposicion Buenavista.pdf',
      project_id: 'MAD',
      doc_type: 'funding',
    })
    expect(boost).toBeGreaterThanOrEqual(0.6)
    expect(decoyBoost).toBeLessThan(boost)
  })

  it('strongly boosts exact Santander/BBVA senior bank financing contract metadata', () => {
    const boost = metadataRelevanceBoost('coste financiacion bancaria MPS Santander BBVA EURIBOR margen', {
      source_file: '4140-7692-5542 v 1, Piscina de Olas - Contrato de financiacion (vfinal).pdf',
      project_id: 'MAD',
      doc_type: 'funding',
    })
    const decoyBoost = metadataRelevanceBoost('coste financiacion bancaria MPS Santander BBVA EURIBOR margen', {
      source_file: 'Mandato Madrid Playa Surf.docx',
      project_id: 'MAD',
      doc_type: 'funding',
    })
    expect(boost).toBeGreaterThanOrEqual(0.62)
    expect(decoyBoost).toBeLessThan(boost)
  })

  it('does not boost unrelated metadata', () => {
    expect(metadataRelevanceBoost('resumen operativo semanal', { source_file: 'Anything.pdf', project_id: 'MAD' })).toBe(0)
  })
})

describe('isRejectedSource', () => {
  it('flags rejected review_status and agent_rejected classification', () => {
    expect(isRejectedSource({ review_status: 'rejected' })).toBe(true)
    expect(isRejectedSource({ classification_source: 'agent_rejected' })).toBe(true)
    expect(isRejectedSource({ review_status: 'approved' })).toBe(false)
    expect(isRejectedSource({})).toBe(false)
    expect(isRejectedSource(undefined)).toBe(false)
  })
})

// ─── Fase 0 (audit 2026-06-07) — governance gate + degradation visibility ────
describe('isExcludedFromRetrieval', () => {
  it('excludes rejected, agent_rejected and superseded — but NOT needs_review (fallback policy)', () => {
    expect(isExcludedFromRetrieval({ review_status: 'rejected' })).toBe(true)
    expect(isExcludedFromRetrieval({ classification_source: 'agent_rejected' })).toBe(true)
    expect(isExcludedFromRetrieval({ lifecycle: 'superseded' })).toBe(true)
    // needs_review stays retrievable (the chat keeps it as a fallback, ranked below approved)
    expect(isExcludedFromRetrieval({ review_status: 'needs_review' })).toBe(false)
    expect(isExcludedFromRetrieval({ review_status: 'approved' })).toBe(false)
    expect(isExcludedFromRetrieval({})).toBe(false)
    expect(isExcludedFromRetrieval(undefined)).toBe(false)
  })
})

describe('retrieveDocuments — superseded exclusion + degradation diagnostics', () => {
  it('drops superseded chunks from the pool (defense-in-depth over the RPC filter)', async () => {
    const vector: Row[] = [
      { id: 'a', document_id: 'da', content: 'current', metadata: { review_status: 'approved' }, similarity: 0.9 },
      { id: 's', document_id: 'ds', content: 'old revision', metadata: { lifecycle: 'superseded' }, similarity: 0.95 },
    ]
    const { client } = fakeSupabase(vector, [])
    const { ranked, diagnostics } = await retrieveDocuments(client, 'q')
    expect(ranked.map((c) => c.id)).toEqual(['a'])
    expect(diagnostics.poolCount).toBe(1)
  })

  it('flags vectorFailed when the vector RPC throws, keeping the keyword lane alive', async () => {
    const rpc = vi.fn(async (name: string) => {
      if (name === 'match_chunks') throw new Error('429 rate limit')
      if (name === 'keyword_search_chunks') {
        return { data: [{ id: 'k', document_id: 'dk', content: 'kw', metadata: { review_status: 'approved' }, rank: 0.5 }], error: null }
      }
      return { data: [], error: null }
    })
    const { ranked, diagnostics } = await retrieveDocuments({ rpc } as never, 'q')
    expect(diagnostics.vectorFailed).toBe(true)
    expect(diagnostics.keywordFailed).toBe(false)
    expect(ranked.map((c) => c.id)).toEqual(['k'])
  })

  it('flags keywordFailed when the keyword RPC throws', async () => {
    const rpc = vi.fn(async (name: string) => {
      if (name === 'keyword_search_chunks') throw new Error('statement timeout')
      if (name === 'match_chunks') {
        return { data: [{ id: 'v', document_id: 'dv', content: 'vec', metadata: { review_status: 'approved' }, similarity: 0.9 }], error: null }
      }
      return { data: [], error: null }
    })
    const { diagnostics } = await retrieveDocuments({ rpc } as never, 'q')
    expect(diagnostics.keywordFailed).toBe(true)
    expect(diagnostics.vectorFailed).toBe(false)
  })

  it('flags vectorFailed when the vector RPC RETURNS a PostgREST error (does NOT throw)', async () => {
    // supabase-js .rpc() resolves to { data, error } on a server error (e.g. statement timeout) WITHOUT
    // throwing — the exact silent-degradation mode that killed retrieval in prod twice. Must set failed.
    const rpc = vi.fn(async (name: string) => {
      if (name === 'match_chunks') return { data: null, error: { message: 'canceling statement due to statement timeout' } }
      if (name === 'keyword_search_chunks') {
        return { data: [{ id: 'k', document_id: 'dk', content: 'kw', metadata: { review_status: 'approved' }, rank: 0.5 }], error: null }
      }
      return { data: [], error: null }
    })
    const { ranked, diagnostics } = await retrieveDocuments({ rpc } as never, 'q')
    expect(diagnostics.vectorFailed).toBe(true)
    expect(diagnostics.keywordFailed).toBe(false)
    expect(ranked.map((c) => c.id)).toEqual(['k'])
  })

  it('trusted_only withholds unreviewed chunks before rerank', async () => {
    const vector: Row[] = [
      { id: 'nr', document_id: 'd1', content: 'unreviewed', metadata: { review_status: 'needs_review', authority_score: 99 }, similarity: 0.99 },
      { id: 'ok', document_id: 'd2', content: 'reviewed supporting', metadata: { review_status: 'approved', authority_score: 80, classification_source: 'agent_reviewed' }, similarity: 0.5 },
    ]
    const { client } = fakeSupabase(vector, [])
    const { ranked, diagnostics } = await retrieveDocuments(client, 'q', { groundingMode: 'trusted_only' })
    expect(ranked.map(c => c.id)).toEqual(['ok'])
    expect(diagnostics.groundingFilteredCount).toBe(1)
    expect(diagnostics.unreviewedUsed).toBe(0)
  })

  it('official_only keeps only source-of-record evidence', async () => {
    const vector: Row[] = [
      { id: 'supporting', document_id: 'd1', content: 'approved but not official', metadata: { review_status: 'approved', authority_score: 80, classification_source: 'agent_reviewed' }, similarity: 0.99 },
      { id: 'official', document_id: 'd2', content: 'official', metadata: approved, similarity: 0.5 },
    ]
    const { client } = fakeSupabase(vector, [])
    const { ranked, diagnostics } = await retrieveDocuments(client, 'q', { groundingMode: 'official_only' })
    expect(ranked.map(c => c.id)).toEqual(['official'])
    expect(diagnostics.groundingFilteredCount).toBe(1)
  })

  it('counts unreviewedUsed = needs_review/pending chunks in the FINAL ranked set', async () => {
    const vector: Row[] = [
      { id: 'ap', document_id: 'd1', content: 'approved', metadata: { review_status: 'approved', authority_score: 80 }, similarity: 0.9 },
      { id: 'nr', document_id: 'd2', content: 'unreviewed', metadata: { review_status: 'needs_review' }, similarity: 0.8 },
    ]
    const { client } = fakeSupabase(vector, [])
    const { ranked, diagnostics } = await retrieveDocuments(client, 'q')
    expect(ranked.map((c) => c.id)).toEqual(['ap', 'nr']) // approved leads, unreviewed is fallback
    expect(diagnostics.unreviewedUsed).toBe(1)
  })
})

describe('isAllowedByGroundingMode', () => {
  it('maps standard/trusted/official to governance tiers', () => {
    expect(isAllowedByGroundingMode({ review_status: 'needs_review', authority_score: 100 }, 'standard')).toBe(true)
    expect(isAllowedByGroundingMode({ review_status: 'needs_review', authority_score: 100 }, 'trusted_only')).toBe(false)
    expect(isAllowedByGroundingMode({ review_status: 'approved', authority_score: 80, classification_source: 'human' }, 'trusted_only')).toBe(true)
    expect(isAllowedByGroundingMode({ review_status: 'approved', authority_score: 80, classification_source: 'human' }, 'official_only')).toBe(false)
    expect(isAllowedByGroundingMode(approved, 'official_only')).toBe(true)
  })
})

// ─── Fase 2 (audit master plan WS1) — RRF fusion + relevance floor ───────────
describe('fusePool (Reciprocal Rank Fusion)', () => {
  const row = (id: string, meta: Record<string, unknown> = {}): Row =>
    ({ id, document_id: 'd' + id, content: id, metadata: meta, similarity: 0.9 })
  const cfg = { k: 60, wVector: 1, wKeyword: 1 }

  it('rrf gives a both-lane chunk a higher fused score than an equal-rank single-lane chunk', () => {
    const vector = [row('a'), row('b')] // a=vrank1, b=vrank2
    const keyword = [row('b'), row('c')] // b=krank1, c=krank2
    const { pool, overlapCount } = fusePool(vector, keyword, { ...cfg, mode: 'rrf' })
    expect(overlapCount).toBe(1) // b in both
    const score = Object.fromEntries(pool.map((p) => [p.id, p.fusedScore ?? 0]))
    // b: 1/(60+2)+1/(60+1); a: 1/(60+1) only → b > a (the agreement boost)
    expect(score['b']).toBeGreaterThan(score['a'])
    expect(pool[0].id).toBe('b') // rrf sorts pool by fusedScore desc
  })

  it('vector_first preserves the legacy order and drops excluded sources', () => {
    const vector = [row('a'), row('x', { lifecycle: 'superseded' })]
    const keyword = [row('c'), row('a')] // a overlaps
    const { pool } = fusePool(vector, keyword, { ...cfg, mode: 'vector_first' })
    expect(pool.map((p) => p.id)).toEqual(['a', 'c']) // superseded x dropped; vector-first order
  })

  it('computes RRF ranks over ALLOWED rows only — an excluded row does not consume a rank slot', () => {
    const vector = [row('x', { lifecycle: 'superseded' }), row('a')] // x excluded; a is rank 1 among allowed
    const keyword = [row('a')]
    const { pool } = fusePool(vector, keyword, { ...cfg, mode: 'rrf' })
    expect(pool.map((p) => p.id)).toEqual(['a'])
    expect(pool[0].fusedScore).toBeCloseTo(2 / 61, 6) // a is vrank1 + krank1 → 1/61 + 1/61
  })
})

describe('applyRelevanceFloor', () => {
  const c = (id: string, relevanceScore: number) => ({ id, document_id: 'd', content: '', metadata: {}, relevanceScore })
  it('drops chunks below the floor', () => {
    expect(applyRelevanceFloor([c('a', 0.8), c('b', 0.2)], 0.5).map((x) => x.id)).toEqual(['a'])
  })
  it('floor 0 is a no-op (recall-first default)', () => {
    const arr = [c('a', 0.1), c('b', 0.05)]
    expect(applyRelevanceFloor(arr, 0)).toEqual(arr)
  })
  it('never empties a non-empty set — keeps the single best chunk', () => {
    expect(applyRelevanceFloor([c('a', 0.3), c('b', 0.1)], 0.9).map((x) => x.id)).toEqual(['a'])
  })
  it('protects flagged chunks even when below the floor (trust beats relevance, F1)', () => {
    // 'hi' is below the 0.5 floor but protected (e.g. high trust tier) → survives; 'lo' is dropped.
    const out = applyRelevanceFloor([c('hi', 0.2), c('lo', 0.1)], 0.5, (x) => x.id === 'hi')
    expect(out.map((x) => x.id)).toEqual(['hi'])
  })
})

describe('emptyResultMessage', () => {
  it('signals an outage (NOT governance) when a retrieval lane failed', () => {
    const msg = emptyResultMessage({ vectorFailed: true, keywordFailed: false } as never)
    expect(msg).toMatch(/unavailable|degraded|partial|temporar/i)
    expect(msg).not.toMatch(/rejected/i)
  })
  it('says no relevant documents (neutral) when both lanes ran and found nothing', () => {
    const msg = emptyResultMessage({ vectorFailed: false, keywordFailed: false } as never)
    expect(msg).toMatch(/no relevant documents/i)
    expect(msg).not.toMatch(/rejected/i)
  })
})
