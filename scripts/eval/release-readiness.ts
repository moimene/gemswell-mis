import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

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

export type ReleaseReadinessInput = {
  health: OpenAIHealthResult
  liveRun?: GithubRunResult | null
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

export function evaluateReleaseReadiness(input: ReleaseReadinessInput): ReleaseReadinessResult {
  const expectedModel = input.expectedModel ?? 'gpt-5.5'
  const liveRun = input.liveRun ?? null
  const checks = {
    openAIHealthOk: input.health.ok === true,
    openAIModelMatches: input.health.model === expectedModel,
    openAINotQuotaBlocked: input.health.failure?.class !== 'quota_or_billing',
    liveRunProvided: Boolean(liveRun),
    liveRunIsCorrectWorkflow: liveRun?.workflowName === 'live-rag-e2e',
    liveRunCompleted: liveRun?.status === 'completed',
    liveRunSucceeded: liveRun?.conclusion === 'success',
    liveRunShaMatches: input.expectedSha ? liveRun?.headSha === input.expectedSha : true,
  }

  const failures: string[] = []
  if (!checks.openAIHealthOk) failures.push('OpenAI health is not ok.')
  if (!checks.openAIModelMatches) failures.push(`OpenAI health model is not ${expectedModel}.`)
  if (!checks.openAINotQuotaBlocked) failures.push('OpenAI health is blocked by quota_or_billing.')
  if (!checks.liveRunProvided) failures.push('No live-rag-e2e run evidence was provided.')
  if (liveRun && !checks.liveRunIsCorrectWorkflow) failures.push('Provided run is not live-rag-e2e.')
  if (liveRun && !checks.liveRunCompleted) failures.push('live-rag-e2e has not completed.')
  if (liveRun && !checks.liveRunSucceeded) failures.push('live-rag-e2e did not conclude success.')
  if (input.expectedSha && !checks.liveRunShaMatches) failures.push('live-rag-e2e SHA does not match expected release SHA.')

  const nextActions = failures.length === 0
    ? ['Proceed to strict local production E2E without E2E_ALLOW_SMART_MODEL_FALLBACK, then release if it passes.']
    : [
        input.health.failure?.class === 'quota_or_billing'
          ? 'Resolve OpenAI billing/limits before investigating RAG.'
          : 'Regenerate OpenAI health evidence with npm run eval:openai-health -- release-openai-health.',
        'Run live-rag-e2e on main and provide its latest successful JSON evidence.',
        'Do not use E2E_ALLOW_SMART_MODEL_FALLBACK as release evidence.',
      ]

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
  const outPath = arg('out')
  const health = readJson<OpenAIHealthResult>(healthPath)
  const liveRun = liveRunPath ? firstRun(readJson<unknown>(liveRunPath)) : null
  const result = evaluateReleaseReadiness({
    health,
    liveRun,
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
