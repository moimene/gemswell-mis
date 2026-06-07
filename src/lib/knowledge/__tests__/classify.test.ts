import { describe, it, expect } from 'vitest'
import { liftUpFromChunks, decideReviewStatus, buildClassifyPrompt, parseClassifyResponse, classifyResultSchema } from '@/lib/knowledge/classify'
import { DOC_TYPES } from '@/lib/knowledge/contracts'

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
  it('approves confident, fully-classified docs of a non-high-authority tier (threshold 0.5)', () => {
    expect(decideReviewStatus({ doc_type: 'legal', authority_tier: 'board_pack', confidence: 0.6 })).toBe('approved')
    expect(decideReviewStatus({ doc_type: 'funding', authority_tier: 'internal', confidence: 0.7 })).toBe('approved')
  })
  it('F16: high-authority tiers always require human confirmation, even at high confidence', () => {
    expect(decideReviewStatus({ doc_type: 'legal', authority_tier: 'audited', confidence: 0.95 })).toBe('needs_review')
    expect(decideReviewStatus({ doc_type: 'legal', authority_tier: 'executed', confidence: 0.9 })).toBe('needs_review')
    expect(decideReviewStatus({ doc_type: 'financial_statements', authority_tier: 'controller', confidence: 0.9 })).toBe('needs_review')
  })
  it('sends ambiguous docs to needs_review', () => {
    expect(decideReviewStatus({ doc_type: 'other', authority_tier: 'board_pack', confidence: 0.9 })).toBe('needs_review')
    expect(decideReviewStatus({ doc_type: 'legal', authority_tier: 'unverified', confidence: 0.9 })).toBe('needs_review')
    expect(decideReviewStatus({ doc_type: 'legal', authority_tier: 'board_pack', confidence: 0.4 })).toBe('needs_review')
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

describe('DOC_TYPES taxonomy reconciliation (F8)', () => {
  it('classifyResultSchema doc_type enum options are all in the canonical DOC_TYPES', () => {
    // z.enum stores accepted values in .options (readonly tuple)
    const schemaOptions = (classifyResultSchema.shape.doc_type as { options: readonly string[] }).options
    const canonicalSet = new Set<string>(DOC_TYPES)
    for (const opt of schemaOptions) {
      expect(canonicalSet.has(opt), `"${opt}" is in classifyResultSchema but not in DOC_TYPES`).toBe(true)
    }
  })

  it('canonical DOC_TYPES includes both legacy DocType values and classifier-only values', () => {
    const set = new Set<string>(DOC_TYPES)
    // Values that were only in contracts.ts DocType
    expect(set.has('unknown')).toBe(true)
    // Values that were only in classify.ts DOC_TYPES
    expect(set.has('monitoring')).toBe(true)
    expect(set.has('other')).toBe(true)
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
