import { describe, it, expect } from 'vitest'
import { computeGovernanceAction, InvalidTransitionError } from '@/lib/knowledge/governance-actions'
import type { DocGovernanceState } from '@/lib/knowledge/contracts'

const base: DocGovernanceState = {
  review_status: 'needs_review',
  classification_source: 'agent_auto',
  status: 'indexed',
  authority_score: 95,
  authority_tier: 'audited',
  current_version: 1,
  supersedes_document_id: null,
}

describe('computeGovernanceAction', () => {
  it('approve from needs_review (machine) → approved + agent_reviewed + event', () => {
    const r = computeGovernanceAction({ action: 'approve', documentId: 'd1', current: base, actor: 'admin:console' })
    expect(r.patch.review_status).toBe('approved')
    expect(r.patch.classification_source).toBe('agent_reviewed')
    expect(r.events).toHaveLength(1)
    expect(r.events[0]).toMatchObject({ document_id: 'd1', action: 'approve', actor: 'admin:console' })
  })

  it('approve on already-approved machine doc → endorses (classification_source→agent_reviewed)', () => {
    const r = computeGovernanceAction({ action: 'approve', documentId: 'd1',
      current: { ...base, review_status: 'approved', classification_source: 'rule' }, actor: 'a' })
    expect(r.patch.review_status).toBe('approved')
    expect(r.patch.classification_source).toBe('agent_reviewed')
  })

  it('approve never downgrades agent_corrected', () => {
    const r = computeGovernanceAction({ action: 'approve', documentId: 'd1',
      current: { ...base, review_status: 'approved', classification_source: 'agent_corrected' }, actor: 'a' })
    expect(r.patch.classification_source).toBeUndefined() // unchanged → not in patch
  })

  it('reject → rejected, classification_source untouched', () => {
    const r = computeGovernanceAction({ action: 'reject', documentId: 'd1', current: base, actor: 'a', reason: 'dup' })
    expect(r.patch.review_status).toBe('rejected')
    expect(r.patch.classification_source).toBeUndefined()
    expect(r.events[0]).toMatchObject({ action: 'reject', reason: 'dup' })
  })

  it('reclassify derives authority_score from tier when only tier given, sets agent_corrected', () => {
    const r = computeGovernanceAction({ action: 'reclassify', documentId: 'd1',
      current: { ...base, authority_score: 0, authority_tier: 'unverified' },
      fields: { doc_type: 'legal', authority_tier: 'controller' }, actor: 'a' })
    expect(r.patch.doc_type).toBe('legal')
    expect(r.patch.authority_tier).toBe('controller')
    expect(r.patch.authority_score).toBe(80) // AUTHORITY_TIER_SCORE.controller
    expect(r.patch.classification_source).toBe('agent_corrected')
    expect(r.events.length).toBeGreaterThanOrEqual(1)
  })

  it('reclassify respects explicit authority_score over tier default', () => {
    const r = computeGovernanceAction({ action: 'reclassify', documentId: 'd1', current: base,
      fields: { authority_tier: 'controller', authority_score: 88 }, actor: 'a' })
    expect(r.patch.authority_score).toBe(88)
  })

  it('retire from indexed → status retired', () => {
    const r = computeGovernanceAction({ action: 'retire', documentId: 'd1', current: base, actor: 'a' })
    expect(r.patch.status).toBe('retired')
  })

  it('retire when already retired → InvalidTransitionError', () => {
    expect(() => computeGovernanceAction({ action: 'retire', documentId: 'd1',
      current: { ...base, status: 'retired' }, actor: 'a' })).toThrow(InvalidTransitionError)
  })

  it('restore from retired → status indexed', () => {
    const r = computeGovernanceAction({ action: 'restore', documentId: 'd1',
      current: { ...base, status: 'retired' }, actor: 'a' })
    expect(r.patch.status).toBe('indexed')
  })

  it('restore when not retired → InvalidTransitionError', () => {
    expect(() => computeGovernanceAction({ action: 'restore', documentId: 'd1', current: base, actor: 'a' }))
      .toThrow(InvalidTransitionError)
  })

  it('supersede: new doc links old, old doc retired+superseded, version bumps, events on both', () => {
    const oldDoc: DocGovernanceState = { ...base, current_version: 3 }
    const r = computeGovernanceAction({ action: 'supersede', documentId: 'new1', current: base,
      supersede: { oldId: 'old1', oldDoc }, actor: 'a', reason: 'v4 signed' })
    expect(r.patch.supersedes_document_id).toBe('old1')
    expect(r.patch.current_version).toBe(4) // max(1, 3+1)
    expect(r.related).toEqual({ id: 'old1', patch: { status: 'retired', lifecycle: 'superseded' } })
    const docIds = r.events.map(e => e.document_id).sort()
    expect(docIds).toEqual(['new1', 'old1'])
  })

  it('supersede self → InvalidTransitionError', () => {
    expect(() => computeGovernanceAction({ action: 'supersede', documentId: 'd1', current: base,
      supersede: { oldId: 'd1', oldDoc: base }, actor: 'a' })).toThrow(InvalidTransitionError)
  })
})
