import { describe, it, expect } from 'vitest'
import { laneIntervalMs } from '@/lib/rag/embeddings'

describe('embedding lanes', () => {
  it('interactive lane default interval is much shorter than bulk', () => {
    expect(laneIntervalMs('interactive')).toBe(250)
    expect(laneIntervalMs('bulk')).toBe(4000)
    expect(laneIntervalMs('interactive')).toBeLessThan(laneIntervalMs('bulk'))
  })
})
