import { describe, it, expect } from 'vitest'
import { isPublicPath } from '@/proxy'

// The proxy admin-gates everything except isPublicPath(). Cron routes self-authenticate in their own
// handler (CRON_SECRET), so they MUST be public to the proxy — otherwise the request 401s before the
// handler runs (the bug this guards against). Everything sensitive must stay NON-public.
describe('proxy isPublicPath (security boundary)', () => {
  it('lets the reaper cron route through to its own CRON_SECRET-gated handler', () => {
    expect(isPublicPath('/api/cron/ingest-reaper')).toBe(true)
  })

  it('does NOT make the cron prefix or unlisted future cron routes public (exact-route allowlist, N1)', () => {
    expect(isPublicPath('/api/cron/')).toBe(false)
    expect(isPublicPath('/api/cron/foo')).toBe(false)            // a new cron route must be opted in explicitly
    expect(isPublicPath('/api/cron/ingest-reaper/x')).toBe(false)
    expect(isPublicPath('/api/cron/ingest-reaperx')).toBe(false) // anchored end, no prefix-collision
  })

  it('keeps login + auth public (session bootstrap)', () => {
    expect(isPublicPath('/login')).toBe(true)
    expect(isPublicPath('/login/')).toBe(true)
    expect(isPublicPath('/auth/callback')).toBe(true)
  })

  it('does NOT make any other API or page public (admin gate stays on)', () => {
    for (const p of [
      '/api/chat', '/api/knowledge/upload', '/api/knowledge/documents/x/download',
      '/chat', '/inicio', '/project/MAD', '/',
      '/api/cron',        // bare, no trailing slash — must NOT match /^\/api\/cron\//
      '/api/cronx/y',     // prefix-collision guard
      '/loginx',          // must not match /^\/login(\/|$)/
    ]) {
      expect(isPublicPath(p), p).toBe(false)
    }
  })
})
