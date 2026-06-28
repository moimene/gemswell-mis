import { describe, expect, it, vi } from 'vitest'
import { expandDocumentGraph, extractGraphQueryEntities } from '@/lib/rag/graph'

type DocRow = Record<string, unknown> & { id: string }
type ChunkRow = Record<string, unknown> & { id: string; document_id: string }

function fakeSupabase(docs: DocRow[], chunks: ChunkRow[]) {
  const from = vi.fn((table: string) => {
    const state = {
      eq: [] as Array<[string, unknown]>,
      in: null as [string, unknown[]] | null,
      limit: null as number | null,
    }
    const query: Record<string, unknown> = {}
    query.select = vi.fn(() => query)
    query.eq = vi.fn((column: string, value: unknown) => { state.eq.push([column, value]); return query })
    query.in = vi.fn((column: string, values: unknown[]) => { state.in = [column, values]; return query })
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
      if (state.limit != null) data = data.slice(0, state.limit)
      return Promise.resolve({ data, error: null }).then(resolve, reject)
    }
    return query
  })
  return { client: { from } as never, from }
}

describe('extractGraphQueryEntities', () => {
  it('extracts project, bank and finance entities for Santander/BBVA bank-cost questions', () => {
    const entities = extractGraphQueryEntities('coste financiacion bancaria MPS Santander BBVA EURIBOR margen')
    expect(entities).toContainEqual(expect.objectContaining({ kind: 'project', value: 'MAD' }))
    expect(entities).toContainEqual(expect.objectContaining({ kind: 'bank', value: 'Banco Santander' }))
    expect(entities).toContainEqual(expect.objectContaining({ kind: 'bank', value: 'BBVA' }))
    expect(entities).toContainEqual(expect.objectContaining({ kind: 'finance_term', value: 'coste financiero' }))
  })
})

describe('expandDocumentGraph', () => {
  it('expands from query entities to connected funding chunks', async () => {
    const docs = [{
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
    const chunks = [{
      id: 'chunk-cost',
      document_id: 'doc-bank',
      chunk_index: 86,
      content: 'Tipo de Interes Ordinario: EURIBOR mas Margen 4,00%. Entidades financiadoras Banco Santander y BBVA.',
      metadata: {},
    }]
    const { client } = fakeSupabase(docs, chunks)
    const result = await expandDocumentGraph(client, 'coste financiacion bancaria MPS Santander BBVA EURIBOR margen', {
      projectFilter: 'MAD',
      docTypeFilter: 'funding',
    })

    expect(result.documentIds).toEqual(['doc-bank'])
    expect(result.chunks[0]).toMatchObject({
      id: 'chunk-cost',
      document_id: 'doc-bank',
      metadata: expect.objectContaining({
        retrieval_lane: 'graph',
        graph_entities: expect.stringContaining('bank:BBVA'),
        chunk_index: 86,
      }),
    })
  })

  it('does not query tables when an explicit project filter contradicts a constrained query entity', async () => {
    const { client, from } = fakeSupabase([], [])
    const result = await expandDocumentGraph(client, 'coste financiacion bancaria MPS Santander BBVA', {
      projectFilter: 'BHX',
      docTypeFilter: 'funding',
    })
    expect(result.chunks).toEqual([])
    expect(from).not.toHaveBeenCalled()
  })
})
