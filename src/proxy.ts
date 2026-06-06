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

const PUBLIC_PATHS = [/^\/login(\/|$)/, /^\/auth\//]

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

  const {
    data: { user },
  } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname
  const isPublic = PUBLIC_PATHS.some((re) => re.test(path))

  if (!user && !isPublic) {
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
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
}
