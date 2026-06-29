// Tier-A retrieval evaluation: runs every golden question through the REAL production retrieval core
// (retrieveDocuments → match_chunks + keyword_search_chunks via supabase-js/PostgREST → Cohere rerank
// → trust-tier sort) and measures recall@k against live ground-truth document titles, plus pool
// diagnostics (vector/keyword/overlap), latency, and the cross-vs-scoped delta that exposes the
// project-scoping defect.
//
// Usage:  npx tsx scripts/eval/run-retrieval.ts [label] [--only id1,id2] [--limit N]
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  getSupabase, loadGolden, resolveDocMeta, scoreDocumentaryRank, precisionAtK,
  hitAtK, mean, pct, pad, padL, type Golden, type DocMeta,
} from './_harness'
import { retrieveDocuments } from '../../src/lib/rag/retrieve'

const K_VALUES = [1, 3, 5, 10]
const PHASE_TIMEOUT_MS = positiveIntEnv('EVAL_RETRIEVAL_PHASE_TIMEOUT_MS', 240_000)

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag)
  return i >= 0 ? process.argv[i + 1] : undefined
}

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

export type RetrievalResult = { g: Golden; cross: RunOut; scoped: RunOut | null }

type ModeSummary = {
  total: number
  recallAt1: number | null
  recallAt3: number | null
  recallAt5: number | null
  recallAt10: number | null
  mrr: number | null
}

export type RetrievalSummary = {
  ok: boolean
  failures: string[]
  documentary: {
    total: number
    pinned: number
    titleOnly: number
    cross: ModeSummary
    scoped: ModeSummary | null
    precisionAt5: number | null
  }
  latency: {
    avgMs: number
    degradedCount: number
  }
  zeroResultPools: Array<{ id: string; pool: number; vector: number; keyword: number }>
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
  console.log(JSON.stringify({ eval: 'retrieval', event, at: new Date().toISOString(), ...fields }))
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

function hasDocumentaryGroundTruth(g: Golden): boolean {
  return !!(g.ground_truth?.titles?.length || g.ground_truth?.expected_doc_ids?.length)
}

function ratio(n: number, d: number): number | null {
  return d === 0 ? null : n / d
}

export function buildRetrievalSummary(results: RetrievalResult[]): RetrievalSummary {
  const docQs = results.filter((r) => r.g.expected_kind === 'documentary' && hasDocumentaryGroundTruth(r.g))
  const modeRows = (mode: 'cross' | 'scoped') =>
    docQs.map((r) => (mode === 'cross' ? r.cross : r.scoped)).filter(Boolean) as RunOut[]
  const modeSummary = (mode: 'cross' | 'scoped'): ModeSummary | null => {
    const rows = modeRows(mode)
    if (mode === 'scoped' && rows.length === 0) return null
    return {
      total: rows.length,
      recallAt1: ratio(rows.filter((r) => hitAtK(r.rank, 1)).length, rows.length),
      recallAt3: ratio(rows.filter((r) => hitAtK(r.rank, 3)).length, rows.length),
      recallAt5: ratio(rows.filter((r) => hitAtK(r.rank, 5)).length, rows.length),
      recallAt10: ratio(rows.filter((r) => hitAtK(r.rank, 10)).length, rows.length),
      mrr: rows.length ? mean(rows.map((r) => (r.rank ? 1 / r.rank : 0))) : null,
    }
  }

  const pinned = docQs.filter((r) => r.cross.scoredBy === 'id')
  const p5vals = pinned.map((r) => r.cross.precisionAt5).filter((x): x is number => x != null)
  const titleOnly = docQs.filter((r) => r.cross.scoredBy !== 'id').length
  const allCross = results.map((r) => r.cross)
  const zeroResultPools = results
    .filter((r) => r.g.expected_kind === 'abstain')
    .map((r) => ({ id: r.g.id, pool: r.cross.poolCount, vector: r.cross.vectorCount, keyword: r.cross.keywordCount }))

  const failures: string[] = []
  if (docQs.length === 0) failures.push('No documentary retrieval cases with ground truth were evaluated.')
  for (const row of pinned) {
    if (!hitAtK(row.cross.rank, 5)) failures.push(`${row.g.id}: expected pinned document missing from cross top 5.`)
    if (row.scoped && hitAtK(row.cross.rank, 10) && !hitAtK(row.scoped.rank, 10)) {
      failures.push(`${row.g.id}: scoped retrieval missed a document found by cross retrieval.`)
    }
  }
  if (titleOnly > 0) failures.push(`${titleOnly} documentary retrieval cases are still title-only; pin expected_doc_ids.`)
  const degradedCount = allCross.filter((r) => r.degraded).length
  if (degradedCount > 0) failures.push(`${degradedCount} cross retrieval cases ran degraded.`)

  return {
    ok: failures.length === 0,
    failures,
    documentary: {
      total: docQs.length,
      pinned: pinned.length,
      titleOnly,
      cross: modeSummary('cross') ?? { total: 0, recallAt1: null, recallAt3: null, recallAt5: null, recallAt10: null, mrr: null },
      scoped: modeSummary('scoped'),
      precisionAt5: p5vals.length ? mean(p5vals) : null,
    },
    latency: {
      avgMs: mean(allCross.map((r) => r.ms)),
      degradedCount,
    },
    zeroResultPools,
  }
}

async function main() {
  const label = process.argv[2] || 'baseline'
  const only = arg('--only')?.split(',').map((s) => s.trim())
  const limit = arg('--limit') ? Number(arg('--limit')) : undefined
  const sb = getSupabase()
  let golden = loadGolden()
  if (only) golden = golden.filter((g) => only.includes(g.id))
  if (limit) golden = golden.slice(0, limit)
  const cache = new Map<string, DocMeta>()

  const results: RetrievalResult[] = []

  console.log(`\n=== TIER-A RETRIEVAL EVAL (label=${label}) — ${golden.length} questions, phase_timeout=${PHASE_TIMEOUT_MS}ms ===\n`)
  for (const g of golden) {
    const caseStart = Date.now()
    logProgress('case_start', { id: g.id, expected_kind: g.expected_kind, category: g.category })
    logProgress('mode_start', { id: g.id, mode: 'cross' })
    let cross: RunOut
    try {
      cross = await withTimeout(runOne(sb, g, 'cross', cache), PHASE_TIMEOUT_MS, `${g.id} cross retrieval`)
      logProgress('mode_done', {
        id: g.id,
        mode: 'cross',
        ms: cross.ms,
        pool: cross.poolCount,
        vector: cross.vectorCount,
        keyword: cross.keywordCount,
        overlap: cross.overlapCount,
        rank: cross.rank,
        degraded: cross.degraded,
      })
    } catch (e) {
      logProgress('case_error', { id: g.id, mode: 'cross', ms: Date.now() - caseStart, error: errorMessage(e) })
      throw e
    }

    let scoped: RunOut | null = null
    if (hasScoped(g)) {
      logProgress('mode_start', { id: g.id, mode: 'scoped', filter: g.scoped_filter ?? null })
      try {
        scoped = await withTimeout(runOne(sb, g, 'scoped', cache), PHASE_TIMEOUT_MS, `${g.id} scoped retrieval`)
        logProgress('mode_done', {
          id: g.id,
          mode: 'scoped',
          ms: scoped.ms,
          pool: scoped.poolCount,
          vector: scoped.vectorCount,
          keyword: scoped.keywordCount,
          overlap: scoped.overlapCount,
          rank: scoped.rank,
          degraded: scoped.degraded,
        })
      } catch (e) {
        logProgress('case_error', { id: g.id, mode: 'scoped', ms: Date.now() - caseStart, error: errorMessage(e) })
        throw e
      }
    }
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
      console.log(top + gt + (hasDocumentaryGroundTruth(g) && g.notes && cross.rank === 0 ? `\n      ⚠ MISS — ${g.notes.slice(0, 90)}` : ''))
    }
    logProgress('case_done', {
      id: g.id,
      ms: Date.now() - caseStart,
      cross_rank: cross.rank,
      scoped_rank: scoped?.rank ?? null,
      degraded: cross.degraded || scoped?.degraded === true,
    })
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
  const summary = buildRetrievalSummary(results)
  if (!summary.ok) {
    console.log('\n── STRICT RETRIEVAL FAILURES ──')
    for (const failure of summary.failures) console.log(`  ✗ ${failure}`)
  }
  writeFileSync(outPath, JSON.stringify({ label, at: new Date().toISOString(), summary, results }, null, 2))
  console.log(`\nWrote ${outPath}\n`)
  if (!summary.ok && process.env.EVAL_RETRIEVAL_STRICT !== 'false') process.exitCode = 1
}

if (process.env.VITEST !== 'true') {
  main().catch((e) => { console.error(e); process.exit(1) })
}
