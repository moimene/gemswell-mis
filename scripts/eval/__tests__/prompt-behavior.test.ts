import { describe, expect, it } from 'vitest'
import { isAbstentionText, isClarificationText, isTransientEvalErrorMessage } from '../prompt-behavior-check'

describe('prompt behavior abstention detector', () => {
  it('recognizes English no-evidence abstentions', () => {
    expect(isAbstentionText('Based on a search of the document corpus, there is no evidence of a specific treasury or hedging policy related to crypto.')).toBe(true)
    expect(isAbstentionText('I found no documentary evidence for that policy.')).toBe(true)
  })

  it('does not classify ordinary positive answers as abstentions', () => {
    expect(isAbstentionText('The contract sets a margin of EURIBOR plus 4.00% and cites the financing agreement.')).toBe(false)
  })

  it('recognizes Spanish clarification phrasing from ambiguous cost answers', () => {
    expect(isClarificationText('Para poder responder, necesitaría un poco más de detalle. ¿Se refiere al coste total de la construcción?')).toBe(true)
    expect(isClarificationText('¿Te refieres al coste de financiación o al coste de construcción?')).toBe(true)
  })

  it('classifies provider 503 and timeout errors as retryable but not quota exhaustion', () => {
    expect(isTransientEvalErrorMessage('{"error":{"code":503,"message":"The request timed out.","status":"UNAVAILABLE"}}')).toBe(true)
    expect(isTransientEvalErrorMessage('socket hang up')).toBe(true)
    expect(isTransientEvalErrorMessage('429 insufficient_quota quota_or_billing')).toBe(false)
  })
})
