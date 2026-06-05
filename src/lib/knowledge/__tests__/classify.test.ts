import { describe, it, expect } from 'vitest'
import { liftUpFromChunks, decideReviewStatus } from '@/lib/knowledge/classify'

describe('liftUpFromChunks', () => {
  it('takes max authority and modal doc_type/project', () => {
    const r = liftUpFromChunks([
      { authority: '95', doc_type: 'legal', project_id: 'MAD' },
      { authority: '95', doc_type: 'legal', project_id: 'MAD' },
      { authority: 80, doc_type: 'board', project_id: 'MAD' },
    ])
    expect(r.authority_score).toBe(95)
    expect(r.authority_tier).toBe('audited')
    expect(r.doc_type).toBe('legal')
    expect(r.project_id).toBe('MAD')
    expect(r.confidence).toBeCloseTo(2 / 3, 5)
  })

  it('returns nulls and zero confidence for empty/sparse metadata', () => {
    const r = liftUpFromChunks([{ doc_type: 'other' }, {}])
    expect(r.authority_score).toBeNull()
    expect(r.authority_tier).toBe('unverified')
    expect(r.doc_type).toBe('other')
  })
})

describe('decideReviewStatus', () => {
  it('approves confident, fully-classified docs (threshold 0.5)', () => {
    expect(decideReviewStatus({ doc_type: 'legal', authority_tier: 'audited', confidence: 0.6 })).toBe('approved')
  })
  it('sends ambiguous docs to needs_review', () => {
    expect(decideReviewStatus({ doc_type: 'other', authority_tier: 'controller', confidence: 0.9 })).toBe('needs_review')
    expect(decideReviewStatus({ doc_type: 'legal', authority_tier: 'unverified', confidence: 0.9 })).toBe('needs_review')
    expect(decideReviewStatus({ doc_type: 'legal', authority_tier: 'audited', confidence: 0.4 })).toBe('needs_review')
  })
})
