import { describe, it, expect } from 'vitest'
import { buildCorpusHealth } from '@/lib/knowledge/corpus-health'

describe('buildCorpusHealth', () => {
  it('assembles governance + ratios + queue from raw aggregates', () => {
    const h = buildCorpusHealth({
      total: 6895, approved: 3477, needs_review: 1368, rejected: 1, pending: 0,
      retired: 2, sourceOfRecord: 814, authoritySum: 218639, authorityCount: 4846,
      withMarkdown: 1386, withSourceHash: 1399,
      queue: { total: 1391, queued: 0, processing: 0, done: 1366, error: 24, canceled: 1 },
    })
    expect(h.total).toBe(6895)
    expect(h.governance.approved).toBe(3477)
    expect(h.source_of_record).toBe(814)
    expect(h.avg_authority).toBeCloseTo(45.12, 1)
    expect(h.pct_markdown).toBeCloseTo(1386 / 6895, 6)
    expect(h.queue.done).toBe(1366)
    expect(h.queue.canceled).toBe(1)
  })
  it('avg_authority 0 when no docs', () => {
    const h = buildCorpusHealth({ total: 0, approved: 0, needs_review: 0, rejected: 0, pending: 0,
      retired: 0, sourceOfRecord: 0, authoritySum: 0, authorityCount: 0, withMarkdown: 0, withSourceHash: 0,
      queue: { total: 0, queued: 0, processing: 0, done: 0, error: 0 } })
    expect(h.avg_authority).toBe(0)
    expect(h.pct_markdown).toBe(0)
  })
})
