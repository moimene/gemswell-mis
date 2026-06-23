import { createClient as createSupabaseClient, type User } from '@supabase/supabase-js'

export type AdminUserAccessRole = 'admin' | 'user'

export type AdminUserRow = {
  id: string
  email: string
  createdAt: string
  updatedAt: string | null
  lastSignInAt: string | null
  emailConfirmedAt: string | null
  confirmed: boolean
  role: AdminUserAccessRole
  isAdmin: boolean
  isCurrentUser: boolean
  providers: string[]
  hasCredentials: boolean
  bannedUntil: string | null
}

export function createAuthAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for user administration')
  }
  return createSupabaseClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export function accessRoleFromUser(user: Pick<User, 'app_metadata'>): AdminUserAccessRole {
  return user.app_metadata?.role === 'admin' ? 'admin' : 'user'
}

export function metadataForRole(
  appMetadata: User['app_metadata'] | null | undefined,
  role: AdminUserAccessRole,
): User['app_metadata'] {
  return { ...(appMetadata ?? {}), role }
}

export function serializeAdminUser(user: User, currentUserId?: string): AdminUserRow {
  const providers = new Set<string>()
  const metadataProviders = user.app_metadata?.providers
  if (Array.isArray(metadataProviders)) {
    metadataProviders.forEach((provider) => {
      if (typeof provider === 'string' && provider.trim()) providers.add(provider)
    })
  }
  if (typeof user.app_metadata?.provider === 'string' && user.app_metadata.provider.trim()) {
    providers.add(user.app_metadata.provider)
  }
  user.identities?.forEach((identity) => {
    if (identity.provider) providers.add(identity.provider)
  })
  if (user.email && providers.size === 0) providers.add('email')

  const role = accessRoleFromUser(user)
  const emailConfirmedAt = user.email_confirmed_at ?? user.confirmed_at ?? null

  return {
    id: user.id,
    email: user.email ?? '',
    createdAt: user.created_at,
    updatedAt: user.updated_at ?? null,
    lastSignInAt: user.last_sign_in_at ?? null,
    emailConfirmedAt,
    confirmed: Boolean(emailConfirmedAt),
    role,
    isAdmin: role === 'admin',
    isCurrentUser: user.id === currentUserId,
    providers: [...providers].sort(),
    hasCredentials: Boolean(user.email || user.phone || providers.size > 0),
    bannedUntil: user.banned_until ?? null,
  }
}
