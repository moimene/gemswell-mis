import { describe, expect, it } from 'vitest'
import type { User } from '@supabase/supabase-js'
import { accessRoleFromUser, metadataForRole, serializeAdminUser } from '@/lib/admin-users'

function user(partial: Partial<User>): User {
  return {
    id: 'user-1',
    aud: 'authenticated',
    app_metadata: {},
    user_metadata: {},
    created_at: '2026-06-01T00:00:00Z',
    ...partial,
  }
}

describe('admin-users helpers', () => {
  it('maps only app_metadata.role=admin to admin access', () => {
    expect(accessRoleFromUser(user({ app_metadata: { role: 'admin' } }))).toBe('admin')
    expect(accessRoleFromUser(user({ app_metadata: { role: 'user' } }))).toBe('user')
    expect(accessRoleFromUser(user({ app_metadata: {} }))).toBe('user')
  })

  it('updates the access role without dropping other app metadata', () => {
    expect(metadataForRole({ provider: 'email', plan: 'internal' }, 'admin')).toEqual({
      provider: 'email',
      plan: 'internal',
      role: 'admin',
    })
  })

  it('serializes credential and current-user state for the UI', () => {
    const row = serializeAdminUser(
      user({
        id: 'admin-1',
        email: 'admin@gemswell.surf',
        app_metadata: { role: 'admin', provider: 'email' },
        email_confirmed_at: '2026-06-02T00:00:00Z',
        last_sign_in_at: '2026-06-03T00:00:00Z',
      }),
      'admin-1',
    )

    expect(row).toMatchObject({
      id: 'admin-1',
      email: 'admin@gemswell.surf',
      role: 'admin',
      isAdmin: true,
      isCurrentUser: true,
      confirmed: true,
      providers: ['email'],
      hasCredentials: true,
    })
  })
})
