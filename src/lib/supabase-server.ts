import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { isAdminUser } from '@/lib/is-admin'

/** Cookie-aware server client for Server Components / Server Actions */
export async function createServerSupabase() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component
          }
        },
      },
    }
  )
}

/** Lightweight service-role server client for API routes (no cookie dependency).
 *  In production the service-role key is REQUIRED — falling back to the anon key would,
 *  post-RLS-lockdown, silently fail authenticated requests (cutover footgun). Dev keeps the
 *  anon fallback (the service key flickers locally) but warns. */
export function createApiClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY is required in production (no anon fallback for the service client)')
    }
    console.warn('[createApiClient] SUPABASE_SERVICE_ROLE_KEY missing — using anon key (dev only)')
  }
  return createSupabaseClient(url, serviceKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
}

/** Returns the authenticated ADMIN user (validated via getUser + admin claim) or null. Gates API routes. */
export async function requireUser() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  return isAdminUser(user) ? user : null
}
