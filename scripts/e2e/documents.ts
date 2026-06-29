import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'

type SuiteName = 'document-chat' | 'document-ingest'

type SuiteRun = {
  suite: SuiteName
  script: string
  exitCode: number | null
  summaryPath: string | null
  ok: boolean
  steps: number | null
  failedSteps: string[]
}

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'

function summaryRoot(): string | null {
  if (process.env.E2E_SUMMARY_DIR) return resolve(process.env.E2E_SUMMARY_DIR)
  if (process.env.E2E_SUMMARY_PATH) return dirname(resolve(process.env.E2E_SUMMARY_PATH))
  return null
}

function combinedSummaryPath(root: string | null): string | null {
  if (process.env.E2E_SUMMARY_PATH) return resolve(process.env.E2E_SUMMARY_PATH)
  if (root) return join(root, 'documents-summary.json')
  return null
}

function readSummary(path: string | null): { ok?: unknown; results?: unknown[] } | null {
  if (!path) return null
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as { ok?: unknown; results?: unknown[] }
  } catch {
    return null
  }
}

function failedSteps(summary: { results?: unknown[] } | null): string[] {
  const rows = Array.isArray(summary?.results) ? summary.results : []
  return rows
    .filter((row): row is { ok?: unknown; step?: unknown } => Boolean(row && typeof row === 'object'))
    .filter((row) => row.ok !== true)
    .map((row) => typeof row.step === 'string' ? row.step : 'unknown')
}

function runNpmScript(script: string, summaryPath: string | null): Promise<number | null> {
  const env = { ...process.env }
  if (summaryPath) env.E2E_SUMMARY_PATH = summaryPath

  return new Promise((resolveRun) => {
    const child = spawn(npmCommand, ['run', script], {
      cwd: process.cwd(),
      env,
      stdio: 'inherit',
    })
    child.once('exit', (code) => resolveRun(code))
    child.once('error', () => resolveRun(1))
  })
}

async function runSuite(suite: SuiteName, script: string, summaryPath: string | null): Promise<SuiteRun> {
  if (summaryPath) mkdirSync(dirname(summaryPath), { recursive: true })
  const exitCode = await runNpmScript(script, summaryPath)
  const summary = readSummary(summaryPath)
  const steps = Array.isArray(summary?.results) ? summary.results.length : null
  return {
    suite,
    script,
    exitCode,
    summaryPath,
    ok: exitCode === 0 && summary?.ok === true,
    steps,
    failedSteps: failedSteps(summary),
  }
}

async function main() {
  const root = summaryRoot()
  const chatSummaryPath = root ? join(root, 'document-chat-summary.json') : null
  const ingestSummaryPath = root ? join(root, 'document-ingest-summary.json') : null
  const outPath = combinedSummaryPath(root)

  const suites = [
    await runSuite('document-chat', 'e2e:doc-chat', chatSummaryPath),
    await runSuite('document-ingest', 'e2e:doc-ingest', ingestSummaryPath),
  ]
  const summary = {
    ok: suites.every((suite) => suite.ok),
    generatedAt: new Date().toISOString(),
    baseUrl: process.env.E2E_BASE_URL || null,
    artifactDir: process.env.E2E_ARTIFACT_DIR || null,
    summaryDir: root,
    suites,
  }

  if (outPath) {
    mkdirSync(dirname(outPath), { recursive: true })
    writeFileSync(outPath, JSON.stringify(summary, null, 2))
  }

  console.log(JSON.stringify(summary, null, 2))
  if (!summary.ok) process.exit(1)
}

main().catch((err) => {
  console.error('[e2e/documents] failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
