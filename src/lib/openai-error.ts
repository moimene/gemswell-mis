export type SanitizedOpenAIError = {
  status?: number
  code?: string
  type?: string
  message: string
}

type OpenAIErrorLike = {
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

export function sanitizeOpenAIError(err: unknown): SanitizedOpenAIError {
  const e = err as OpenAIErrorLike
  const status = typeof e?.status === 'number' ? e.status : undefined
  const code = typeof e?.error?.code === 'string'
    ? e.error.code
    : typeof e?.code === 'string'
      ? e.code
      : undefined
  const type = typeof e?.error?.type === 'string'
    ? e.error.type
    : typeof e?.type === 'string'
      ? e.type
      : undefined
  const message = typeof e?.error?.message === 'string'
    ? e.error.message
    : typeof e?.message === 'string'
      ? e.message
      : 'OpenAI request failed'
  return { ...(status != null ? { status } : {}), ...(code ? { code } : {}), ...(type ? { type } : {}), message }
}

export function openAIErrorSummary(err: unknown): string {
  const e = sanitizeOpenAIError(err)
  return [
    e.status != null ? `status=${e.status}` : null,
    e.code ? `code=${e.code}` : null,
    e.type ? `type=${e.type}` : null,
    e.message,
  ].filter(Boolean).join(' ')
}

export function isOpenAIQuotaError(err: unknown): boolean {
  const e = sanitizeOpenAIError(err)
  const text = `${e.code ?? ''} ${e.type ?? ''} ${e.message}`.toLowerCase()
  return /insufficient_quota|current quota|billing quota|run out of credits|credit balance|no balance|usage limit/.test(text)
}
