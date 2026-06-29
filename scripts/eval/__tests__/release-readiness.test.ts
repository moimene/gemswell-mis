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

const strictSmartSearchEval = {
  rows: [
    { id: 'smart-mad-santander-bbva-cost', pass: true, rank: 1, snippetOk: true, entityOk: true },
    { id: 'smart-mad-buenavista-conditions', pass: true, rank: 1, snippetOk: true, entityOk: true },
    { id: 'smart-klp-pacto-socios', pass: true, rank: 1, snippetOk: true, entityOk: true },
  ],
}

const strictRetrievalEval = {
  summary: {
    ok: true,
    failures: [],
    documentary: {
      total: 3,
      pinned: 3,
      titleOnly: 0,
      cross: { total: 3, recallAt1: 1, recallAt3: 1, recallAt5: 1, recallAt10: 1, mrr: 1 },
    },
    latency: { degradedCount: 0 },
  },
}

const productOkLiveEvidence = {
  ok: false,
  productOk: true,
  classification: {
    providerBlockers: [{ gate: 'openai-health' }],
    transientProviderFailures: [],
    productFailures: [],
    missing: [],
    passed: [
      { gate: 'smart-search' },
      { gate: 'retrieval' },
      { gate: 'prompt-behavior' },
      { gate: 'answers' },
      { gate: 'governance' },
      { gate: 'document-chat' },
      { gate: 'document-ingest' },
    ],
  },
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
      smartSearchEval: strictSmartSearchEval,
      retrievalEval: strictRetrievalEval,
    })

    expect(result.ok).toBe(false)
    expect(result.checks.openAIHealthOk).toBe(false)
    expect(result.checks.openAINotQuotaBlocked).toBe(false)
    expect(result.failures).toContain('OpenAI health is blocked by quota_or_billing.')
    expect(result.nextActions).toContain('Resolve OpenAI billing/limits before investigating RAG.')
    expect(result.nextActions).toContain('Do not use E2E_ALLOW_SMART_MODEL_FALLBACK as release evidence.')
  })

  it('keeps product-green live evidence separate from strict provider release blockers', () => {
    const result = evaluateReleaseReadiness({
      health: {
        ok: false,
        model: 'gpt-5.5',
        failure: { class: 'quota_or_billing', status: 429, code: 'insufficient_quota' },
      },
      liveRun: {
        workflowName: 'live-rag-e2e',
        status: 'completed',
        conclusion: 'failure',
        headSha: 'release-sha',
        databaseId: 28403619381,
      },
      expectedSha: 'release-sha',
      docChatE2E: strictDocChatE2E,
      docIngestE2E: strictDocIngestE2E,
      smartSearchEval: strictSmartSearchEval,
      retrievalEval: strictRetrievalEval,
      liveEvidence: productOkLiveEvidence,
    })

    expect(result.ok).toBe(false)
    expect(result.checks.liveEvidenceProductOk).toBe(true)
    expect(result.evidence.liveEvidenceArtifact).toBe(true)
    expect(result.evidence.liveEvidenceProductOk).toBe(true)
    expect(result.evidence.liveEvidenceProviderBlockers).toBe(1)
    expect(result.evidence.liveEvidenceProductFailures).toBe(0)
    expect(result.failures).toContain('OpenAI health is blocked by quota_or_billing.')
    expect(result.failures).toContain('live-rag-e2e did not conclude success.')
    expect(result.failures).not.toContain('Live evidence summary has product failures or missing gates.')
  })

  it('fails release readiness when live evidence reports product failures', () => {
    const result = evaluateReleaseReadiness({
      health: { ok: true, model: 'gpt-5.5' },
      liveRun: {
        workflowName: 'live-rag-e2e',
        status: 'completed',
        conclusion: 'success',
        headSha: 'release-sha',
        databaseId: 28403619381,
      },
      expectedSha: 'release-sha',
      docChatE2E: strictDocChatE2E,
      docIngestE2E: strictDocIngestE2E,
      smartSearchEval: strictSmartSearchEval,
      retrievalEval: strictRetrievalEval,
      liveEvidence: {
        ...productOkLiveEvidence,
        productOk: false,
        classification: {
          ...productOkLiveEvidence.classification,
          productFailures: [{ gate: 'document-chat' }],
        },
      },
    })

    expect(result.ok).toBe(false)
    expect(result.checks.liveEvidenceProductOk).toBe(false)
    expect(result.failures).toContain('Live evidence summary has product failures or missing gates.')
    expect(result.nextActions).toContain('Inspect live-evidence-summary.json productFailures before release.')
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
      smartSearchEval: strictSmartSearchEval,
      retrievalEval: strictRetrievalEval,
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
      smartSearchEval: strictSmartSearchEval,
      retrievalEval: strictRetrievalEval,
    }).failures).toContain('No live-rag-e2e run evidence was provided.')

    const failed = evaluateReleaseReadiness({
      health: { ok: true, model: 'gpt-5.5' },
      liveRun: { workflowName: 'live-rag-e2e', status: 'completed', conclusion: 'failure', headSha: 'abc' },
      expectedSha: 'def',
      docChatE2E: strictDocChatE2E,
      docIngestE2E: strictDocIngestE2E,
      smartSearchEval: strictSmartSearchEval,
      retrievalEval: strictRetrievalEval,
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
      smartSearchEval: strictSmartSearchEval,
      retrievalEval: strictRetrievalEval,
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
      smartSearchEval: strictSmartSearchEval,
      retrievalEval: strictRetrievalEval,
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
      smartSearchEval: strictSmartSearchEval,
      retrievalEval: strictRetrievalEval,
    })

    expect(degraded.ok).toBe(false)
    expect(degraded.failures).toContain('Strict document-chat E2E did not prove model/rerank usage for critical smart searches.')
    expect(degraded.nextActions).toContain('Run strict local production documentary E2E with E2E_SUMMARY_DIR and without E2E_ALLOW_SMART_MODEL_FALLBACK.')
  })

  it('requires smart-search and retrieval eval evidence', () => {
    const missing = evaluateReleaseReadiness({
      health: { ok: true, model: 'gpt-5.5' },
      liveRun: { workflowName: 'live-rag-e2e', status: 'completed', conclusion: 'success', headSha: 'release-sha' },
      expectedSha: 'release-sha',
      docChatE2E: strictDocChatE2E,
      docIngestE2E: strictDocIngestE2E,
    })
    expect(missing.ok).toBe(false)
    expect(missing.failures).toContain('Smart-search eval evidence was not provided.')
    expect(missing.failures).toContain('Retrieval eval evidence was not provided.')

    const bad = evaluateReleaseReadiness({
      health: { ok: true, model: 'gpt-5.5' },
      liveRun: { workflowName: 'live-rag-e2e', status: 'completed', conclusion: 'success', headSha: 'release-sha' },
      expectedSha: 'release-sha',
      docChatE2E: strictDocChatE2E,
      docIngestE2E: strictDocIngestE2E,
      smartSearchEval: {
        rows: strictSmartSearchEval.rows.map((row) =>
          row.id === 'smart-mad-santander-bbva-cost' ? { ...row, rank: 2 } : row,
        ),
      },
      retrievalEval: {
        summary: {
          ...strictRetrievalEval.summary,
          ok: false,
          failures: ['miss'],
          documentary: {
            ...strictRetrievalEval.summary.documentary,
            titleOnly: 1,
            cross: { ...strictRetrievalEval.summary.documentary.cross, recallAt1: 0.5 },
          },
        },
      },
    })
    expect(bad.ok).toBe(false)
    expect(bad.failures).toContain('Smart-search eval did not rank critical funding contracts at #1.')
    expect(bad.failures).toContain('Retrieval eval summary was not ok.')
    expect(bad.failures).toContain('Retrieval eval did not prove documentary recall@1 and recall@5 at 100%.')
    expect(bad.nextActions).toContain('Run eval:smart-search and eval:retrieval, then provide their JSON evidence.')
  })
})
