import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the two external services so the test is deterministic and offline. The merge/dedup/reject
// logic and the REAL trust-tier sort (rankBySourceTrust) are what we exercise here.
vi.mock('@/lib/rag/embeddings', () => ({
  embedText: vi.fn(async () => new Array(768).fill(0.1)),
}))
vi.mock('@/lib/rag/rerank', () => ({
  // Identity reranker: preserves input order, assigns descending relevance so the FIRST input has
  // the HIGHEST Cohere relevance — lets us prove trust tier can override raw relevance.
  rerankChunks: vi.fn(async (_q: string, chunks: Array<{ id: string }>) => ({
    chunks: chunks.map((c, i) => ({ ...c, relevanceScore: 1 - i * 0.01 })),
    degraded: false,
  })),
}))

import { retrieveDocuments, isRejectedSource, isExcludedFromRetrieval, emptyResultMessage } from '@/lib/rag/retrieve'

type Row = { id: string; document_id: string; content: string; metadata: Record<string, unknown>; similarity?: number; rank?: number }

function fakeSupabase(vectorRows: Row[], keywordRows: Row[]) {
  // 2nd param typed so `.mock.calls[i][1]` (the RPC args object) is type-safe in assertions below.
  const rpc = vi.fn(async (name: string, _params?: Record<string, unknown>) => {
    if (name === 'match_chunks') return { data: vectorRows, error: null }
    if (name === 'keyword_search_chunks') return { data: keywordRows, error: null }
    return { data: [], error: null }
  })
  return { client: { rpc } as never, rpc }
}

const approved = { authority_score: 95, review_status: 'approved', classification_source: 'human' }

beforeEach(() => vi.clearAllMocks())

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
  })

  it('lets trust tier override raw Cohere relevance', async () => {
    // 'lowtrust' is first → highest rerank relevance; 'highauth' is second → lower relevance but
    // source_of_record tier. Trust must win.
    const vector: Row[] = [
      { id: 'lowtrust', document_id: 'd1', content: 'high relevance, no governance', metadata: {}, similarity: 0.99 },
      { id: 'highauth', document_id: 'd2', content: 'authoritative', metadata: approved, similarity: 0.5 },
    ]
    const { client } = fakeSupabase(vector, [])
    const { ranked } = await retrieveDocuments(client, 'q')
    expect(ranked[0].id).toBe('highauth')
  })

  it('passes filters + threshold to the RPCs', async () => {
    const { client, rpc } = fakeSupabase([], [])
    await retrieveDocuments(client, 'q', { projectFilter: 'MAD', docTypeFilter: 'legal' })
    const matchCall = rpc.mock.calls.find((c) => c[0] === 'match_chunks')
    const kwCall = rpc.mock.calls.find((c) => c[0] === 'keyword_search_chunks')
    expect(matchCall?.[1]).toMatchObject({ filter_project: 'MAD', filter_doc_type: 'legal', match_threshold: 0.18 })
    expect(kwCall?.[1]).toMatchObject({ filter_project: 'MAD', filter_doc_type: 'legal' })
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
