import { describe, it, expect, vi, beforeEach } from 'vitest'
import { laneIntervalMs, waitForEmbeddingSlot, __resetEmbeddingLimiters } from '@/lib/rag/embeddings'

beforeEach(() => __resetEmbeddingLimiters())

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
})
