import { describe, expect, it } from 'vitest'
import { providerErrorSummary, sanitizeProviderError, sanitizeProviderMessage } from '@/lib/provider-error'

describe('provider error helpers', () => {
  it('extracts embedded provider JSON and redacts request ids', () => {
    const err = Object.assign(
      new Error('400 {"type":"error","error":{"type":"invalid_request_error","message":"Workspace usage limit reached."},"request_id":"req_011SECRET"}'),
      { status: 400 },
    )

    expect(sanitizeProviderError(err)).toEqual({
      status: 400,
      type: 'invalid_request_error',
      message: 'Workspace usage limit reached.',
    })
    expect(providerErrorSummary(err)).toBe('status=400 type=invalid_request_error Workspace usage limit reached.')
    expect(providerErrorSummary(err)).not.toContain('req_011SECRET')
  })

  it('redacts keys, request ids and support links from plain messages', () => {
    const message = sanitizeProviderMessage(
      'Failure request_id=req_123SECRET key sk-proj-secretsecretsecret docs https://platform.openai.com/docs/guides/error-codes/api-errors',
    )

    expect(message).toContain('request_id=[redacted]')
    expect(message).toContain('[redacted-key]')
    expect(message).toContain('[link]')
    expect(message).not.toContain('req_123SECRET')
    expect(message).not.toContain('sk-proj-secretsecretsecret')
    expect(message).not.toContain('https://')
  })
})
