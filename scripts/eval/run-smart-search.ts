import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { getSupabase, hitAtK, mean, pad, padL, pct } from './_harness'
import { searchDocumentsIntelligently, type SmartDocumentSearchFilters } from '../../src/lib/knowledge/intelligent-search'

type SmartGolden = {
  id: string
  query: string
  filters?: SmartDocumentSearchFilters
  expected_doc_ids: string[]
  must_snippet?: string[]
  must_entities?: string[]
}

function loadSmartGolden(path = resolve(process.cwd(), 'scripts/eval/smart-search-golden.json')): SmartGolden[] {
  return JSON.parse(readFileSync(path, 'utf8')) as SmartGolden[]
}

function includesAll(haystack: string, needles: string[] | undefined): boolean {
  if (!needles?.length) return true
  const text = haystack.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  return needles.every((needle) => text.includes(needle.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()))
}

async function main() {
  const label = process.argv[2] || 'baseline'
  const modelEnabled = process.env.SMART_SEARCH_EVAL_MODEL === 'true'
  const sb = getSupabase()
  const golden = loadSmartGolden()
  const rows = []

  console.log(`\n=== SMART DOCUMENT SEARCH EVAL (label=${label}) — ${golden.length} queries, model=${modelEnabled ? 'on' : 'off'} ===\n`)
  for (const g of golden) {
    const t0 = Date.now()
    const result = await searchDocumentsIntelligently(sb, {
      query: g.query,
      filters: g.filters,
      limit: 10,
      modelEnabled,
      cacheEnabled: false,
    })
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
    rows.push({ id: g.id, ms, rank, snippetOk, entityOk, pass, top: result.items.slice(0, 3).map((item) => ({ id: item.id, title: item.title, score: item.smart_score, role: item.smart_role })) })
    console.log(`${pad(g.id, 34)} ${padL(ms, 5)}ms rank=${rank || '—'} snippet=${snippetOk ? 'Y' : 'N'} entities=${entityOk ? 'Y' : 'N'} ${pass ? 'PASS' : 'FAIL'}`)
    for (const [i, item] of result.items.slice(0, 3).entries()) {
      console.log(`      ${i + 1}. ${Math.round(item.smart_score * 100)}% [${item.project_id}/${item.doc_type}/${item.review_status}] ${String(item.title).slice(0, 80)}`)
    }
  }

  const hits1 = rows.filter((row) => hitAtK(row.rank, 1)).length
  const hits3 = rows.filter((row) => hitAtK(row.rank, 3)).length
  const pass = rows.filter((row) => row.pass).length
  console.log('\n── AGGREGATE ──')
  console.log(`  doc@1 ${pct(hits1, rows.length)}  doc@3 ${pct(hits3, rows.length)}  pass ${pct(pass, rows.length)}  avg latency ${mean(rows.map((row) => row.ms)).toFixed(0)}ms`)

  const outDir = resolve(process.cwd(), 'scripts/eval/results')
  mkdirSync(outDir, { recursive: true })
  const outPath = resolve(outDir, `smart-search-${label}.json`)
  writeFileSync(outPath, JSON.stringify({ label, at: new Date().toISOString(), modelEnabled, rows }, null, 2))
  console.log(`\nWrote ${outPath}\n`)
  if (pass !== rows.length) process.exitCode = 1
}

main().catch((err) => { console.error(err); process.exit(1) })
