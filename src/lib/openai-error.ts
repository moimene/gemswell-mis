import { providerErrorSummary, sanitizeProviderError } from './provider-error'

export type SanitizedOpenAIError = {
  status?: number
  code?: string
  type?: string
  message: string
}

export function sanitizeOpenAIError(err: unknown): SanitizedOpenAIError {
  return sanitizeProviderError(err, 'OpenAI request failed')
}

export function openAIErrorSummary(err: unknown): string {
  return providerErrorSummary(err, 'OpenAI request failed')
}

export function isOpenAIQuotaError(err: unknown): boolean {
  const e = sanitizeOpenAIError(err)
  const text = `${e.code ?? ''} ${e.type ?? ''} ${e.message}`.toLowerCase()
  return /insufficient_quota|current quota|billing quota|run out of credits|credit balance|no balance|usage limit/.test(text)
}
