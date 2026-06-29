import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  googleEmbedContent: vi.fn(),
  openAIEmbeddingsCreate: vi.fn(),
}))

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn(() => ({
    models: { embedContent: mocks.googleEmbedContent },
  })),
}))

vi.mock('openai', () => ({
  default: vi.fn(function MockOpenAI() {
    return { embeddings: { create: mocks.openAIEmbeddingsCreate } }
  }),
}))

import {
  laneIntervalMs,
  waitForEmbeddingSlot,
  __resetEmbeddingLimiters,
  embedBatchWithModel,
  embedTextCandidates,
  DIMENSIONS,
} from '@/lib/rag/embeddings'

const originalEnv = { ...process.env }
const originalFetch = globalThis.fetch

beforeEach(() => {
  __resetEmbeddingLimiters()
  vi.clearAllMocks()
  process.env = { ...originalEnv }
  globalThis.fetch = originalFetch
  delete process.env.OPENAI_API_KEY
  delete process.env.OPENAI_EMBEDDING_FALLBACK_ENABLED
  delete process.env.OPENAI_EMBEDDING_QUERY_ENABLED
})

describe('embedding lanes', () => {
  it('interactive lane default interval is much shorter than bulk', () => {
    expect(laneIntervalMs('interactive')).toBe(50)
    expect(laneIntervalMs('bulk')).toBe(4000)
    expect(laneIntervalMs('interactive')).toBeLessThan(laneIntervalMs('bulk'))
  })

  it('an interactive slot does NOT queue behind a busy bulk lane (the decoupling invariant)', async () => {
    vi.useFakeTimers()
    try {
      // Reserve a bulk slot → bulk.nextAt jumps ~4000ms into the future.
      await waitForEmbeddingSlot('bulk')
      // A fresh interactive slot must resolve without advancing the 4000ms bulk interval.
      let resolved = false
      const p = waitForEmbeddingSlot('interactive').then(() => { resolved = true })
      await vi.advanceTimersByTimeAsync(0) // flush microtasks only — no timer advance
      expect(resolved).toBe(true)
      await p
    } finally {
      vi.useRealTimers()
    }
  })

  it('two sequential interactive slots are spaced by the interactive interval, not the bulk one', async () => {
    vi.useFakeTimers()
    try {
      await waitForEmbeddingSlot('interactive') // first: no wait, sets nextAt = +50
      let second = false
      const p = waitForEmbeddingSlot('interactive').then(() => { second = true })
      await vi.advanceTimersByTimeAsync(0)
      expect(second).toBe(false)           // must wait the 50ms spacing
      await vi.advanceTimersByTimeAsync(50)
      expect(second).toBe(true)            // resolved after 50ms, NOT 4000ms
      await p
    } finally {
      vi.useRealTimers()
    }
  })

  it('falls back to OpenAI embeddings with explicit model provenance when Gemini is unavailable', async () => {
    process.env.OPENAI_API_KEY = 'sk-test'
    globalThis.fetch = vi.fn(async () => ({
      ok: false,
      status: 503,
      text: async () => 'unavailable',
    })) as never
    mocks.openAIEmbeddingsCreate.mockResolvedValueOnce({
      data: [{ embedding: new Array(DIMENSIONS).fill(0.2) }],
    })

    const result = await embedBatchWithModel(['texto contractual'], { lane: 'interactive' })

    expect(result.model).toBe('text-embedding-3-small')
    expect(result.embeddings).toHaveLength(1)
    expect(result.embeddings[0]).toHaveLength(DIMENSIONS)
    expect(mocks.openAIEmbeddingsCreate).toHaveBeenCalledWith({
      model: 'text-embedding-3-small',
      input: ['texto contractual'],
      dimensions: DIMENSIONS,
    })
  })

  it('adds an OpenAI query candidate only when explicitly enabled', async () => {
    process.env.GOOGLE_AI_API_KEY = 'google-test'
    process.env.OPENAI_API_KEY = 'sk-test'
    process.env.OPENAI_EMBEDDING_QUERY_ENABLED = 'true'
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ embedding: { values: new Array(DIMENSIONS).fill(0.1) } }),
    })) as never
    mocks.openAIEmbeddingsCreate.mockResolvedValueOnce({
      data: [{ embedding: new Array(DIMENSIONS).fill(0.2) }],
    })

    const candidates = await embedTextCandidates('coste prestamo')

    expect(candidates.map((candidate) => candidate.model)).toEqual(['gemini-embedding-001', 'text-embedding-3-small'])
    expect(candidates.every((candidate) => candidate.embedding.length === DIMENSIONS)).toBe(true)
  })
})
