import { describe, it, expect, vi, beforeEach } from 'vitest'

const rerankMock = vi.fn()
vi.mock('cohere-ai', () => ({
  CohereClient: class {
    rerank = rerankMock
  },
}))

import { rerankChunks } from '@/lib/rag/rerank'

const chunk = (id: string, content: string, similarity: number) => ({ id, content, similarity, metadata: {} })

describe('rerankChunks', () => {
  beforeEach(() => {
    rerankMock.mockReset()
    process.env.COHERE_API_KEY = 'test-key'
  })

  it('returns empty + not degraded for no chunks', async () => {
    const r = await rerankChunks('q', [])
    expect(r.chunks).toEqual([])
    expect(r.degraded).toBe(false)
  })

  it('uses Cohere relevance scores on success (not degraded)', async () => {
    rerankMock.mockResolvedValue({
      results: [
        { index: 1, relevanceScore: 0.92 },
        { index: 0, relevanceScore: 0.40 },
      ],
    })
    const r = await rerankChunks('q', [chunk('a', 'aaa', 0.3), chunk('b', 'bbb', 0.5)], 2)
    expect(r.degraded).toBe(false)
    expect(r.chunks[0].id).toBe('b')
    expect(r.chunks[0].relevanceScore).toBe(0.92)
    expect(r.chunks[1].relevanceScore).toBe(0.40)
  })

  it('falls back to NORMALISED similarity (degraded=true) when Cohere throws', async () => {
    rerankMock.mockRejectedValue(new Error('cohere down'))
    const r = await rerankChunks('q', [
      chunk('a', 'aaa', 0.2),
      chunk('b', 'bbb', 0.9),
      chunk('c', 'ccc', 0.55),
    ], 3)
    expect(r.degraded).toBe(true)
    // sorted by similarity desc, then min-max normalised into [0,1]
    expect(r.chunks.map(c => c.id)).toEqual(['b', 'c', 'a'])
    expect(r.chunks[0].relevanceScore).toBeCloseTo(1) // max
    expect(r.chunks[2].relevanceScore).toBeCloseTo(0) // min
    for (const c of r.chunks) {
      expect(c.relevanceScore).toBeGreaterThanOrEqual(0)
      expect(c.relevanceScore).toBeLessThanOrEqual(1)
    }
  })

  it('degraded path orders by fusedScore (scale-free), NOT mixed-scale similarity', async () => {
    // The bug (adversarial review / audit A3): degraded sorted by `similarity`, mixing cosine (~0.2-0.9)
    // with raw ts_rank_cd (unbounded) — a big keyword ts_rank wrongly outranks a strong vector hit.
    // With RRF fusedScore (scale-free) the order is meaningful even when Cohere is down.
    rerankMock.mockRejectedValue(new Error('cohere down'))
    const r = await rerankChunks('q', [
      { id: 'kw', content: 'k', similarity: 8.5, metadata: {}, fusedScore: 0.01 }, // huge ts_rank, LOW fused
      { id: 'vec', content: 'v', similarity: 0.7, metadata: {}, fusedScore: 0.03 }, // cosine, HIGHER fused
    ], 2)
    expect(r.degraded).toBe(true)
    expect(r.chunks.map((c) => c.id)).toEqual(['vec', 'kw']) // fusedScore wins, not the 8.5 ts_rank
  })

  it('single chunk returns trivially without calling Cohere (not degraded)', async () => {
    const r = await rerankChunks('q', [chunk('a', 'aaa', 0.7)], 5)
    expect(rerankMock).not.toHaveBeenCalled()
    expect(r.degraded).toBe(false)
    expect(r.chunks[0].relevanceScore).toBe(0.7)
  })
})
