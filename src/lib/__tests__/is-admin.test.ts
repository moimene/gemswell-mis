import { describe, it, expect } from 'vitest'
import { isAdminUser } from '@/lib/is-admin'

describe('isAdminUser', () => {
  it('true only for app_metadata.role === "admin"', () => {
    expect(isAdminUser({ app_metadata: { role: 'admin' } })).toBe(true)
  })
  it('false for authenticated-but-not-admin, missing claim, or null (CX-1)', () => {
    expect(isAdminUser({ app_metadata: {} })).toBe(false)
    expect(isAdminUser({ app_metadata: { role: 'user' } })).toBe(false)
    expect(isAdminUser({ app_metadata: { role: 'authenticated' } })).toBe(false)
    expect(isAdminUser({})).toBe(false)
    expect(isAdminUser(null)).toBe(false)
    expect(isAdminUser(undefined)).toBe(false)
  })
})
