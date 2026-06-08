import { describe, it, expect } from 'vitest'
import { triageNeedsReview } from '@/lib/knowledge/triage'
import type { AuthorityTier } from '@/lib/knowledge/contracts'

const cur = (authority_tier: AuthorityTier = 'internal') => ({ authority_tier })

describe('triageNeedsReview — automated needs_review backlog triage (WS3-T5)', () => {
  it('auto-approves a confident, real-doc-type, non-unverified re-classification', () => {
    const d = triageNeedsReview({ doc_type: 'funding', authority_tier: 'internal', confidence: 0.9 }, cur('unverified'))
    expect(d.action).toBe('approve')
    expect(d.newStatus).toBe('approved')
  })

  it('NEVER auto-resolves a sticky high-authority claim (current tier)', () => {
    const d = triageNeedsReview({ doc_type: 'funding', authority_tier: 'internal', confidence: 0.95 }, cur('executed'))
    expect(d.action).toBe('keep_needs_review')
  })

  it('NEVER auto-resolves a sticky high-authority claim (re-classified tier)', () => {
    const d = triageNeedsReview({ doc_type: 'annual_accounts', authority_tier: 'audited', confidence: 0.95 }, cur('internal'))
    expect(d.action).toBe('keep_needs_review')
  })

  it('keeps low-confidence re-classifications for human review', () => {
    const d = triageNeedsReview({ doc_type: 'funding', authority_tier: 'internal', confidence: 0.3 }, cur('internal'))
    expect(d.action).toBe('keep_needs_review')
  })

  it('keeps an unverified-tier re-classification (genuinely low authority → not auto-approved)', () => {
    const d = triageNeedsReview({ doc_type: 'funding', authority_tier: 'unverified', confidence: 0.9 }, cur('unverified'))
    expect(d.action).toBe('keep_needs_review')
  })

  it('keeps a doc_type=other / unidentifiable re-classification', () => {
    const d = triageNeedsReview({ doc_type: 'other', authority_tier: 'internal', confidence: 0.9 }, cur('internal'))
    expect(d.action).toBe('keep_needs_review')
  })

  it('never returns a reject action (rejection is destructive — uncertain stays needs_review)', () => {
    for (const conf of [0.1, 0.5, 0.9]) {
      const d = triageNeedsReview({ doc_type: 'other', authority_tier: 'unverified', confidence: conf }, cur('unverified'))
      expect(['approve', 'keep_needs_review']).toContain(d.action)
    }
  })
})
