import { afterEach, describe, expect, it } from 'vitest'
import { isAuthorizedCronRequest } from '@/lib/cron-auth'

const originalCronSecret = process.env.CRON_SECRET

afterEach(() => {
  if (originalCronSecret === undefined) delete process.env.CRON_SECRET
  else process.env.CRON_SECRET = originalCronSecret
})

describe('isAuthorizedCronRequest', () => {
  it('fails closed when CRON_SECRET is missing', () => {
    delete process.env.CRON_SECRET

    expect(isAuthorizedCronRequest('Bearer expected')).toBe(false)
  })

  it('fails closed when the Authorization header is missing', () => {
    expect(isAuthorizedCronRequest(null, 'expected')).toBe(false)
  })

  it('accepts only the exact bearer token', () => {
    expect(isAuthorizedCronRequest('Bearer expected', 'expected')).toBe(true)
    expect(isAuthorizedCronRequest('Bearer rejected', 'expected')).toBe(false)
    expect(isAuthorizedCronRequest('Basic expected', 'expected')).toBe(false)
  })

  it('rejects prefix and suffix collisions without throwing on length mismatch', () => {
    expect(() => isAuthorizedCronRequest('Bearer expected-suffix', 'expected')).not.toThrow()
    expect(() => isAuthorizedCronRequest('Bearer expect', 'expected')).not.toThrow()

    expect(isAuthorizedCronRequest('Bearer expected-suffix', 'expected')).toBe(false)
    expect(isAuthorizedCronRequest('Bearer expect', 'expected')).toBe(false)
  })
})
