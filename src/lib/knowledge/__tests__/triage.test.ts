import { describe, it, expect } from 'vitest'
import { triageNeedsReview, triageAggressive } from '@/lib/knowledge/triage'
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

// AGGRESSIVE policy — high-quality FINAL docs → high authority automatically (operator-chosen).
describe('triageAggressive — high-value final docs → high authority (fuente oficial)', () => {
  const cur = (authority_tier: AuthorityTier = 'unverified') => ({ authority_tier })

  it('promotes a signed contract (not draft) to executed/90 → source_of_record', () => {
    const d = triageAggressive({ doc_type: 'legal', authority_tier: 'internal', confidence: 0.85, lifecycle: 'signed' }, cur())
    expect(d.action).toBe('approve')
    expect(d.authority_score).toBe(90)
    expect(d.authority_tier).toBe('executed')
  })

  it('promotes an audited set of accounts to audited/100', () => {
    const d = triageAggressive({ doc_type: 'annual_accounts', authority_tier: 'internal', confidence: 0.9, lifecycle: 'audited' }, cur())
    expect(d.authority_score).toBe(100)
    expect(d.authority_tier).toBe('audited')
  })

  it('promotes a contract whose lifecycle is unknown (NOT draft) ONLY above the stricter 0.75 bar', () => {
    const hi = triageAggressive({ doc_type: 'legal', authority_tier: 'unverified', confidence: 0.8, lifecycle: 'unknown' }, cur())
    expect(hi.action).toBe('approve')
    expect(hi.authority_score).toBe(90)
    // an unknown-finality doc at 0.6 (would pass for an explicitly-signed doc) must NOT promote
    const lo = triageAggressive({ doc_type: 'legal', authority_tier: 'unverified', confidence: 0.6, lifecycle: 'unknown' }, cur())
    expect(lo.authority_score).toBeUndefined()
  })

  it('a signed doc still promotes at the 0.6 bar (explicit finality)', () => {
    const d = triageAggressive({ doc_type: 'legal', authority_tier: 'internal', confidence: 0.6, lifecycle: 'signed' }, cur())
    expect(d.authority_score).toBe(90)
  })

  it('does NOT promote a DRAFT contract (falls back to conservative)', () => {
    const d = triageAggressive({ doc_type: 'legal', authority_tier: 'internal', confidence: 0.9, lifecycle: 'draft' }, cur('internal'))
    expect(d.authority_score).toBeUndefined() // no high-authority promotion
    // conservative fallback may still keep/approve at low authority, but never high-authority
  })

  it('does NOT promote a working_paper financial model', () => {
    const d = triageAggressive({ doc_type: 'bp_model', authority_tier: 'internal', confidence: 0.9, lifecycle: 'working_paper' }, cur())
    expect(d.authority_score).toBeUndefined()
  })

  it('does NOT promote a low-confidence high-value doc (needs a confident analysis)', () => {
    const d = triageAggressive({ doc_type: 'legal', authority_tier: 'internal', confidence: 0.4, lifecycle: 'signed' }, cur())
    expect(d.authority_score).toBeUndefined()
  })

  it('does NOT promote a low-value type (e.g. correspondence) even if final', () => {
    const d = triageAggressive({ doc_type: 'correspondence', authority_tier: 'internal', confidence: 0.9, lifecycle: 'signed' }, cur())
    expect(d.authority_score).toBeUndefined()
  })

  it('never promotes a superseded doc', () => {
    const d = triageAggressive({ doc_type: 'legal', authority_tier: 'internal', confidence: 0.9, lifecycle: 'superseded' }, cur())
    expect(d.authority_score).toBeUndefined()
  })
})
