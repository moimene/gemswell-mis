import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import { safeRedirectPath } from '@/lib/safe-redirect'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const redirect = safeRedirectPath(request.nextUrl.searchParams.get('redirect')) // CWE-601: same-origin path only
  if (code) {
    const supabase = await createServerSupabase()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.search = ''
      url.searchParams.set('error', 'link_invalid')
      return NextResponse.redirect(url)
    }
  }
  return NextResponse.redirect(new URL(redirect, request.url))
}
