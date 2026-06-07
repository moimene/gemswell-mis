import { describe, it, expect } from 'vitest'
import { firstMatchRankById, precisionAtK, matchedBy, firstMatchRank } from '../_harness'

describe('firstMatchRankById', () => {
  it('returns the 1-based rank of the first id in the expected set', () => {
    expect(firstMatchRankById(['a', 'b', 'c'], ['c'])).toBe(3)
    expect(firstMatchRankById(['a', 'b', 'c'], ['b', 'c'])).toBe(2)
    expect(firstMatchRankById(['a', 'b'], ['z'])).toBe(0)
  })
  it('returns 0 when unpinned (no expected ids) — so callers fall back to title', () => {
    expect(firstMatchRankById(['a', 'b'], undefined)).toBe(0)
    expect(firstMatchRankById(['a', 'b'], [])).toBe(0)
  })
  it('ignores null/undefined ids in the ranked list', () => {
    expect(firstMatchRankById([null, undefined, 'a'], ['a'])).toBe(3)
  })
})

describe('precisionAtK', () => {
  it('is the fraction of top-k that are relevant', () => {
    expect(precisionAtK(['a', 'x', 'b', 'y'], ['a', 'b'], 4)).toBe(0.5)
    expect(precisionAtK(['a', 'b'], ['a', 'b'], 5)).toBe(1) // fewer than k retrieved
  })
  it('returns null when unpinned (precision is unmeasurable without labels)', () => {
    expect(precisionAtK(['a'], undefined, 5)).toBeNull()
  })
})

describe('matchedBy', () => {
  it('prefers pinned ids over titles', () => {
    expect(matchedBy({ ground_truth: { expected_doc_ids: ['a'], titles: ['t'] } })).toBe('id')
    expect(matchedBy({ ground_truth: { titles: ['t'] } })).toBe('title')
    expect(matchedBy({ ground_truth: {} })).toBe('none')
    expect(matchedBy({})).toBe('none')
  })
})

describe('firstMatchRank (existing title path still works)', () => {
  it('matches case-insensitive title substrings', () => {
    expect(firstMatchRank(['Pacto de Socios MAD', 'Other'], ['pacto de socios'])).toBe(1)
    expect(firstMatchRank(['Other'], ['pacto de socios'])).toBe(0)
  })
})
