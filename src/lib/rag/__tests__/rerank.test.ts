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

  it('single chunk returns trivially without calling Cohere (not degraded)', async () => {
    const r = await rerankChunks('q', [chunk('a', 'aaa', 0.7)], 5)
    expect(rerankMock).not.toHaveBeenCalled()
    expect(r.degraded).toBe(false)
    expect(r.chunks[0].relevanceScore).toBe(0.7)
  })
})
