import { describe, expect, it } from 'vitest'
import { isOpenAIQuotaError, openAIErrorSummary, sanitizeOpenAIError } from '@/lib/openai-error'

describe('OpenAI error helpers', () => {
  it('sanitizes SDK errors without leaking headers or request metadata', () => {
    const err = {
      status: 429,
      headers: { authorization: 'Bearer sk-secret', 'set-cookie': 'secret-cookie' },
      requestID: 'req-secret',
      error: {
        code: 'insufficient_quota',
        type: 'insufficient_quota',
        message: 'You exceeded your current quota.',
      },
    }

    expect(sanitizeOpenAIError(err)).toEqual({
      status: 429,
      code: 'insufficient_quota',
      type: 'insufficient_quota',
      message: 'You exceeded your current quota.',
    })
    expect(openAIErrorSummary(err)).toBe('status=429 code=insufficient_quota type=insufficient_quota You exceeded your current quota.')
    expect(openAIErrorSummary(err)).not.toContain('sk-secret')
    expect(openAIErrorSummary(err)).not.toContain('secret-cookie')
    expect(openAIErrorSummary(err)).not.toContain('req-secret')
  })

  it('classifies exhausted API credits separately from ordinary errors', () => {
    expect(isOpenAIQuotaError({ status: 429, error: { code: 'insufficient_quota', message: 'current quota exceeded' } })).toBe(true)
    expect(isOpenAIQuotaError({ status: 429, error: { message: 'rate_limit_exceeded' } })).toBe(false)
  })
})
