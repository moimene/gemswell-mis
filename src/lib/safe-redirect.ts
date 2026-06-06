/**
 * Returns a safe same-origin, path-absolute redirect target, or '/' for anything unsafe.
 * Rejects absolute URLs, protocol-relative `//host`, backslash tricks (`/\host`, normalized to `//`),
 * `javascript:`/`data:` (don't start with `/`), and control chars. Used at every redirect sink that
 * consumes a client-supplied `redirect` param (login router.replace, /auth/callback). CWE-601/79.
 */
export function safeRedirectPath(raw: string | null | undefined): string {
  if (!raw) return '/'
  if (raw[0] !== '/') return '/'              // absolute URL, javascript:, data:, relative — reject
  if (raw[1] === '/' || raw[1] === '\\') return '/' // //host or /\host (→ //host after normalization)
  for (let i = 0; i < raw.length; i++) {
    const c = raw.charCodeAt(i)
    if (c < 0x20 || c === 0x7f) return '/'   // control chars / newline tricks (no false-reject of '-')
  }
  return raw
}
