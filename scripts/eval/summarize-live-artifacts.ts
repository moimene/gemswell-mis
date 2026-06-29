import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

type JsonRecord = Record<string, unknown>

type Artifact = {
  path: string
  name: string
  data: JsonRecord
  mtimeMs: number
}

type Finding = {
  gate: string
  artifact?: string
  message: string
  details?: Record<string, unknown>
}

type Summary = {
  generatedAt: string
  label: string | null
  ok: boolean
  productOk: boolean
  requiredGates: string[]
  artifacts: Record<string, string | null>
  classification: {
    providerBlockers: Finding[]
    transientProviderFailures: Finding[]
    productFailures: Finding[]
    missing: Finding[]
    passed: Finding[]
  }
}

type Options = {
  resultsDirs: string[]
  e2eDirs: string[]
  label: string | null
  outPath: string | null
}

const REQUIRED_GATES = [
  'openai-health',
  'smart-search',
  'retrieval',
  'prompt-behavior',
  'answers',
  'governance',
  'document-chat',
  'document-ingest',
] as const

const GATE_PATTERNS: Record<typeof REQUIRED_GATES[number], RegExp> = {
  'openai-health': /^openai-health-(.+)\.json$/,
  'smart-search': /^smart-search-(.+)\.json$/,
  retrieval: /^retrieval-(.+)\.json$/,
  'prompt-behavior': /^prompt-behavior-(.+)\.json$/,
  answers: /^answers-(.+)\.json$/,
  governance: /^governance-(.+)\.json$/,
  'document-chat': /^document-chat-summary\.json$|^summary\.json$/,
  'document-ingest': /^document-ingest-summary\.json$|^summary\.json$/,
}

function argValue(argv: string[], flag: string): string | null {
  const index = argv.indexOf(flag)
  if (index < 0) return null
  return argv[index + 1] ?? null
}

function splitPaths(value: string | null): string[] {
  if (!value) return []
  return value.split(',').map((part) => part.trim()).filter(Boolean)
}

function parseArgs(argv = process.argv.slice(2)): Options {
  const root = argValue(argv, '--root')
  const resultsDirs = splitPaths(argValue(argv, '--results-dir'))
  const e2eDirs = splitPaths(argValue(argv, '--e2e-dir'))
  if (root) {
    resultsDirs.push(join(root, 'scripts/eval/results'))
    e2eDirs.push(root)
  }
  if (resultsDirs.length === 0) resultsDirs.push(resolve(process.cwd(), 'scripts/eval/results'))
  if (e2eDirs.length === 0) {
    e2eDirs.push(process.env.E2E_SUMMARY_DIR || process.env.E2E_ARTIFACT_DIR || '/tmp/gemswell-e2e-artifacts')
  }
  return {
    resultsDirs: unique(resultsDirs.map((dir) => resolve(dir))),
    e2eDirs: unique(e2eDirs.map((dir) => resolve(dir))),
    label: argValue(argv, '--label'),
    outPath: argValue(argv, '--out'),
  }
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)]
}

function walkJson(dir: string, maxDepth = 5): string[] {
  if (!existsSync(dir) || maxDepth < 0) return []
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === '.git') continue
      out.push(...walkJson(path, maxDepth - 1))
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      out.push(path)
    }
  }
  return out
}

function readJson(path: string): Artifact | null {
  try {
    const data = JSON.parse(readFileSync(path, 'utf8')) as JsonRecord
    return { path, name: path.split('/').pop() || path, data, mtimeMs: statSync(path).mtimeMs }
  } catch {
    return null
  }
}

function labelFromName(gate: typeof REQUIRED_GATES[number], name: string): string | null {
  const match = name.match(GATE_PATTERNS[gate])
  if (!match) return null
  return match[1] ?? null
}

function matchesLabel(gate: typeof REQUIRED_GATES[number], artifact: Artifact, label: string | null): boolean {
  if (!label) return true
  if (gate === 'document-chat' || gate === 'document-ingest') return true
  const extracted = labelFromName(gate, artifact.name)
  return Boolean(extracted && (extracted === label || extracted.startsWith(`${label}-`)))
}

function isLikelyChatSummary(path: string, data: JsonRecord): boolean {
  if (path.includes('doc-chat') || path.includes('document-chat')) return true
  const results = Array.isArray(data.results) ? data.results : []
  return results.some((row) => isRecord(row) && typeof row.step === 'string' && row.step.startsWith('chat-answer-'))
}

function isLikelyIngestSummary(path: string, data: JsonRecord): boolean {
  if (path.includes('doc-ingest') || path.includes('document-ingest')) return true
  const results = Array.isArray(data.results) ? data.results : []
  return results.some((row) => isRecord(row) && row.step === 'rag-search-recovers-newly-ingested-document')
}

function selectArtifact(gate: typeof REQUIRED_GATES[number], artifacts: Artifact[], label: string | null): Artifact | null {
  const matches = artifacts
    .filter((artifact) => GATE_PATTERNS[gate].test(artifact.name))
    .filter((artifact) => matchesLabel(gate, artifact, label))
    .filter((artifact) => {
      if (gate === 'document-chat' && artifact.name === 'summary.json') return isLikelyChatSummary(artifact.path, artifact.data)
      if (gate === 'document-ingest' && artifact.name === 'summary.json') return isLikelyIngestSummary(artifact.path, artifact.data)
      return true
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs || b.path.localeCompare(a.path))
  return matches[0] ?? null
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function textOf(value: unknown): string {
  if (typeof value === 'string') return value
  if (value == null) return ''
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function isQuotaOrBilling(value: unknown): boolean {
  return /insufficient_quota|quota_or_billing|billing|exceeded your current quota/i.test(textOf(value))
}

function isTransientProvider(value: unknown): boolean {
  if (isQuotaOrBilling(value)) return false
  return /\b(?:502|503|504)\b|UNAVAILABLE|temporar(?:y|ily)|timed out|timeout|ETIMEDOUT|ECONNRESET|socket hang up/i.test(textOf(value))
}

function pushPassed(summary: Summary, gate: string, artifact: Artifact, message = 'gate passed'): void {
  summary.classification.passed.push({ gate, artifact: artifact.path, message })
}

function pushProduct(summary: Summary, gate: string, artifact: Artifact | null, message: string, details?: Record<string, unknown>): void {
  summary.classification.productFailures.push({ gate, artifact: artifact?.path, message, details })
}

function pushProvider(summary: Summary, gate: string, artifact: Artifact | null, message: string, details?: Record<string, unknown>): void {
  summary.classification.providerBlockers.push({ gate, artifact: artifact?.path, message, details })
}

function pushTransient(summary: Summary, gate: string, artifact: Artifact | null, message: string, details?: Record<string, unknown>): void {
  summary.classification.transientProviderFailures.push({ gate, artifact: artifact?.path, message, details })
}

function classifyOpenAi(summary: Summary, artifact: Artifact): void {
  if (artifact.data.ok === true) {
    pushPassed(summary, 'openai-health', artifact, 'OpenAI primary model health passed')
    return
  }
  const failure = artifact.data.failure
  if (isQuotaOrBilling(failure)) {
    pushProvider(summary, 'openai-health', artifact, 'OpenAI primary model quota or billing is blocking live gates', { failure })
    return
  }
  if (isTransientProvider(failure)) {
    pushTransient(summary, 'openai-health', artifact, 'OpenAI primary model health failed transiently', { failure })
    return
  }
  pushProvider(summary, 'openai-health', artifact, 'OpenAI primary model health failed', { failure })
}

function classifyRowsPassGate(summary: Summary, artifact: Artifact, gate: 'smart-search' | 'prompt-behavior'): void {
  const summaryBlock = isRecord(artifact.data.summary) ? artifact.data.summary : null
  if (gate === 'smart-search' && summaryBlock?.ok === false) {
    pushProduct(summary, gate, artifact, 'smart-search summary contract failed', {
      failures: Array.isArray(summaryBlock.failures) ? summaryBlock.failures : [],
    })
    return
  }
  const rows = Array.isArray(artifact.data.rows) ? artifact.data.rows : []
  if (rows.length === 0) {
    pushProduct(summary, gate, artifact, 'no rows were evaluated')
    return
  }
  const failures = rows.filter((row) => isRecord(row) && row.pass !== true)
  if (failures.length === 0) {
    pushPassed(summary, gate, artifact, `${rows.length} rows passed`)
    return
  }
  for (const row of failures) {
    const id = isRecord(row) ? textOf(row.id) : 'unknown'
    if (isRecord(row) && isQuotaOrBilling(row.error)) {
      pushProvider(summary, gate, artifact, `${id} blocked by quota or billing`, { row })
    } else if (isRecord(row) && isTransientProvider(row.error)) {
      pushTransient(summary, gate, artifact, `${id} failed with a transient provider error`, { row })
    } else {
      pushProduct(summary, gate, artifact, `${id} failed behavioral checks`, { row })
    }
  }
}

function classifyRetrieval(summary: Summary, artifact: Artifact): void {
  const summaryBlock = isRecord(artifact.data.summary) ? artifact.data.summary : null
  if (summaryBlock?.ok === true) {
    pushPassed(summary, 'retrieval', artifact, 'retrieval summary passed')
    return
  }
  const failures = Array.isArray(summaryBlock?.failures) ? summaryBlock.failures : []
  if (summaryBlock) {
    pushProduct(summary, 'retrieval', artifact, 'retrieval summary failed', { failures })
    return
  }
  pushProduct(summary, 'retrieval', artifact, 'retrieval summary is missing')
}

function verdictAccepted(row: JsonRecord): boolean {
  const verdict = isRecord(row.verdict) ? row.verdict : null
  if (!verdict) return false
  if (verdict.verdict === 'pass') return true
  if (verdict.verdict !== 'weak') return false
  const faithfulness = Number(verdict.faithfulness)
  const citationPrecision = Number(verdict.citation_precision)
  const completeness = Number(verdict.completeness)
  return (
    faithfulness >= 4 &&
    citationPrecision >= 4 &&
    completeness >= 4 &&
    verdict.found_ground_truth === true &&
    verdict.behavior_correct === true
  )
}

function classifyAnswers(summary: Summary, artifact: Artifact): void {
  const rows = Array.isArray(artifact.data.rows) ? artifact.data.rows : []
  if (rows.length === 0) {
    pushProduct(summary, 'answers', artifact, 'no answer rows were scored')
    return
  }
  const failures = rows.filter((row) => !isRecord(row) || !verdictAccepted(row))
  if (failures.length === 0) {
    pushPassed(summary, 'answers', artifact, `${rows.length} answer rows passed`)
    return
  }
  for (const row of failures) {
    const id = isRecord(row) && isRecord(row.g) ? textOf(row.g.id) : 'unknown'
    if (isRecord(row) && isQuotaOrBilling(row.error)) {
      pushProvider(summary, 'answers', artifact, `${id} answer eval blocked by quota or billing`, { row })
    } else if (isRecord(row) && isTransientProvider(row.error)) {
      pushTransient(summary, 'answers', artifact, `${id} answer eval failed with a transient provider error`, { row })
    } else {
      pushProduct(summary, 'answers', artifact, `${id} answer gate failed`, { row })
    }
  }
}

function classifyGovernance(summary: Summary, artifact: Artifact): void {
  const failures = Array.isArray(artifact.data.failures) ? artifact.data.failures : []
  if (failures.length === 0) {
    pushPassed(summary, 'governance', artifact, 'governance checks passed')
    return
  }
  pushProduct(summary, 'governance', artifact, `${failures.length} governance failures`, { failures })
}

function failedE2eResults(artifact: Artifact): JsonRecord[] {
  const results = Array.isArray(artifact.data.results) ? artifact.data.results : []
  return results.filter((row): row is JsonRecord => isRecord(row) && row.ok !== true)
}

function hasFailedRequestOrConsoleNoise(artifact: Artifact): boolean {
  const failedRequests = Array.isArray(artifact.data.failedRequests) ? artifact.data.failedRequests : []
  const consoleMessages = Array.isArray(artifact.data.consoleMessages) ? artifact.data.consoleMessages : []
  return failedRequests.length > 0 || consoleMessages.length > 0
}

function classifyDocumentChat(summary: Summary, artifact: Artifact): void {
  if (artifact.data.ok === true) {
    pushPassed(summary, 'document-chat', artifact, 'document chat browser E2E passed')
    return
  }
  const failures = failedE2eResults(artifact)
  const failure = artifact.data.failure
  if (isTransientProvider(failure) || failures.some((row) => isTransientProvider(row))) {
    pushTransient(summary, 'document-chat', artifact, 'document chat E2E hit a transient provider failure', { failure, failures })
    return
  }
  const openAiBlocked = summary.classification.providerBlockers.some((item) => item.gate === 'openai-health')
  const onlyStrictSmartModelFallback =
    failures.length > 0 &&
    failures.every((row) => typeof row.step === 'string' && row.step.startsWith('dms-smart-search-') && isRecord(row.details) && row.details.acceptableRankingMode === false)
  if (openAiBlocked && onlyStrictSmartModelFallback && !hasFailedRequestOrConsoleNoise(artifact)) {
    pushProvider(summary, 'document-chat', artifact, 'chat/search E2E only failed strict model-rerank evidence while OpenAI was unavailable', { failures })
    return
  }
  pushProduct(summary, 'document-chat', artifact, 'document chat browser E2E failed', { failure, failures })
}

function classifyDocumentIngest(summary: Summary, artifact: Artifact): void {
  if (artifact.data.ok === true) {
    pushPassed(summary, 'document-ingest', artifact, 'document ingest browser E2E passed')
    return
  }
  const failures = failedE2eResults(artifact)
  const failure = artifact.data.failure
  if (isTransientProvider(failure) || failures.some((row) => isTransientProvider(row))) {
    pushTransient(summary, 'document-ingest', artifact, 'document ingest E2E hit a transient provider failure', { failure, failures })
    return
  }
  pushProduct(summary, 'document-ingest', artifact, 'document ingest browser E2E failed', { failure, failures })
}

function classifyArtifact(summary: Summary, gate: typeof REQUIRED_GATES[number], artifact: Artifact): void {
  if (gate === 'openai-health') classifyOpenAi(summary, artifact)
  else if (gate === 'smart-search' || gate === 'prompt-behavior') classifyRowsPassGate(summary, artifact, gate)
  else if (gate === 'retrieval') classifyRetrieval(summary, artifact)
  else if (gate === 'answers') classifyAnswers(summary, artifact)
  else if (gate === 'governance') classifyGovernance(summary, artifact)
  else if (gate === 'document-chat') classifyDocumentChat(summary, artifact)
  else if (gate === 'document-ingest') classifyDocumentIngest(summary, artifact)
}

export function buildLiveArtifactSummary(options: Options): Summary {
  const evalArtifacts = options.resultsDirs.flatMap((dir) => walkJson(dir).map(readJson).filter((item): item is Artifact => Boolean(item)))
  const e2eArtifacts = options.e2eDirs.flatMap((dir) => walkJson(dir).map(readJson).filter((item): item is Artifact => Boolean(item)))
  const artifacts = [...evalArtifacts, ...e2eArtifacts]
  const selected = Object.fromEntries(REQUIRED_GATES.map((gate) => [gate, selectArtifact(gate, artifacts, options.label)])) as Record<typeof REQUIRED_GATES[number], Artifact | null>
  const summary: Summary = {
    generatedAt: new Date().toISOString(),
    label: options.label,
    ok: false,
    productOk: false,
    requiredGates: [...REQUIRED_GATES],
    artifacts: Object.fromEntries(REQUIRED_GATES.map((gate) => [gate, selected[gate]?.path ?? null])),
    classification: {
      providerBlockers: [],
      transientProviderFailures: [],
      productFailures: [],
      missing: [],
      passed: [],
    },
  }

  for (const gate of REQUIRED_GATES) {
    const artifact = selected[gate]
    if (!artifact) {
      summary.classification.missing.push({ gate, message: `missing required ${gate} artifact` })
      continue
    }
    classifyArtifact(summary, gate, artifact)
  }

  summary.productOk = summary.classification.productFailures.length === 0 && summary.classification.missing.length === 0
  summary.ok =
    summary.productOk &&
    summary.classification.providerBlockers.length === 0 &&
    summary.classification.transientProviderFailures.length === 0
  return summary
}

function main(): void {
  const options = parseArgs()
  const summary = buildLiveArtifactSummary(options)
  const body = JSON.stringify(summary, null, 2)
  if (options.outPath) {
    const outPath = resolve(options.outPath)
    mkdirSync(dirname(outPath), { recursive: true })
    writeFileSync(outPath, `${body}\n`)
  }
  console.log(body)
  if (!summary.ok) process.exitCode = 1
}

if (process.env.VITEST !== 'true') main()
