import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'
import { buildLiveArtifactSummary } from '../summarize-live-artifacts'

const tempRoots: string[] = []

function makeRoot(): { root: string; resultsDir: string; e2eDir: string } {
  const root = mkdtempSync(join(tmpdir(), 'gemswell-live-summary-test-'))
  tempRoots.push(root)
  const resultsDir = join(root, 'results')
  const e2eDir = join(root, 'e2e')
  return { root, resultsDir, e2eDir }
}

function writeJson(path: string, data: unknown): void {
  writeFileSync(path, JSON.stringify(data, null, 2))
}

function writePassingArtifacts(resultsDir: string, e2eDir: string, label: string): void {
  mkdirSync(resultsDir, { recursive: true })
  mkdirSync(e2eDir, { recursive: true })
  writeFileSync(join(resultsDir, '.keep'), '')
  writeFileSync(join(e2eDir, '.keep'), '')
  writeJson(join(resultsDir, `openai-health-${label}.json`), { ok: true, label, model: 'gpt-5.5' })
  writeJson(join(resultsDir, `smart-search-${label}.json`), { label, rows: [{ id: 'smart-mad-santander-bbva-cost', pass: true }] })
  writeJson(join(resultsDir, `retrieval-${label}.json`), { label, summary: { ok: true, failures: [] }, results: [] })
  writeJson(join(resultsDir, `prompt-behavior-${label}.json`), { label, rows: [{ id: 'ambiguous-clarify', pass: true }] })
  writeJson(join(resultsDir, `answers-${label}-critical.json`), {
    label: `${label}-critical`,
    rows: [
      {
        g: { id: 'mad-santander-bbva-bank-cost' },
        verdict: {
          verdict: 'pass',
          faithfulness: 5,
          citation_precision: 5,
          completeness: 5,
          found_ground_truth: true,
          behavior_correct: true,
        },
      },
    ],
  })
  writeJson(join(resultsDir, `governance-${label}-critical.json`), { label: `${label}-critical`, failures: [] })
  writeJson(join(e2eDir, 'document-chat-summary.json'), { ok: true, results: [] })
  writeJson(join(e2eDir, 'document-ingest-summary.json'), { ok: true, results: [] })
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('live artifact summary', () => {
  it('classifies OpenAI quota plus strict chat model evidence as provider-blocked, not product-broken', () => {
    const { resultsDir, e2eDir } = makeRoot()
    const label = 'live-1-1'
    writePassingArtifacts(resultsDir, e2eDir, label)
    writeJson(join(resultsDir, `openai-health-${label}.json`), {
      ok: false,
      failure: { status: 429, code: 'insufficient_quota', class: 'quota_or_billing' },
    })
    writeJson(join(e2eDir, 'document-chat-summary.json'), {
      ok: false,
      results: [
        {
          step: 'dms-smart-search-santander-bbva',
          ok: false,
          details: { acceptableRankingMode: false, modelRerankUsed: false },
        },
      ],
      failedRequests: [],
      consoleMessages: [],
    })

    const summary = buildLiveArtifactSummary({ resultsDirs: [resultsDir], e2eDirs: [e2eDir], label, outPath: null })

    expect(summary.ok).toBe(false)
    expect(summary.productOk).toBe(true)
    expect(summary.classification.productFailures).toHaveLength(0)
    expect(summary.classification.providerBlockers.map((item) => item.gate)).toEqual(expect.arrayContaining(['openai-health', 'document-chat']))
  })

  it('classifies prompt-behavior 503/timeouts as transient provider failures', () => {
    const { resultsDir, e2eDir } = makeRoot()
    const label = 'live-2-1'
    writePassingArtifacts(resultsDir, e2eDir, label)
    writeJson(join(resultsDir, `prompt-behavior-${label}.json`), {
      label,
      rows: [{ id: 'ambiguous-clarify', pass: false, error: '503 UNAVAILABLE: request timed out' }],
    })

    const summary = buildLiveArtifactSummary({ resultsDirs: [resultsDir], e2eDirs: [e2eDir], label, outPath: null })

    expect(summary.ok).toBe(false)
    expect(summary.productOk).toBe(true)
    expect(summary.classification.transientProviderFailures.map((item) => item.gate)).toContain('prompt-behavior')
    expect(summary.classification.productFailures).toHaveLength(0)
  })

  it('classifies newly ingested document chat recovery failures as product failures', () => {
    const { resultsDir, e2eDir } = makeRoot()
    const label = 'live-3-1'
    writePassingArtifacts(resultsDir, e2eDir, label)
    writeJson(join(e2eDir, 'document-ingest-summary.json'), {
      ok: false,
      results: [
        { step: 'rag-search-recovers-newly-ingested-document', ok: true },
        { step: 'chat-answer-newly-ingested-document', ok: false, details: { answerTail: 'No se ha podido recuperar' } },
      ],
      failedRequests: [],
      consoleMessages: [],
    })

    const summary = buildLiveArtifactSummary({ resultsDirs: [resultsDir], e2eDirs: [e2eDir], label, outPath: null })

    expect(summary.ok).toBe(false)
    expect(summary.productOk).toBe(false)
    expect(summary.classification.productFailures.map((item) => item.gate)).toContain('document-ingest')
  })

  it('treats smart-search critical rank #1 misses as product failures even when row pass is true', () => {
    const { resultsDir, e2eDir } = makeRoot()
    const label = 'live-4-1'
    writePassingArtifacts(resultsDir, e2eDir, label)
    writeJson(join(resultsDir, `smart-search-${label}.json`), {
      label,
      summary: {
        ok: false,
        failures: ['smart-mad-santander-bbva-cost was not retrieved at rank #1.'],
      },
      rows: [{ id: 'smart-mad-santander-bbva-cost', rank: 2, pass: true }],
    })

    const summary = buildLiveArtifactSummary({ resultsDirs: [resultsDir], e2eDirs: [e2eDir], label, outPath: null })

    expect(summary.ok).toBe(false)
    expect(summary.productOk).toBe(false)
    expect(summary.classification.productFailures.map((item) => item.gate)).toContain('smart-search')
  })
})
