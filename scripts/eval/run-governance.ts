// Deterministic governance gate over answer-eval artifacts.
//
// Usage: npx tsx scripts/eval/run-governance.ts [label|answers-json-path]
// Reads scripts/eval/results/answers-<label>.json, resolves cited document ids in Supabase,
// and fails if the chat cites excluded documents or hides unreviewed evidence.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, extname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { getSupabase } from './_harness'

export type GovernanceAnswerSource = {
  document_id?: string | null
  documentId?: string | null
  label?: string | null
  title?: string | null
  review_status?: string | null
}

export type GovernanceAnswerRow = {
  g?: { id?: string | null }
  r?: {
    answer?: string | null
    sources?: GovernanceAnswerSource[] | null
  } | null
}

export type GovernanceAnswersArtifact = {
  label?: string | null
  rows?: GovernanceAnswerRow[] | null
}

export type GovernanceDocMeta = {
  id: string
  title: string | null
  review_status: string | null
  classification_source: string | null
  lifecycle: string | null
  status: string | null
}

export type GovernanceFailure = {
  metric: 'governance.superseded_never_cited' | 'governance.unreviewed_disclosed'
  row_id: string
  document_id: string | null
  title: string | null
  reason: string
  answer_excerpt?: string
}

export type GovernanceCheck = {
  metric: GovernanceFailure['metric']
  ok: boolean
  checked: number
  failures: GovernanceFailure[]
}

export type GovernanceEvaluation = {
  checkedRows: number
  citedDocCount: number
  checks: GovernanceCheck[]
  failures: GovernanceFailure[]
}

const EXCLUDED_RULES: Array<[keyof GovernanceDocMeta, string, string]> = [
  ['lifecycle', 'superseded', 'lifecycle=superseded'],
  ['status', 'retired', 'status=retired'],
  ['review_status', 'rejected', 'review_status=rejected'],
  ['classification_source', 'agent_rejected', 'classification_source=agent_rejected'],
]

const UNREVIEWED_STATUSES = new Set(['needs_review', 'pending', 'unreviewed'])
const UNREVIEWED_DISCLOSURE_RE = /\b(sin\s+revisar|pendiente\s+de\s+revision|needs[_ -]?review|pending|unreviewed|no\s+revisad[oa]|no\s+auditad[oa]|no\s+validad[oa])\b/i

function normalize(value: unknown): string {
  return String(value ?? '').trim().toLowerCase()
}

function foldText(value: unknown): string {
  return normalize(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function sourceDocumentId(source: GovernanceAnswerSource): string | null {
  return source.document_id ?? source.documentId ?? null
}

function sourceTitle(source: GovernanceAnswerSource, meta: GovernanceDocMeta | undefined): string | null {
  return meta?.title ?? source.title ?? source.label ?? null
}

function excludedReasons(meta: GovernanceDocMeta): string[] {
  return EXCLUDED_RULES
    .filter(([field, value]) => normalize(meta[field]) === value)
    .map(([, , reason]) => reason)
}

function hasUnreviewedDisclosure(answer: string | null | undefined): boolean {
  return UNREVIEWED_DISCLOSURE_RE.test(foldText(answer))
}

function answerExcerpt(answer: string | null | undefined): string {
  return String(answer ?? '').replace(/\s+/g, ' ').trim().slice(0, 240)
}

export function collectCitedDocumentIds(rows: GovernanceAnswerRow[]): string[] {
  return [...new Set(rows.flatMap((row) => row.r?.sources ?? [])
    .map(sourceDocumentId)
    .filter((id): id is string => Boolean(id)))]
}

export function evaluateGovernanceRows(
  rows: GovernanceAnswerRow[],
  metaById: ReadonlyMap<string, GovernanceDocMeta>,
): GovernanceEvaluation {
  const invalidCitationFailures: GovernanceFailure[] = []
  const unreviewedDisclosureFailures: GovernanceFailure[] = []
  let citedDocCount = 0
  let unreviewedSourceCount = 0

  rows.forEach((row, index) => {
    const rowId = row.g?.id || `row-${index + 1}`
    const sources = row.r?.sources ?? []
    const answer = row.r?.answer ?? ''
    const disclosed = hasUnreviewedDisclosure(answer)

    for (const source of sources) {
      const documentId = sourceDocumentId(source)
      if (!documentId) continue
      citedDocCount += 1

      const meta = metaById.get(documentId)
      if (!meta) {
        invalidCitationFailures.push({
          metric: 'governance.superseded_never_cited',
          row_id: rowId,
          document_id: documentId,
          title: sourceTitle(source, undefined),
          reason: 'missing_document_metadata',
        })
        continue
      }

      const reasons = excludedReasons(meta)
      if (reasons.length) {
        invalidCitationFailures.push({
          metric: 'governance.superseded_never_cited',
          row_id: rowId,
          document_id: documentId,
          title: sourceTitle(source, meta),
          reason: reasons.join(','),
        })
      }

      const reviewStatus = normalize(meta.review_status || source.review_status)
      if (UNREVIEWED_STATUSES.has(reviewStatus)) {
        unreviewedSourceCount += 1
        if (!disclosed) {
          unreviewedDisclosureFailures.push({
            metric: 'governance.unreviewed_disclosed',
            row_id: rowId,
            document_id: documentId,
            title: sourceTitle(source, meta),
            reason: `unreviewed_source_not_disclosed:${reviewStatus}`,
            answer_excerpt: answerExcerpt(answer),
          })
        }
      }
    }
  })

  const checks: GovernanceCheck[] = [
    {
      metric: 'governance.superseded_never_cited',
      ok: invalidCitationFailures.length === 0,
      checked: citedDocCount,
      failures: invalidCitationFailures,
    },
    {
      metric: 'governance.unreviewed_disclosed',
      ok: unreviewedDisclosureFailures.length === 0,
      checked: unreviewedSourceCount,
      failures: unreviewedDisclosureFailures,
    },
  ]

  return {
    checkedRows: rows.length,
    citedDocCount,
    checks,
    failures: [...invalidCitationFailures, ...unreviewedDisclosureFailures],
  }
}

function resolveAnswersPath(input = 'baseline'): string {
  if (input.endsWith('.json') || input.includes('/') || input.includes('\\')) return resolve(process.cwd(), input)
  const file = input.startsWith('answers-') ? `${input}.json` : `answers-${input}.json`
  return resolve(process.cwd(), 'scripts/eval/results', file)
}

function labelFromInput(input: string | undefined, answersPath: string, artifactLabel: string | null | undefined): string {
  if (artifactLabel) return artifactLabel
  const raw = input && !input.endsWith('.json') && !input.includes('/') && !input.includes('\\')
    ? input
    : basename(answersPath, extname(answersPath)).replace(/^answers-/, '')
  return raw || 'baseline'
}

function fileSafeLabel(label: string): string {
  return label.replace(/[^A-Za-z0-9_.-]+/g, '-')
}

async function loadDocMetaById(ids: string[]): Promise<Map<string, GovernanceDocMeta>> {
  const sb = getSupabase()
  const out = new Map<string, GovernanceDocMeta>()
  for (let i = 0; i < ids.length; i += 200) {
    const slice = ids.slice(i, i + 200)
    const { data, error } = await sb
      .from('rag_documents')
      .select('id,title,review_status,classification_source,lifecycle,status')
      .in('id', slice)
    if (error) throw new Error('loadDocMetaById: ' + error.message)
    for (const row of (data ?? []) as GovernanceDocMeta[]) out.set(row.id, row)
  }
  return out
}

async function main() {
  const input = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'baseline'
  const answersPath = resolveAnswersPath(input)
  if (!existsSync(answersPath)) throw new Error(`Missing answers artifact: ${answersPath}`)

  const artifact = JSON.parse(readFileSync(answersPath, 'utf8')) as GovernanceAnswersArtifact
  const rows = artifact.rows ?? []
  const label = labelFromInput(input, answersPath, artifact.label)
  const ids = collectCitedDocumentIds(rows)
  const metaById = await loadDocMetaById(ids)
  const evaluation = evaluateGovernanceRows(rows, metaById)

  console.log(`\n=== GOVERNANCE EVAL (label=${label}) - ${rows.length} rows, ${ids.length} cited docs ===\n`)
  for (const check of evaluation.checks) {
    console.log(`${check.ok ? 'PASS' : 'FAIL'} ${check.metric} checked=${check.checked} failures=${check.failures.length}`)
    for (const failure of check.failures) {
      console.log(`  - ${failure.row_id} ${failure.document_id ?? '-'} ${failure.reason} ${failure.title ?? ''}`.trimEnd())
      if (failure.answer_excerpt) console.log(`    answer: ${failure.answer_excerpt}`)
    }
  }

  const outDir = resolve(process.cwd(), 'scripts/eval/results')
  mkdirSync(outDir, { recursive: true })
  const outPath = resolve(outDir, `governance-${fileSafeLabel(label)}.json`)
  writeFileSync(outPath, JSON.stringify({
    label,
    answersPath,
    at: new Date().toISOString(),
    ...evaluation,
  }, null, 2))
  console.log(`\nWrote ${outPath}\n`)

  if (evaluation.failures.length && process.env.EVAL_GOVERNANCE_STRICT !== 'false') process.exitCode = 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => { console.error(err); process.exit(1) })
}
