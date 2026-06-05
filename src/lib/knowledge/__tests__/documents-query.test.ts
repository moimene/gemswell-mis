import { describe, it, expect } from 'vitest'
import { parseListParams, LIST_COLUMNS } from '@/lib/knowledge/documents-query'

const sp = (o: Record<string, string>) => new URLSearchParams(o)

describe('parseListParams', () => {
  it('defaults: page 1, size 50, no filters', () => {
    const p = parseListParams(sp({}))
    expect(p).toMatchObject({ page: 1, pageSize: 50, offset: 0 })
    expect(p.status).toBeUndefined()
  })
  it('clamps page>=1 and pageSize 1..200', () => {
    expect(parseListParams(sp({ page: '0', pageSize: '999' })).page).toBe(1)
    expect(parseListParams(sp({ pageSize: '999' })).pageSize).toBe(200)
    expect(parseListParams(sp({ page: '3', pageSize: '20' })).offset).toBe(40)
  })
  it('accepts valid enum filters, drops invalid', () => {
    expect(parseListParams(sp({ status: 'needs_review' })).status).toBe('needs_review')
    expect(parseListParams(sp({ status: 'bogus' })).status).toBeUndefined()
    expect(parseListParams(sp({ doc_type: 'legal' })).doc_type).toBe('legal')
    expect(parseListParams(sp({ doc_type: 'nope' })).doc_type).toBeUndefined()
  })
  it('authority_min parsed as int 0..100, q trimmed', () => {
    expect(parseListParams(sp({ authority_min: '90' })).authorityMin).toBe(90)
    expect(parseListParams(sp({ authority_min: '500' })).authorityMin).toBe(100)
    expect(parseListParams(sp({ q: '  acta  ' })).q).toBe('acta')
  })
  it('LIST_COLUMNS includes governance + enrichment fields', () => {
    expect(LIST_COLUMNS).toContain('review_status')
    expect(LIST_COLUMNS).toContain('authority_score')
    expect(LIST_COLUMNS).toContain('chunk_count')
  })
})
