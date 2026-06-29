import { describe, expect, it } from 'vitest'
import { evaluateReleaseReadiness } from '../release-readiness'

const strictDocChatE2E = {
  ok: true,
  failedRequests: [],
  consoleMessages: [],
  results: [
    {
      step: 'dms-smart-search-santander-bbva',
      ok: true,
      details: { topExpectedDoc: true, graphUsed: true, rerankOrModelUsed: true },
    },
    {
      step: 'dms-smart-search-buenavista',
      ok: true,
      details: { topExpectedDoc: true, graphUsed: true, rerankOrModelUsed: true },
    },
  ],
}

const strictDocIngestE2E = {
  ok: true,
  failedRequests: [],
  consoleMessages: [],
  cleanup: { ok: true },
  results: [],
}

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
      docChatE2E: strictDocChatE2E,
      docIngestE2E: strictDocIngestE2E,
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
      docChatE2E: strictDocChatE2E,
      docIngestE2E: strictDocIngestE2E,
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
      docChatE2E: strictDocChatE2E,
      docIngestE2E: strictDocIngestE2E,
    }).failures).toContain('No live-rag-e2e run evidence was provided.')

    const failed = evaluateReleaseReadiness({
      health: { ok: true, model: 'gpt-5.5' },
      liveRun: { workflowName: 'live-rag-e2e', status: 'completed', conclusion: 'failure', headSha: 'abc' },
      expectedSha: 'def',
      docChatE2E: strictDocChatE2E,
      docIngestE2E: strictDocIngestE2E,
    })
    expect(failed.ok).toBe(false)
    expect(failed.failures).toContain('live-rag-e2e did not conclude success.')
    expect(failed.failures).toContain('live-rag-e2e SHA does not match expected release SHA.')
  })

  it('requires the expected release SHA so old green live runs cannot be reused accidentally', () => {
    const result = evaluateReleaseReadiness({
      health: { ok: true, model: 'gpt-5.5' },
      liveRun: {
        workflowName: 'live-rag-e2e',
        status: 'completed',
        conclusion: 'success',
        headSha: 'old-green-sha',
      },
      docChatE2E: strictDocChatE2E,
      docIngestE2E: strictDocIngestE2E,
    })

    expect(result.ok).toBe(false)
    expect(result.checks.expectedShaProvided).toBe(false)
    expect(result.checks.liveRunShaMatches).toBe(false)
    expect(result.failures).toContain('Expected release SHA was not provided.')
    expect(result.failures).not.toContain('live-rag-e2e SHA does not match expected release SHA.')
    expect(result.nextActions).toContain('Pass --expected-sha with the exact release commit SHA.')
  })

  it('requires strict local documentary E2E evidence', () => {
    const missing = evaluateReleaseReadiness({
      health: { ok: true, model: 'gpt-5.5' },
      liveRun: { workflowName: 'live-rag-e2e', status: 'completed', conclusion: 'success', headSha: 'release-sha' },
      expectedSha: 'release-sha',
    })
    expect(missing.ok).toBe(false)
    expect(missing.failures).toContain('Strict document-chat E2E evidence was not provided.')
    expect(missing.failures).toContain('Strict document-ingest E2E evidence was not provided.')

    const degraded = evaluateReleaseReadiness({
      health: { ok: true, model: 'gpt-5.5' },
      liveRun: { workflowName: 'live-rag-e2e', status: 'completed', conclusion: 'success', headSha: 'release-sha' },
      expectedSha: 'release-sha',
      docChatE2E: {
        ...strictDocChatE2E,
        results: strictDocChatE2E.results.map((result) =>
          result.step === 'dms-smart-search-santander-bbva'
            ? { ...result, details: { ...result.details, rerankOrModelUsed: false, localRankingFallbackVisible: true } }
            : result,
        ),
      },
      docIngestE2E: strictDocIngestE2E,
    })

    expect(degraded.ok).toBe(false)
    expect(degraded.failures).toContain('Strict document-chat E2E did not prove model/rerank usage for critical smart searches.')
    expect(degraded.nextActions).toContain('Run strict local production documentary E2E with E2E_SUMMARY_DIR and without E2E_ALLOW_SMART_MODEL_FALLBACK.')
  })
})
