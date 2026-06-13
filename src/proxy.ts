// Next 16 renamed the `middleware` file convention to `proxy` (function `middleware` -> `proxy`).
// This app keeps `app/` under `src/`, so the proxy file MUST live at `src/proxy.ts` (same level as
// `src/app`). A repo-root `proxy.ts` is silently ignored with this layout (empty middleware manifest,
// zero route protection) — verified during the build.
// This is the canonical @supabase/ssr session-refresh pattern, ported to the Next 16 `proxy` API.
// The cookie handling (getAll/setAll + NextResponse.next({ request })) and `config.matcher` are
// unchanged from the middleware era. Proxy runs on the Node.js runtime (edge is not supported here),
// which is what @supabase/ssr needs.
import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { isAdminUser } from '@/lib/is-admin'

// These cron routes are public TO THE PROXY only: each self-authenticates in its own handler via
// `Authorization: Bearer ${CRON_SECRET}` (fail-closed → 401 without it). Vercel cron sends the secret,
// not a login cookie, so the admin gate below would 401 them before the handlers ran — the bug this fixes.
// EXACT route (not an `/api/cron/` prefix) on purpose: a prefix would make any FUTURE /api/cron/* route
// born proxy-public; listing the route explicitly means each new cron endpoint is opted in deliberately
// (Ronda-1 N1). Traversal-safety relies on Next normalizing the pathname before the proxy sees it
// (skipProxyUrlNormalize stays off — see next.config).
const PUBLIC_PATHS = [/^\/login(\/|$)/, /^\/auth\//, /^\/api\/cron\/ingest-reaper$/, /^\/api\/cron\/ingest-jobs$/]

/** Paths the proxy lets through without the admin gate. Exported for testing the security boundary. */
export function isPublicPath(path: string): boolean {
  return PUBLIC_PATHS.some((re) => re.test(path))
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Fail CLOSED: if Supabase is unreachable or env is misconfigured, getUser() throws — treat that
  // as "not authenticated" (deny) rather than letting the error 500 every request through the proxy.
  let user = null
  try {
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch {
    user = null
  }
  const path = request.nextUrl.pathname
  const isPublic = isPublicPath(path)

  // Must be a seeded ADMIN, not merely authenticated (CX-1: a stray self-signup gets nothing).
  if (!isAdminUser(user) && !isPublic) {
    // API callers get a proper 401 JSON, not an HTML 302 to /login.
    if (path.startsWith('/api/')) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', path)
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  // CX-3: do NOT skip by file extension — a dynamic param like /project/MAD.svg would bypass the guard.
  // Only exclude Next internals + favicon; everything else (pages + /api) runs the proxy.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
