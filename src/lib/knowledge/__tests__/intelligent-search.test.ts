import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/rag/retrieve', () => ({
  retrieveDocuments: vi.fn(),
}))

import { retrieveDocuments } from '@/lib/rag/retrieve'
import { aggregateSmartDocumentResults, extractSmartEntities, searchDocumentsIntelligently, type SmartDocumentSearchResult } from '@/lib/knowledge/intelligent-search'

const doc = (id: string, overrides: Partial<SmartDocumentSearchResult> = {}) => ({
  id,
  title: `${id}.pdf`,
  project_id: 'MAD',
  doc_type: 'funding',
  period: null,
  review_status: 'approved',
  authority_score: 90,
  authority_tier: 'executed',
  classification_source: 'agent_reviewed',
  status: 'indexed',
  source_channel: 'manual_admin',
  chunk_count: 3,
  summary: null,
  md_path: null,
  ...overrides,
})

const chunk = (id: string, documentId: string, content: string, relevanceScore: number) => ({
  id,
  document_id: documentId,
  content,
  metadata: { chunk_index: 1 },
  relevanceScore,
})

function fakeSupabase(docs: Array<ReturnType<typeof doc>>) {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        in: vi.fn(async () => ({ data: docs, error: null })),
      })),
    })),
  } as never
}

beforeEach(() => vi.clearAllMocks())

describe('aggregateSmartDocumentResults', () => {
  it('groups chunk hits by document and keeps the best snippets', () => {
    const rows = aggregateSmartDocumentResults(
      [
        chunk('c1', 'd1', 'Tipo de Interes Ordinario EURIBOR mas Margen', 0.7),
        chunk('c2', 'd1', 'Banco Santander y BBVA participan en la financiacion', 0.5),
        chunk('c3', 'd2', 'Mandato previo de Santander', 0.6),
      ],
      [doc('d1'), doc('d2', { authority_score: 40 })],
      'coste financiacion Santander BBVA',
    )

    expect(rows).toHaveLength(2)
    expect(rows[0].id).toBe('d1')
    expect(rows[0].smart_snippets).toHaveLength(2)
    expect(rows[0].smart_reason).toContain('contenido indexado')
  })
})

describe('extractSmartEntities', () => {
  it('extracts banks, amounts, dates, projects and document roles from snippets', () => {
    const entities = extractSmartEntities('Contrato de financiación MPS con Banco Santander y BBVA por 31.000.000 € firmado el 27 de febrero de 2026')
    expect(entities).toContainEqual({ kind: 'bank', value: 'Banco Santander' })
    expect(entities).toContainEqual({ kind: 'bank', value: 'BBVA' })
    expect(entities).toContainEqual({ kind: 'project', value: 'MAD' })
    expect(entities).toContainEqual({ kind: 'amount', value: '31.000.000 €' })
    expect(entities).toContainEqual({ kind: 'date', value: '27 de febrero de 2026' })
    expect(entities).toContainEqual({ kind: 'document_role', value: 'contrato' })
  })
})

describe('searchDocumentsIntelligently', () => {
  it('uses production retrieval, fetches document metadata and applies filters', async () => {
    ;(retrieveDocuments as ReturnType<typeof vi.fn>).mockResolvedValue({
      ranked: [
        chunk('c1', 'd1', 'Contrato firmado Santander BBVA EURIBOR margen', 0.8),
        chunk('c2', 'd2', 'Documento sin revisar', 0.9),
      ],
      diagnostics: { degraded: false, vectorFailed: false, keywordFailed: false },
    })
    const result = await searchDocumentsIntelligently(fakeSupabase([
      doc('d1'),
      doc('d2', { review_status: 'needs_review' }),
    ]), {
      query: 'Santander BBVA coste',
      filters: { review_status: 'approved' },
      modelEnabled: false,
    })

    expect(retrieveDocuments).toHaveBeenCalledWith(expect.anything(), 'Santander BBVA coste', expect.objectContaining({
      projectFilter: null,
      docTypeFilter: null,
      groundingMode: 'standard',
    }))
    expect(result.items.map((item) => item.id)).toEqual(['d1'])
    expect(result.modelUsed).toBe(false)
  })

  it('respects source channel and markdown filters after retrieval', async () => {
    ;(retrieveDocuments as ReturnType<typeof vi.fn>).mockResolvedValue({
      ranked: [
        chunk('c1', 'd1', 'Contrato firmado Santander BBVA EURIBOR margen', 0.8),
        chunk('c2', 'd2', 'Contrato con markdown disponible', 0.9),
        chunk('c3', 'd3', 'Contrato de otro origen', 0.9),
      ],
      diagnostics: { degraded: false, vectorFailed: false, keywordFailed: false },
    })
    const result = await searchDocumentsIntelligently(fakeSupabase([
      doc('d1', { source_channel: 'manual_admin', md_path: null }),
      doc('d2', { source_channel: 'manual_admin', md_path: 'artifact.md' }),
      doc('d3', { source_channel: 'browser_upload', md_path: null }),
    ]), {
      query: 'Santander BBVA coste',
      filters: { channel: 'manual_admin', onlyNoMarkdown: true },
      modelEnabled: false,
    })

    expect(result.items.map((item) => item.id)).toEqual(['d1'])
  })

  it('keeps other filters active when searching only error documents', async () => {
    ;(retrieveDocuments as ReturnType<typeof vi.fn>).mockResolvedValue({
      ranked: [
        chunk('c1', 'd1', 'Contrato con error de ingesta', 0.8),
        chunk('c2', 'd2', 'Contrato indexado', 0.9),
        chunk('c3', 'd3', 'Contrato con error de otro canal', 0.9),
      ],
      diagnostics: { degraded: false, vectorFailed: false, keywordFailed: false },
    })
    const result = await searchDocumentsIntelligently(fakeSupabase([
      doc('d1', { status: 'error', source_channel: 'manual_admin' }),
      doc('d2', { status: 'indexed', source_channel: 'manual_admin' }),
      doc('d3', { status: 'error', source_channel: 'browser_upload' }),
    ]), {
      query: 'error ingesta Santander',
      filters: { onlyErrors: true, channel: 'manual_admin' },
      modelEnabled: false,
    })

    expect(result.items.map((item) => item.id)).toEqual(['d1'])
  })

  it('lets the model reranker reorder and annotate candidates without changing document shape', async () => {
    ;(retrieveDocuments as ReturnType<typeof vi.fn>).mockResolvedValue({
      ranked: [
        chunk('c1', 'd1', 'Mandato Santander', 0.9),
        chunk('c2', 'd2', 'Contrato financiacion EURIBOR margen 4,00', 0.6),
      ],
      diagnostics: { degraded: false, vectorFailed: false, keywordFailed: false },
    })
    const result = await searchDocumentsIntelligently(fakeSupabase([
      doc('d1', { title: 'Mandato Madrid Playa Surf.docx' }),
      doc('d2', { title: '4140-7692-5542 Contrato de financiacion.pdf' }),
    ]), {
      query: 'coste financiacion Santander BBVA',
      reranker: async () => [
        { id: 'd2', score: 0.98, role: 'contrato', reason: 'Contiene EURIBOR y margen.' },
        { id: 'd1', score: 0.3, role: 'mandato', reason: 'Documento preparatorio.' },
      ],
    })

    expect(result.modelUsed).toBe(true)
    expect(result.model).toBeTruthy()
    expect(result.items[0]).toMatchObject({
      id: 'd2',
      smart_score: 0.98,
      smart_role: 'contrato',
      smart_reason: 'Contiene EURIBOR y margen.',
    })
    expect(result.items[0].smart_entities).toEqual(expect.arrayContaining([
      { kind: 'bank', value: 'Banco Santander' },
      { kind: 'bank', value: 'BBVA' },
    ]))
  })

  it('falls back to deterministic ranking when the model reranker is unavailable', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    ;(retrieveDocuments as ReturnType<typeof vi.fn>).mockResolvedValue({
      ranked: [
        chunk('c1', 'd1', 'Contrato financiacion Santander BBVA EURIBOR margen', 0.8),
        chunk('c2', 'd2', 'Mandato preparatorio Santander', 0.6),
      ],
      diagnostics: { degraded: false, vectorFailed: false, keywordFailed: false, graphCount: 2, graphEntities: [], modelRerankUsed: false },
    })

    try {
      const result = await searchDocumentsIntelligently(fakeSupabase([
        doc('d1', { title: '4140-7692-5542 Contrato de financiacion.pdf' }),
        doc('d2', { title: 'Mandato Madrid Playa Surf.docx' }),
      ]), {
        query: 'reranker outage Santander BBVA',
        cacheEnabled: false,
        reranker: async () => {
          throw {
            status: 429,
            headers: { authorization: 'Bearer sk-secret', 'set-cookie': 'secret-cookie' },
            requestID: 'req-secret',
            error: { code: 'insufficient_quota', type: 'insufficient_quota', message: 'You exceeded your current quota.' },
          }
        },
      })

      expect(result.items.map((item) => item.id)).toEqual(['d1', 'd2'])
      expect(result.modelUsed).toBe(false)
      expect(result.model).toBeNull()
      expect(result.modelRerankUsed).toBe(false)
      expect(result.graphUsed).toBe(true)

      const warning = warn.mock.calls.map((call) => call.join(' ')).join('\n')
      expect(warning).toContain('status=429')
      expect(warning).toContain('code=insufficient_quota')
      expect(warning).not.toContain('sk-secret')
      expect(warning).not.toContain('secret-cookie')
      expect(warning).not.toContain('req-secret')
    } finally {
      warn.mockRestore()
    }
  })

  it('returns cache hits for repeated equivalent searches', async () => {
    ;(retrieveDocuments as ReturnType<typeof vi.fn>).mockResolvedValue({
      ranked: [chunk('cache-c1', 'cache-d1', 'Contrato financiacion EURIBOR margen 4,00', 0.7)],
      diagnostics: { degraded: false, vectorFailed: false, keywordFailed: false },
    })
    const client = fakeSupabase([doc('cache-d1')])
    const first = await searchDocumentsIntelligently(client, {
      query: 'cache Santander BBVA coste',
      modelEnabled: false,
    })
    const second = await searchDocumentsIntelligently(client, {
      query: 'cache Santander BBVA coste',
      modelEnabled: false,
    })

    expect(first.cacheHit).toBe(false)
    expect(second.cacheHit).toBe(true)
    expect(retrieveDocuments).toHaveBeenCalledTimes(1)
  })
})
