export type SanitizedProviderError = {
  status?: number
  code?: string
  type?: string
  message: string
}

type ProviderErrorLike = {
  status?: unknown
  code?: unknown
  type?: unknown
  message?: unknown
  error?: {
    code?: unknown
    type?: unknown
    message?: unknown
  }
}

type EmbeddedProviderPayload = {
  code?: unknown
  type?: unknown
  message?: unknown
  error?: {
    code?: unknown
    type?: unknown
    message?: unknown
  }
}

const MAX_PROVIDER_ERROR_MESSAGE = 260

function truncate(value: string): string {
  return value.length > MAX_PROVIDER_ERROR_MESSAGE
    ? `${value.slice(0, MAX_PROVIDER_ERROR_MESSAGE - 1).trimEnd()}...`
    : value
}

function parseEmbeddedPayload(message: string): Partial<SanitizedProviderError> {
  const start = message.indexOf('{')
  if (start < 0) return {}
  try {
    const parsed = JSON.parse(message.slice(start)) as EmbeddedProviderPayload
    const code = typeof parsed.error?.code === 'string'
      ? parsed.error.code
      : typeof parsed.code === 'string'
        ? parsed.code
        : undefined
    const type = typeof parsed.error?.type === 'string'
      ? parsed.error.type
      : typeof parsed.type === 'string'
        ? parsed.type
        : undefined
    const text = typeof parsed.error?.message === 'string'
      ? parsed.error.message
      : typeof parsed.message === 'string'
        ? parsed.message
        : undefined
    return { ...(code ? { code } : {}), ...(type ? { type } : {}), ...(text ? { message: text } : {}) }
  } catch {
    return {}
  }
}

export function sanitizeProviderMessage(message: unknown, fallback = 'Provider request failed'): string {
  const raw = typeof message === 'string' && message.trim() ? message : fallback
  return truncate(
    raw
      .replace(/"request_id"\s*:\s*"[^"]+"/gi, '"request_id":"[redacted]"')
      .replace(/\brequest[_ -]?id\s*[:=]\s*[A-Za-z0-9_-]+/gi, 'request_id=[redacted]')
      .replace(/\breq_[A-Za-z0-9_-]+\b/g, '[redacted-request-id]')
      .replace(/\bsk-(?:proj-)?[A-Za-z0-9_-]{8,}\b/g, '[redacted-key]')
      .replace(/\bAIza[A-Za-z0-9_-]{20,}\b/g, '[redacted-key]')
      .replace(/https?:\/\/\S+/g, '[link]')
      .replace(/\s+/g, ' ')
      .trim() || fallback,
  )
}

export function sanitizeProviderError(err: unknown, fallback = 'Provider request failed'): SanitizedProviderError {
  const e = err as ProviderErrorLike
  const status = typeof e?.status === 'number' ? e.status : undefined
  const rawMessage = typeof e?.error?.message === 'string'
    ? e.error.message
    : typeof e?.message === 'string'
      ? e.message
      : fallback
  const embedded = parseEmbeddedPayload(rawMessage)
  const code = typeof e?.error?.code === 'string'
    ? e.error.code
    : typeof e?.code === 'string'
      ? e.code
      : embedded.code
  const type = typeof e?.error?.type === 'string'
    ? e.error.type
    : typeof e?.type === 'string'
      ? e.type
      : embedded.type
  const message = sanitizeProviderMessage(embedded.message ?? rawMessage, fallback)
  return { ...(status != null ? { status } : {}), ...(code ? { code } : {}), ...(type ? { type } : {}), message }
}

export function providerErrorSummary(err: unknown, fallback = 'Provider request failed'): string {
  const e = sanitizeProviderError(err, fallback)
  return [
    e.status != null ? `status=${e.status}` : null,
    e.code ? `code=${e.code}` : null,
    e.type ? `type=${e.type}` : null,
    e.message,
  ].filter(Boolean).join(' ')
}
