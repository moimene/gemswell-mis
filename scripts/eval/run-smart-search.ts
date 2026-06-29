import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { getSupabase, hitAtK, mean, pad, padL, pct } from './_harness'
import { buildSmartSearchSummary, type SmartSearchEvalRow } from './smart-search-summary'
import { searchDocumentsIntelligently, type SmartDocumentSearchFilters } from '../../src/lib/knowledge/intelligent-search'

const PHASE_TIMEOUT_MS = positiveIntEnv('EVAL_SMART_SEARCH_PHASE_TIMEOUT_MS', 240_000)

type SmartGolden = {
  id: string
  query: string
  filters?: SmartDocumentSearchFilters
  expected_doc_ids: string[]
  must_snippet?: string[]
  must_entities?: string[]
}

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag)
  return i >= 0 ? process.argv[i + 1] : undefined
}

function loadSmartGolden(path = resolve(process.cwd(), 'scripts/eval/smart-search-golden.json')): SmartGolden[] {
  return JSON.parse(readFileSync(path, 'utf8')) as SmartGolden[]
}

function positiveIntEnv(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw) return fallback
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

function logProgress(event: string, fields: Record<string, unknown>) {
  console.log(JSON.stringify({ eval: 'smart-search', event, at: new Date().toISOString(), ...fields }))
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeout: NodeJS.Timeout | null = null
  const timer = new Promise<T>((_, reject) => {
    timeout = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs)
    timeout.unref?.()
  })
  try {
    return await Promise.race([promise, timer])
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

function includesAll(haystack: string, needles: string[] | undefined): boolean {
  if (!needles?.length) return true
  const text = haystack.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  return needles.every((needle) => text.includes(needle.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()))
}

async function main() {
  const label = process.argv[2] || 'baseline'
  const only = arg('--only')?.split(',').map((s) => s.trim())
  const limit = arg('--limit') ? Number(arg('--limit')) : undefined
  const modelEnabled = process.env.SMART_SEARCH_EVAL_MODEL === 'true'
  const sb = getSupabase()
  let golden = loadSmartGolden()
  if (only) golden = golden.filter((g) => only.includes(g.id))
  if (limit) golden = golden.slice(0, limit)
  const rows: SmartSearchEvalRow[] = []

  console.log(`\n=== SMART DOCUMENT SEARCH EVAL (label=${label}) — ${golden.length} queries, model=${modelEnabled ? 'on' : 'off'}, phase_timeout=${PHASE_TIMEOUT_MS}ms ===\n`)
  for (const g of golden) {
    const caseStart = Date.now()
    const t0 = Date.now()
    logProgress('case_start', { id: g.id, query: g.query, filters: g.filters ?? null, expected_doc_ids: g.expected_doc_ids })
    try {
      const result = await withTimeout(searchDocumentsIntelligently(sb, {
        query: g.query,
        filters: g.filters,
        limit: 10,
        modelEnabled,
        cacheEnabled: false,
      }), PHASE_TIMEOUT_MS, `${g.id} smart document search`)
      const ms = Date.now() - t0
      const ids = result.items.map((item) => item.id)
      const want = new Set(g.expected_doc_ids)
      const rank = ids.findIndex((id) => want.has(id)) + 1
      const best = result.items.find((item) => want.has(item.id))
      const snippetText = [best?.title, ...(best?.smart_snippets.map((snippet) => snippet.text) ?? [])].filter(Boolean).join(' ')
      const entityText = best?.smart_entities.map((entity) => entity.value).join(' ') ?? ''
      const snippetOk = includesAll(snippetText, g.must_snippet)
      const entityOk = includesAll(entityText, g.must_entities)
      const pass = hitAtK(rank, 3) && snippetOk && entityOk
      const top = result.items.slice(0, 3).map((item) => ({ id: item.id, title: item.title, score: item.smart_score, role: item.smart_role }))
      rows.push({ id: g.id, ms, rank, snippetOk, entityOk, pass, top })
      console.log(`${pad(g.id, 34)} ${padL(ms, 5)}ms rank=${rank || '—'} snippet=${snippetOk ? 'Y' : 'N'} entities=${entityOk ? 'Y' : 'N'} ${pass ? 'PASS' : 'FAIL'}`)
      for (const [i, item] of result.items.slice(0, 3).entries()) {
        console.log(`      ${i + 1}. ${Math.round(item.smart_score * 100)}% [${item.project_id}/${item.doc_type}/${item.review_status}] ${String(item.title).slice(0, 80)}`)
      }
      logProgress('case_done', {
        id: g.id,
        ms: Date.now() - caseStart,
        rank,
        snippet_ok: snippetOk,
        entity_ok: entityOk,
        pass,
        top_ids: top.map((item) => item.id),
      })
    } catch (e) {
      logProgress('case_error', { id: g.id, ms: Date.now() - caseStart, error: errorMessage(e) })
      throw e
    }
  }

  const hits1 = rows.filter((row) => hitAtK(row.rank, 1)).length
  const hits3 = rows.filter((row) => hitAtK(row.rank, 3)).length
  const pass = rows.filter((row) => row.pass).length
  const summary = buildSmartSearchSummary(rows)
  if (!summary.ok) {
    console.log('\n── STRICT SUMMARY FAILURES ──')
    for (const failure of summary.failures) console.log(`  ✗ ${failure}`)
  }
  console.log('\n── AGGREGATE ──')
  console.log(`  doc@1 ${pct(hits1, rows.length)}  doc@3 ${pct(hits3, rows.length)}  pass ${pct(pass, rows.length)}  avg latency ${mean(rows.map((row) => row.ms)).toFixed(0)}ms`)

  const outDir = resolve(process.cwd(), 'scripts/eval/results')
  mkdirSync(outDir, { recursive: true })
  const outPath = resolve(outDir, `smart-search-${label}.json`)
  writeFileSync(outPath, JSON.stringify({ label, at: new Date().toISOString(), modelEnabled, summary, rows }, null, 2))
  console.log(`\nWrote ${outPath}\n`)
  if (!summary.ok) process.exitCode = 1
}

main().catch((err) => { console.error(err); process.exit(1) })
