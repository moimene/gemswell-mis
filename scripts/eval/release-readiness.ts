import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

type OpenAIHealthResult = {
  ok?: boolean
  model?: string
  failure?: {
    class?: string
    status?: number
    code?: string
    type?: string
    message?: string
  }
}

type GithubRunResult = {
  databaseId?: number
  workflowName?: string
  status?: string
  conclusion?: string
  headSha?: string
  displayTitle?: string
}

type E2EStepResult = {
  step?: string
  ok?: boolean
  details?: Record<string, unknown>
}

type E2ESummary = {
  ok?: boolean
  results?: E2EStepResult[]
  failedRequests?: unknown[]
  consoleMessages?: unknown[]
  cleanup?: {
    ok?: boolean
  }
}

export type ReleaseReadinessInput = {
  health: OpenAIHealthResult
  liveRun?: GithubRunResult | null
  docChatE2E?: E2ESummary | null
  docIngestE2E?: E2ESummary | null
  expectedModel?: string
  expectedSha?: string
}

export type ReleaseReadinessResult = {
  ok: boolean
  checks: Record<string, boolean>
  failures: string[]
  nextActions: string[]
  evidence: {
    openAIModel?: string
    openAIFailureClass?: string
    liveRunId?: number
    liveRunWorkflow?: string
    liveRunStatus?: string
    liveRunConclusion?: string
    liveRunSha?: string
    expectedSha?: string
    docChatArtifact?: boolean
    docIngestArtifact?: boolean
  }
}

function firstRun(value: unknown): GithubRunResult | null {
  if (Array.isArray(value)) return (value[0] ?? null) as GithubRunResult | null
  if (value && typeof value === 'object') return value as GithubRunResult
  return null
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(resolve(path), 'utf8')) as T
}

function step(summary: E2ESummary | null | undefined, name: string): E2EStepResult | undefined {
  return summary?.results?.find((result) => result.step === name)
}

function detail(summary: E2ESummary | null | undefined, stepName: string, detailName: string): unknown {
  return step(summary, stepName)?.details?.[detailName]
}

function noBrowserNoise(summary: E2ESummary | null | undefined): boolean {
  return Array.isArray(summary?.failedRequests) &&
    summary.failedRequests.length === 0 &&
    Array.isArray(summary.consoleMessages) &&
    summary.consoleMessages.length === 0
}

function strictSmartSearchUsedModel(summary: E2ESummary | null | undefined): boolean {
  const criticalSteps = ['dms-smart-search-santander-bbva', 'dms-smart-search-buenavista']
  return criticalSteps.every((name) =>
    detail(summary, name, 'topExpectedDoc') === true &&
    detail(summary, name, 'graphUsed') === true &&
    detail(summary, name, 'rerankOrModelUsed') === true &&
    detail(summary, name, 'localRankingFallbackVisible') !== true,
  )
}

export function evaluateReleaseReadiness(input: ReleaseReadinessInput): ReleaseReadinessResult {
  const expectedModel = input.expectedModel ?? 'gpt-5.5'
  const liveRun = input.liveRun ?? null
  const docChat = input.docChatE2E ?? null
  const docIngest = input.docIngestE2E ?? null
  const checks = {
    expectedShaProvided: Boolean(input.expectedSha),
    openAIHealthOk: input.health.ok === true,
    openAIModelMatches: input.health.model === expectedModel,
    openAINotQuotaBlocked: input.health.failure?.class !== 'quota_or_billing',
    liveRunProvided: Boolean(liveRun),
    liveRunIsCorrectWorkflow: liveRun?.workflowName === 'live-rag-e2e',
    liveRunCompleted: liveRun?.status === 'completed',
    liveRunSucceeded: liveRun?.conclusion === 'success',
    liveRunShaMatches: Boolean(input.expectedSha) && liveRun?.headSha === input.expectedSha,
    docChatE2EProvided: Boolean(docChat),
    docChatE2EOk: docChat?.ok === true,
    docChatE2ENoBrowserNoise: noBrowserNoise(docChat),
    docChatE2EStrictModelUsed: strictSmartSearchUsedModel(docChat),
    docIngestE2EProvided: Boolean(docIngest),
    docIngestE2EOk: docIngest?.ok === true,
    docIngestE2ENoBrowserNoise: noBrowserNoise(docIngest),
    docIngestE2ECleanupOk: docIngest?.cleanup?.ok === true,
  }

  const failures: string[] = []
  if (!checks.expectedShaProvided) failures.push('Expected release SHA was not provided.')
  if (!checks.openAIHealthOk) failures.push('OpenAI health is not ok.')
  if (!checks.openAIModelMatches) failures.push(`OpenAI health model is not ${expectedModel}.`)
  if (!checks.openAINotQuotaBlocked) failures.push('OpenAI health is blocked by quota_or_billing.')
  if (!checks.liveRunProvided) failures.push('No live-rag-e2e run evidence was provided.')
  if (liveRun && !checks.liveRunIsCorrectWorkflow) failures.push('Provided run is not live-rag-e2e.')
  if (liveRun && !checks.liveRunCompleted) failures.push('live-rag-e2e has not completed.')
  if (liveRun && !checks.liveRunSucceeded) failures.push('live-rag-e2e did not conclude success.')
  if (input.expectedSha && !checks.liveRunShaMatches) failures.push('live-rag-e2e SHA does not match expected release SHA.')
  if (!checks.docChatE2EProvided) failures.push('Strict document-chat E2E evidence was not provided.')
  if (docChat && !checks.docChatE2EOk) failures.push('Strict document-chat E2E did not pass.')
  if (docChat && !checks.docChatE2ENoBrowserNoise) failures.push('Strict document-chat E2E had failed requests or console messages.')
  if (docChat && !checks.docChatE2EStrictModelUsed) failures.push('Strict document-chat E2E did not prove model/rerank usage for critical smart searches.')
  if (!checks.docIngestE2EProvided) failures.push('Strict document-ingest E2E evidence was not provided.')
  if (docIngest && !checks.docIngestE2EOk) failures.push('Strict document-ingest E2E did not pass.')
  if (docIngest && !checks.docIngestE2ENoBrowserNoise) failures.push('Strict document-ingest E2E had failed requests or console messages.')
  if (docIngest && !checks.docIngestE2ECleanupOk) failures.push('Strict document-ingest E2E cleanup did not pass.')

  const nextActions = failures.length === 0
    ? ['Proceed to strict local production E2E without E2E_ALLOW_SMART_MODEL_FALLBACK, then release if it passes.']
    : [
        !checks.expectedShaProvided ? 'Pass --expected-sha with the exact release commit SHA.' : null,
        !checks.openAIHealthOk || !checks.openAIModelMatches
          ? input.health.failure?.class === 'quota_or_billing'
            ? 'Resolve OpenAI billing/limits before investigating RAG.'
            : 'Regenerate OpenAI health evidence with npm run eval:openai-health -- release-openai-health.'
          : null,
        !checks.liveRunProvided || !checks.liveRunIsCorrectWorkflow || !checks.liveRunCompleted || !checks.liveRunSucceeded || !checks.liveRunShaMatches
          ? 'Run live-rag-e2e on main and provide its latest successful JSON evidence for the release SHA.'
          : null,
        !checks.docChatE2EProvided || !checks.docChatE2EOk || !checks.docChatE2ENoBrowserNoise || !checks.docChatE2EStrictModelUsed ||
          !checks.docIngestE2EProvided || !checks.docIngestE2EOk || !checks.docIngestE2ENoBrowserNoise || !checks.docIngestE2ECleanupOk
          ? 'Run strict local production documentary E2E with E2E_SUMMARY_DIR and without E2E_ALLOW_SMART_MODEL_FALLBACK.'
          : null,
        'Do not use E2E_ALLOW_SMART_MODEL_FALLBACK as release evidence.',
      ].filter((action): action is string => Boolean(action))

  return {
    ok: failures.length === 0,
    checks,
    failures,
    nextActions,
    evidence: {
      openAIModel: input.health.model,
      openAIFailureClass: input.health.failure?.class,
      liveRunId: liveRun?.databaseId,
      liveRunWorkflow: liveRun?.workflowName,
      liveRunStatus: liveRun?.status,
      liveRunConclusion: liveRun?.conclusion,
      liveRunSha: liveRun?.headSha,
      expectedSha: input.expectedSha,
      docChatArtifact: Boolean(docChat),
      docIngestArtifact: Boolean(docIngest),
    },
  }
}

function arg(name: string): string | undefined {
  const flag = `--${name}`
  const idx = process.argv.indexOf(flag)
  return idx >= 0 ? process.argv[idx + 1] : undefined
}

async function main() {
  const healthPath = arg('health')
  if (!healthPath) {
    console.error('[release-readiness] missing --health <openai-health-json>')
    process.exit(1)
  }

  const liveRunPath = arg('live-run')
  const e2eDir = arg('e2e-dir')
  const docChatE2EPath = arg('doc-chat-e2e') ?? (e2eDir ? join(e2eDir, 'document-chat-summary.json') : undefined)
  const docIngestE2EPath = arg('doc-ingest-e2e') ?? (e2eDir ? join(e2eDir, 'document-ingest-summary.json') : undefined)
  const outPath = arg('out')
  const health = readJson<OpenAIHealthResult>(healthPath)
  const liveRun = liveRunPath ? firstRun(readJson<unknown>(liveRunPath)) : null
  const docChatE2E = docChatE2EPath ? readJson<E2ESummary>(docChatE2EPath) : null
  const docIngestE2E = docIngestE2EPath ? readJson<E2ESummary>(docIngestE2EPath) : null
  const result = evaluateReleaseReadiness({
    health,
    liveRun,
    docChatE2E,
    docIngestE2E,
    expectedModel: arg('expected-model') ?? process.env.OPENAI_CHAT_MODEL ?? 'gpt-5.5',
    expectedSha: arg('expected-sha'),
  })

  const output = JSON.stringify(result, null, 2)
  if (outPath) writeFileSync(resolve(outPath), output)
  console[result.ok ? 'log' : 'error'](output)
  process.exit(result.ok ? 0 : 1)
}

if (process.env.VITEST !== 'true') {
  main().catch((err) => {
    console.error('[release-readiness] unexpected failure:', err instanceof Error ? err.message : String(err))
    process.exit(1)
  })
}
