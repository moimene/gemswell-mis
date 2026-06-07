import { describe, it, expect } from 'vitest'
import { firstMatchRankById, precisionAtK, matchedBy, firstMatchRank, scoreDocumentaryRank } from '../_harness'

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
  it('is relevant-in-top-k / k (standard P@k; sparse pools are NOT inflated)', () => {
    expect(precisionAtK(['a', 'x', 'b', 'y'], ['a', 'b'], 4)).toBe(0.5)
    // only 2 retrieved for k=5, both relevant → 2/5, NOT 2/2 (dividing by retrieved would inflate during pool-shrinking tuning)
    expect(precisionAtK(['a', 'b'], ['a', 'b'], 5)).toBe(0.4)
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

describe('scoreDocumentaryRank — pinned cases NEVER fall back to title (anti-inflation)', () => {
  it('an id-pinned MISS scores 0 even when a title would match a same-title decoy', () => {
    const g = { ground_truth: { expected_doc_ids: ['correct'], titles: ['shared title'] } }
    // retrieved a DIFFERENT doc that shares the title substring — must NOT count as a hit
    const r = scoreDocumentaryRank(g, ['other-doc'], ['Shared Title (decoy)'])
    expect(r).toEqual({ rank: 0, scoredBy: 'id' })
  })
  it('an id-pinned HIT scores by id rank', () => {
    const g = { ground_truth: { expected_doc_ids: ['correct'], titles: ['t'] } }
    expect(scoreDocumentaryRank(g, ['x', 'correct'], ['a', 'b'])).toEqual({ rank: 2, scoredBy: 'id' })
  })
  it('an UNPINNED case falls back to title (behavior-preserving)', () => {
    const g = { ground_truth: { titles: ['pacto'] } }
    expect(scoreDocumentaryRank(g, ['x'], ['Pacto de Socios'])).toEqual({ rank: 1, scoredBy: 'title' })
  })
  it('no ground truth scores none', () => {
    expect(scoreDocumentaryRank({ ground_truth: {} }, ['x'], ['y'])).toEqual({ rank: 0, scoredBy: 'none' })
  })
})
