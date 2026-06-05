import { describe, it, expect } from 'vitest'
import { liftUpFromChunks, decideReviewStatus, buildClassifyPrompt, parseClassifyResponse } from '@/lib/knowledge/classify'

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

describe('buildClassifyPrompt', () => {
  it('includes title and sample text and asks for JSON', () => {
    const p = buildClassifyPrompt({ title: 'Acta JG', sample: 'aumento de capital', dmsFolder: '03. Legal' })
    expect(p).toContain('Acta JG')
    expect(p).toContain('aumento de capital')
    expect(p).toContain('JSON')
  })
})

describe('parseClassifyResponse', () => {
  it('parses valid JSON (even with prose/code fences around it)', () => {
    const r = parseClassifyResponse('Here:\n```json\n{"doc_type":"legal","authority_tier":"executed","lifecycle":"signed","period":"2026","currency":"EUR","topics":["capital"],"summary":"Acta de aumento de capital","confidence":0.8}\n```')
    expect(r).not.toBeNull()
    expect(r!.doc_type).toBe('legal')
    expect(r!.authority_tier).toBe('executed')
    expect(r!.confidence).toBe(0.8)
  })
  it('returns null on garbage', () => {
    expect(parseClassifyResponse('no json here')).toBeNull()
  })
})
