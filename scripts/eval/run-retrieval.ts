// Tier-A retrieval evaluation: runs every golden question through the REAL production retrieval core
// (retrieveDocuments → match_chunks + keyword_search_chunks via supabase-js/PostgREST → Cohere rerank
// → trust-tier sort) and measures recall@k against live ground-truth document titles, plus pool
// diagnostics (vector/keyword/overlap), latency, and the cross-vs-scoped delta that exposes the
// project-scoping defect.
//
// Usage:  npx tsx scripts/eval/run-retrieval.ts [label]
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  getSupabase, loadGolden, resolveDocMeta, scoreDocumentaryRank, precisionAtK,
  hitAtK, mean, pct, pad, padL, type Golden, type DocMeta,
} from './_harness'
import { retrieveDocuments } from '../../src/lib/rag/retrieve'

const K_VALUES = [1, 3, 5, 10]

type RunOut = {
  mode: 'cross' | 'scoped'
  ms: number
  vectorCount: number
  keywordCount: number
  poolCount: number
  overlapCount: number
  degraded: boolean
  rank: number
  /** How `rank` was scored: 'id' (pinned expected_doc_ids — honest) > 'title' (substring — optimistic). */
  scoredBy: 'id' | 'title' | 'none'
  /** precision@5 by pinned ids; null when the case is not yet id-pinned. */
  precisionAt5: number | null
  topTitles: { title: string | null; project_id: string | null; doc_type: string | null; authority: number | null; review: string | null }[]
}

async function runOne(
  sb: ReturnType<typeof getSupabase>,
  g: Golden,
  mode: 'cross' | 'scoped',
  cache: Map<string, DocMeta>,
): Promise<RunOut> {
  const f = mode === 'scoped' ? g.scoped_filter ?? {} : {}
  const t0 = Date.now()
  const { ranked, diagnostics } = await retrieveDocuments(sb, g.question, {
    projectFilter: f.project_id ?? null,
    docTypeFilter: f.doc_type ?? null,
  })
  const ms = Date.now() - t0
  await resolveDocMeta(sb, ranked.map((r) => r.document_id), cache)
  const rankedTitles = ranked.map((r) => cache.get(r.document_id)?.title)
  const rankedDocIds = ranked.map((r) => r.document_id)
  // Pinned ⇒ id-only (NO title fallback — see scoreDocumentaryRank); unpinned ⇒ optimistic title substring.
  const { rank, scoredBy } = scoreDocumentaryRank(g, rankedDocIds, rankedTitles)
  const precisionAt5 = precisionAtK(rankedDocIds, g.ground_truth?.expected_doc_ids, 5)
  const topTitles = ranked.slice(0, 5).map((r) => {
    const m = cache.get(r.document_id)
    return { title: m?.title ?? null, project_id: m?.project_id ?? null, doc_type: m?.doc_type ?? null, authority: m?.authority_score ?? null, review: m?.review_status ?? null }
  })
  return { mode, ms, ...diagnostics, rank, scoredBy, precisionAt5, topTitles }
}

function hasScoped(g: Golden): boolean {
  return !!(g.scoped_filter && (g.scoped_filter.project_id || g.scoped_filter.doc_type))
}

async function main() {
  const label = process.argv[2] || 'baseline'
  const sb = getSupabase()
  const golden = loadGolden()
  const cache = new Map<string, DocMeta>()

  const results: Array<{ g: Golden; cross: RunOut; scoped: RunOut | null }> = []

  console.log(`\n=== TIER-A RETRIEVAL EVAL (label=${label}) — ${golden.length} questions ===\n`)
  for (const g of golden) {
    const cross = await runOne(sb, g, 'cross', cache)
    const scoped = hasScoped(g) ? await runOne(sb, g, 'scoped', cache) : null
    results.push({ g, cross, scoped })

    const gt = g.ground_truth?.titles ? ` GT[${g.ground_truth.titles.join('|')}]` : ''
    const crossRank = cross.rank ? `#${cross.rank}` : '—'
    const scopedRank = scoped ? (scoped.rank ? `#${scoped.rank}` : '—') : '·'
    console.log(
      `${pad(g.id, 22)} ${pad(g.expected_kind, 12)} ` +
      `pool=${padL(cross.poolCount, 3)} (v${padL(cross.vectorCount, 2)}/k${padL(cross.keywordCount, 2)}/ov${padL(cross.overlapCount, 2)}) ` +
      `${padL(cross.ms, 4)}ms  cross=${pad(crossRank, 3)} scoped=${pad(scopedRank, 3)}${cross.degraded ? ' [DEGRADED]' : ''}`,
    )
    if (g.expected_kind === 'documentary') {
      const top = cross.topTitles.slice(0, 3).map((t, i) => `      ${i + 1}. [${t.project_id}/${t.doc_type}/a${t.authority}/${t.review}] ${String(t.title).slice(0, 60)}`).join('\n')
      console.log(top + gt + (g.notes && cross.rank === 0 ? `\n      ⚠ MISS — ${g.notes.slice(0, 90)}` : ''))
    }
  }

  // ── Aggregate ──
  const docQs = results.filter((r) => r.g.expected_kind === 'documentary' && (r.g.ground_truth?.titles?.length || r.g.ground_truth?.expected_doc_ids?.length))
  const recall = (mode: 'cross' | 'scoped', k: number) => {
    const rows = docQs.map((r) => (mode === 'cross' ? r.cross : r.scoped)).filter(Boolean) as RunOut[]
    const hits = rows.filter((r) => hitAtK(r.rank, k)).length
    return { hits, total: rows.length }
  }
  const mrr = (mode: 'cross' | 'scoped') => {
    const rows = docQs.map((r) => (mode === 'cross' ? r.cross : r.scoped)).filter(Boolean) as RunOut[]
    return mean(rows.map((r) => (r.rank ? 1 / r.rank : 0)))
  }

  console.log('\n── RECALL@k (documentary questions, by id when pinned else title) ──')
  console.log(`             ${K_VALUES.map((k) => padL('@' + k, 6)).join('')}   MRR`)
  for (const mode of ['cross', 'scoped'] as const) {
    const rec = K_VALUES.map((k) => { const { hits, total } = recall(mode, k); return padL(pct(hits, total), 6) }).join('')
    const scopedHasAny = mode === 'scoped' ? docQs.some((r) => r.scoped) : true
    if (!scopedHasAny) continue
    console.log(`  ${pad(mode, 8)} ${rec}   ${mrr(mode).toFixed(3)}`)
  }

  // Precision@5 (only over id-pinned cases) + honesty footer about the scoring mode.
  const pinned = docQs.filter((r) => r.cross.scoredBy === 'id')
  const p5vals = pinned.map((r) => r.cross.precisionAt5).filter((x): x is number => x != null)
  const titleOnly = docQs.filter((r) => r.cross.scoredBy !== 'id').length
  console.log(`  precision@5 ${p5vals.length ? mean(p5vals).toFixed(3) : 'n/a'} (over ${pinned.length} id-pinned cases)`)
  console.log(`  ⚠ title-only (optimistic) cases: ${titleOnly}/${docQs.length} — pin via resolve-ids.ts → expected_doc_ids to make precision/recall honest`)

  const allCross = results.map((r) => r.cross)
  console.log('\n── POOL / LATENCY (all questions, cross) ──')
  console.log(`  avg pool=${mean(allCross.map((r) => r.poolCount)).toFixed(1)}  vector=${mean(allCross.map((r) => r.vectorCount)).toFixed(1)}  keyword=${mean(allCross.map((r) => r.keywordCount)).toFixed(1)}  overlap=${mean(allCross.map((r) => r.overlapCount)).toFixed(1)}  latency=${mean(allCross.map((r) => r.ms)).toFixed(0)}ms  degraded=${allCross.filter((r) => r.degraded).length}`)

  // Scoping-defect callout
  const defects = docQs.filter((r) => r.scoped && hitAtK(r.cross.rank, 10) && !hitAtK(r.scoped.rank, 10))
  if (defects.length) {
    console.log('\n── SCOPING DEFECT (cross hits @10 but scoped misses) ──')
    for (const d of defects) console.log(`  ✗ ${d.g.id}: cross #${d.cross.rank} → scoped MISS (filter ${JSON.stringify(d.g.scoped_filter)})`)
  }

  // Zero-result pools (should be small/empty)
  const zeros = results.filter((r) => r.g.expected_kind === 'abstain')
  if (zeros.length) {
    console.log('\n── ZERO-RESULT pools (lower = better) ──')
    for (const z of zeros) console.log(`  ${pad(z.g.id, 18)} pool=${z.cross.poolCount} (v${z.cross.vectorCount}/k${z.cross.keywordCount})`)
  }

  const outDir = resolve(process.cwd(), 'scripts/eval/results')
  mkdirSync(outDir, { recursive: true })
  const outPath = resolve(outDir, `retrieval-${label}.json`)
  writeFileSync(outPath, JSON.stringify({ label, at: new Date().toISOString(), results }, null, 2))
  console.log(`\nWrote ${outPath}\n`)
}

main().catch((e) => { console.error(e); process.exit(1) })
