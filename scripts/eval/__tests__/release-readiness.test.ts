import { describe, expect, it } from 'vitest'
import { evaluateReleaseReadiness } from '../release-readiness'

describe('release readiness evaluator', () => {
  it('blocks release when OpenAI is quota blocked even if a prior live run was green', () => {
    const result = evaluateReleaseReadiness({
      health: {
        ok: false,
        model: 'gpt-5.5',
        failure: { class: 'quota_or_billing', status: 429, code: 'insufficient_quota' },
      },
      liveRun: {
        workflowName: 'live-rag-e2e',
        status: 'completed',
        conclusion: 'success',
        headSha: 'abc',
        databaseId: 1,
      },
      expectedSha: 'abc',
    })

    expect(result.ok).toBe(false)
    expect(result.checks.openAIHealthOk).toBe(false)
    expect(result.checks.openAINotQuotaBlocked).toBe(false)
    expect(result.failures).toContain('OpenAI health is blocked by quota_or_billing.')
    expect(result.nextActions).toContain('Resolve OpenAI billing/limits before investigating RAG.')
    expect(result.nextActions).toContain('Do not use E2E_ALLOW_SMART_MODEL_FALLBACK as release evidence.')
  })

  it('passes only when health and latest live run evidence are both green', () => {
    const result = evaluateReleaseReadiness({
      health: { ok: true, model: 'gpt-5.5' },
      liveRun: {
        workflowName: 'live-rag-e2e',
        status: 'completed',
        conclusion: 'success',
        headSha: 'release-sha',
        databaseId: 28380967059,
      },
      expectedSha: 'release-sha',
    })

    expect(result.ok).toBe(true)
    expect(Object.values(result.checks).every(Boolean)).toBe(true)
    expect(result.failures).toEqual([])
    expect(result.nextActions[0]).toMatch(/strict local production E2E/)
  })

  it('blocks release when the live run is missing, failed or from another SHA', () => {
    expect(evaluateReleaseReadiness({
      health: { ok: true, model: 'gpt-5.5' },
      liveRun: null,
      expectedSha: 'abc',
    }).failures).toContain('No live-rag-e2e run evidence was provided.')

    const failed = evaluateReleaseReadiness({
      health: { ok: true, model: 'gpt-5.5' },
      liveRun: { workflowName: 'live-rag-e2e', status: 'completed', conclusion: 'failure', headSha: 'abc' },
      expectedSha: 'def',
    })
    expect(failed.ok).toBe(false)
    expect(failed.failures).toContain('live-rag-e2e did not conclude success.')
    expect(failed.failures).toContain('live-rag-e2e SHA does not match expected release SHA.')
  })
})
