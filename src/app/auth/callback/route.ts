import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import { isAdminUser } from '@/lib/is-admin'
import { safeRedirectPath } from '@/lib/safe-redirect'

function loginWith(request: NextRequest, error: string) {
  const url = request.nextUrl.clone()
  url.pathname = '/login'
  url.search = ''
  url.searchParams.set('error', error)
  return NextResponse.redirect(url)
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const redirect = safeRedirectPath(request.nextUrl.searchParams.get('redirect')) // CWE-601: same-origin path only
  if (code) {
    const supabase = await createServerSupabase()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) return loginWith(request, 'link_invalid')
    // Only seeded admins may proceed; a magic-link recipient without the claim would otherwise be
    // bounced by the proxy with no explanation. Sign them out and tell them why.
    const { data: { user } } = await supabase.auth.getUser()
    if (!isAdminUser(user)) {
      await supabase.auth.signOut()
      return loginWith(request, 'not_admin')
    }
  }
  return NextResponse.redirect(new URL(redirect, request.url))
}
