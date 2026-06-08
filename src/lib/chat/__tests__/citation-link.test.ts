import { describe, it, expect } from 'vitest'
import { citationPage, hasStoredOriginal, originalDownloadHref } from '@/lib/chat/citation-link'

describe('citationPage', () => {
  it('reads a valid 1-based page (number or numeric string)', () => {
    expect(citationPage({ page: 5 })).toBe(5)
    expect(citationPage({ page: '12' })).toBe(12)
  })
  it('returns undefined for missing / invalid / non-positive page', () => {
    expect(citationPage(undefined)).toBeUndefined()
    expect(citationPage({})).toBeUndefined()
    expect(citationPage({ page: 0 })).toBeUndefined()
    expect(citationPage({ page: -3 })).toBeUndefined()
    expect(citationPage({ page: 'x' })).toBeUndefined()
    expect(citationPage({ page: 1.5 })).toBeUndefined()
  })
})

describe('hasStoredOriginal', () => {
  it('true when storage_path present or source_kind=storage', () => {
    expect(hasStoredOriginal({ storage_path: 'uploads/x/a.pdf' })).toBe(true)
    expect(hasStoredOriginal({ source_kind: 'storage' })).toBe(true)
  })
  it('false for legacy docs with no stored original', () => {
    expect(hasStoredOriginal({})).toBe(false)
    expect(hasStoredOriginal({ storage_path: '' })).toBe(false)
    expect(hasStoredOriginal({ source_kind: 'dms_local' })).toBe(false)
    expect(hasStoredOriginal(undefined)).toBe(false)
  })
})

describe('originalDownloadHref', () => {
  it('builds the download URL with a #page fragment when a page is known', () => {
    expect(originalDownloadHref('doc-1', 5)).toBe('/api/knowledge/documents/doc-1/download#page=5')
  })
  it('omits the fragment when no page', () => {
    expect(originalDownloadHref('doc-1')).toBe('/api/knowledge/documents/doc-1/download')
    expect(originalDownloadHref('doc-1', 0)).toBe('/api/knowledge/documents/doc-1/download')
  })
  it('encodes the document id', () => {
    expect(originalDownloadHref('a/b?c')).toBe('/api/knowledge/documents/a%2Fb%3Fc/download')
  })
})
