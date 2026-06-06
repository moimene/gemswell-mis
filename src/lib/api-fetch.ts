'use client'

/** Error thrown by apiJson for any non-ok response. `status` is the HTTP status (0 = network/parse). */
export class ApiError extends Error {
  status: number
  body: unknown
  constructor(message: string, status: number, body?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

/**
 * Shared client fetch for the JSON API surface. Centralises the post-cutover 401 contract:
 * when an admin session expires mid-page, the proxy returns 401 JSON — instead of every page
 * having to detect that, this helper bounces the user to /login (preserving where they were)
 * and throws ApiError(401) so the caller's catch can stop. Non-401 errors throw ApiError too,
 * so callers can render a real error state instead of a hung spinner or a silent empty list.
 */
export async function apiJson<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  let r: Response
  try {
    r = await fetch(url, init)
  } catch (e) {
    throw new ApiError(e instanceof Error ? e.message : 'network error', 0)
  }
  if (r.status === 401) {
    if (typeof window !== 'undefined') {
      const here = window.location.pathname + window.location.search
      window.location.assign(`/login?redirect=${encodeURIComponent(here)}`)
    }
    throw new ApiError('unauthorized', 401)
  }
  const body = await r.json().catch(() => null)
  if (!r.ok) {
    const msg = (body && typeof body === 'object' && 'error' in body && typeof (body as { error: unknown }).error === 'string')
      ? (body as { error: string }).error
      : `HTTP ${r.status}`
    throw new ApiError(msg, r.status, body)
  }
  return body as T
}
