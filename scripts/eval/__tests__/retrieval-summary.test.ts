import { describe, expect, it } from 'vitest'
import { buildRetrievalSummary, type RetrievalResult } from '../run-retrieval'

function row(overrides: Partial<RetrievalResult> = {}): RetrievalResult {
  return {
    g: {
      id: 'doc-hit',
      question: 'q',
      lang: 'es',
      category: 'funding',
      expected_kind: 'documentary',
      ground_truth: { expected_doc_ids: ['expected'], titles: ['expected title'] },
    },
    cross: {
      mode: 'cross',
      ms: 100,
      vectorCount: 10,
      keywordCount: 5,
      poolCount: 12,
      overlapCount: 1,
      degraded: false,
      rank: 1,
      scoredBy: 'id',
      precisionAt5: 0.2,
      topTitles: [],
    },
    scoped: null,
    ...overrides,
  }
}

describe('buildRetrievalSummary', () => {
  it('passes when pinned documentary cases are retrieved without degradation', () => {
    const summary = buildRetrievalSummary([row()])

    expect(summary.ok).toBe(true)
    expect(summary.failures).toEqual([])
    expect(summary.documentary.cross.recallAt1).toBe(1)
    expect(summary.documentary.precisionAt5).toBe(0.2)
  })

  it('fails strict summary for pinned misses, title-only scoring, and degraded retrieval', () => {
    const summary = buildRetrievalSummary([
      row({ g: { ...row().g, id: 'miss' }, cross: { ...row().cross, rank: 0 } }),
      row({
        g: {
          ...row().g,
          id: 'title-only',
          ground_truth: { titles: ['expected title'] },
        },
        cross: { ...row().cross, scoredBy: 'title', precisionAt5: null },
      }),
      row({ g: { ...row().g, id: 'degraded' }, cross: { ...row().cross, degraded: true } }),
    ])

    expect(summary.ok).toBe(false)
    expect(summary.failures).toEqual(expect.arrayContaining([
      'miss: expected pinned document missing from cross top 5.',
      '1 documentary retrieval cases are still title-only; pin expected_doc_ids.',
      '1 cross retrieval cases ran degraded.',
    ]))
  })
})
