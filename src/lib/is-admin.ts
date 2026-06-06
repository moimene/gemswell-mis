/**
 * True only for a seeded admin (app_metadata.role === 'admin'). Bare `authenticated` is NOT enough:
 * a self-signed-up user must get nothing even if Supabase project signups are accidentally enabled (CX-1).
 * Single source of truth for the admin gate — used by the proxy, requireUser, and mirrored by the RLS
 * policy in sql/013 (auth.jwt() app_metadata.role = 'admin'). Pure (no next/headers) so the proxy can import it.
 */
export function isAdminUser(
  user: { app_metadata?: Record<string, unknown> | null } | null | undefined,
): boolean {
  return user?.app_metadata?.role === 'admin'
}
