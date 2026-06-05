import { describe, it, expect } from 'vitest'
import { rankBySourceTrust, trustTier } from '@/lib/rag/rank'

const md = (o: Record<string, unknown>) => o
const sor = md({ authority_score: 95, review_status: 'approved', classification_source: 'agent_reviewed' }) // source_of_record
const approved75 = md({ authority_score: 80, review_status: 'approved', classification_source: 'rule' })      // supporting
const needs95 = md({ authority_score: 95, review_status: 'needs_review', classification_source: 'agent_auto' }) // context

describe('trustTier', () => {
  it('ranks source_of_record > supporting > context', () => {
    expect(trustTier(sor)).toBeGreaterThan(trustTier(approved75))
    expect(trustTier(approved75)).toBeGreaterThan(trustTier(needs95))
  })
})

describe('rankBySourceTrust', () => {
  it('a needs_review authority-95 chunk never outranks an approved source_of_record one, even with higher relevance', () => {
    const ranked = rankBySourceTrust([
      { metadata: needs95, relevanceScore: 0.99 },
      { metadata: sor, relevanceScore: 0.40 },
    ])
    expect(ranked[0].metadata).toBe(sor)
  })
  it('within the same tier, higher Cohere relevance wins', () => {
    const ranked = rankBySourceTrust([
      { metadata: sor, relevanceScore: 0.5 },
      { metadata: sor, relevanceScore: 0.9 },
    ])
    expect(ranked[0].relevanceScore).toBe(0.9)
  })
  it('is stable for equal tier+relevance (preserves input order)', () => {
    const a = { metadata: approved75, relevanceScore: 0.5, id: 'a' }
    const b = { metadata: approved75, relevanceScore: 0.5, id: 'b' }
    expect(rankBySourceTrust([a, b]).map(x => (x as { id: string }).id)).toEqual(['a', 'b'])
  })
  it('missing metadata → unverified tier (lowest), still ordered by relevance', () => {
    const ranked = rankBySourceTrust([
      { metadata: undefined, relevanceScore: 0.9 },
      { metadata: approved75, relevanceScore: 0.1 },
    ])
    expect(ranked[0].metadata).toBe(approved75)
  })
})
