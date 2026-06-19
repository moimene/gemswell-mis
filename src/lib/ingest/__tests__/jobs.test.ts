import { describe, expect, it } from 'vitest'
import { isNonRetryableJobError, MAX_INGEST_JOB_BYTES, validateIngestJobInput } from '../jobs'

describe('ingest jobs validation', () => {
  it('accepts a valid Storage upload path and file type', () => {
    const out = validateIngestJobInput({
      storagePath: 'uploads/00000000-0000-0000-0000-000000000000/file.pdf',
      fileName: 'file.pdf',
      fileSize: 1024,
      projectId: 'MAD',
    })
    expect(out).toEqual({ fileExt: '.pdf', projectId: 'MAD' })
  })

  it('accepts legacy Word .doc files for the LlamaParse ingest path', () => {
    const out = validateIngestJobInput({
      storagePath: 'uploads/00000000-0000-0000-0000-000000000000/old-contract.doc',
      fileName: 'old-contract.doc',
      fileSize: 1024,
      projectId: 'KLP',
    })
    expect(out).toEqual({ fileExt: '.doc', projectId: 'KLP' })
  })

  it('rejects arbitrary Storage paths', () => {
    expect(() => validateIngestJobInput({
      storagePath: 'artifacts/doc/v1.md',
      fileName: 'file.pdf',
      fileSize: 1024,
    })).toThrow(/storagePath inválido/)
  })

  it('rejects oversized files server-side', () => {
    expect(() => validateIngestJobInput({
      storagePath: 'uploads/00000000-0000-0000-0000-000000000000/file.pdf',
      fileName: 'file.pdf',
      fileSize: MAX_INGEST_JOB_BYTES + 1,
    })).toThrow(/supera el límite/)
  })
})

describe('ingest job retry classification', () => {
  it('treats parser near-empty output as non-retryable', () => {
    expect(isNonRetryableJobError('LlamaParse returned near-empty result (1 chars) for bad.txt')).toBe(true)
  })

  it('leaves transient provider failures retryable', () => {
    expect(isNonRetryableJobError('Gemini 429 rate limit')).toBe(false)
  })
})
