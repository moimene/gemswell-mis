import { describe, expect, it } from 'vitest'
import { canDeleteFailedDocument, canRetryFailedDocument } from '@/lib/knowledge/failed-document-actions'

describe('failed document actions', () => {
  it('allows retry for failed documents that still have an original storage path and title', () => {
    expect(canRetryFailedDocument({ status: 'error', title: 'bad.pdf', storage_path: 'uploads/a/bad.pdf' })).toEqual({ ok: true })
  })

  it('rejects retry without the original uploaded file', () => {
    expect(canRetryFailedDocument({ status: 'error', title: 'bad.pdf', storage_path: null })).toEqual({
      ok: false,
      reason: 'Este documento fallido no conserva el archivo original en Storage.',
    })
  })

  it('never retries or deletes indexed documents', () => {
    expect(canRetryFailedDocument({ status: 'indexed', title: 'ok.pdf', storage_path: 'uploads/a/ok.pdf' }).ok).toBe(false)
    expect(canDeleteFailedDocument({ status: 'indexed', title: 'ok.pdf', storage_path: 'uploads/a/ok.pdf' }).ok).toBe(false)
  })

  it('allows delete only for failed documents', () => {
    expect(canDeleteFailedDocument({ status: 'error' })).toEqual({ ok: true })
  })
})
