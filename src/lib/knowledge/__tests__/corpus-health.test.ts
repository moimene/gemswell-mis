import { describe, it, expect } from 'vitest'
import { buildCorpusHealth } from '@/lib/knowledge/corpus-health'

describe('buildCorpusHealth', () => {
  it('assembles governance + ratios + queue from raw aggregates', () => {
    const h = buildCorpusHealth({
      total: 5498, approved: 3224, needs_review: 2274, rejected: 0, pending: 0,
      retired: 0, sourceOfRecord: 797, authoritySum: 411000, authorityCount: 5498,
      withMarkdown: 2, withSourceHash: 2,
      queue: { total: 2675, queued: 2406, processing: 267, done: 2, error: 0 },
    })
    expect(h.total).toBe(5498)
    expect(h.governance.approved).toBe(3224)
    expect(h.source_of_record).toBe(797)
    expect(h.avg_authority).toBeCloseTo(74.75, 1)
    expect(h.pct_markdown).toBeCloseTo(2 / 5498, 6) // withMarkdown / total ≈ 0.000364
    expect(h.queue.processing).toBe(267)
  })
  it('avg_authority 0 when no docs', () => {
    const h = buildCorpusHealth({ total: 0, approved: 0, needs_review: 0, rejected: 0, pending: 0,
      retired: 0, sourceOfRecord: 0, authoritySum: 0, authorityCount: 0, withMarkdown: 0, withSourceHash: 0,
      queue: { total: 0, queued: 0, processing: 0, done: 0, error: 0 } })
    expect(h.avg_authority).toBe(0)
    expect(h.pct_markdown).toBe(0)
  })
})
