// WS7-T1 — Cross-model embedding compatibility experiment (Fase 8, BLOCKING for convergence).
//
// Question that actually decides the pin: NOT "do the two models give similar vectors for the
// same text?" but "if a corpus is embedded with model A and queried with a vector from model B
// (a SHARED corpus without re-embed), is the nearest-neighbour ranking preserved?"
//
// A uniform rotation between the two spaces would preserve NN ranking while destroying same-text
// cosine; a non-isometric warp destroys NN ranking. So the retrieval-interop metric (C) is the
// one that gates the decision. Same-text cosine (A) and within-model structure (B) are context.
//
// Usage:  GOOGLE_AI_API_KEY=... node scripts/experiments/embedding-compat.mjs
// Output: machine-readable JSON to stdout + scripts/experiments/embedding-compat-result.json
// Cost:   ~ (texts × models) single-text REST calls. Read-only; no DB, no writes to prod.

import { readFileSync, writeFileSync } from 'node:fs'

// ── key (env or .env.local) ───────────────────────────────────────────────
function loadKey() {
  if (process.env.GOOGLE_AI_API_KEY) return process.env.GOOGLE_AI_API_KEY
  try {
    const env = readFileSync(new URL('../../.env.local', import.meta.url), 'utf8')
    const m = env.match(/^GOOGLE_AI_API_KEY=(.*)$/m)
    if (m) return m[1].trim().replace(/^["']|["']$/g, '')
  } catch { /* ignore */ }
  throw new Error('GOOGLE_AI_API_KEY not set')
}
const API_KEY = loadKey()

const MODELS = ['gemini-embedding-001', 'gemini-embedding-2-preview', 'gemini-embedding-2']
const DIM = 768 // match prod (gemini-embedding-001 @ outputDimensionality=768)

// ── corpus: bilingual ES/EN financial domain (matches Gemswell corpus) ─────
// Queries paired with the ONE target that should win; plus distractors. This mirrors the real
// retrieval task: a query must surface its target above unrelated financial sentences.
const QUERIES = [
  { id: 'q1', text: 'What is the total capex budget for the Madrid Playa Surf project?', target: 't1' },
  { id: 'q2', text: '¿Cuándo abre el centro de Birmingham?', target: 't2' },
  { id: 'q3', text: 'cash flow position over the next 13 weeks', target: 't3' },
  { id: 'q4', text: 'condiciones de la financiación senior del fondo Kelpa', target: 't4' },
  { id: 'q5', text: 'Who are the directors that signed the shareholders agreement?', target: 't5' },
  { id: 'q6', text: 'desviación del coste de construcción frente al presupuesto aprobado', target: 't6' },
]
const TARGETS = [
  { id: 't1', text: 'El presupuesto total de capex para Madrid Playa Surf asciende a 65 millones de euros, repartidos entre obra civil y equipamiento.' },
  { id: 't2', text: 'Birmingham (BHX) se encuentra en fase de planificación; su apertura está prevista con posterioridad a la de Madrid, que abre en el primer trimestre de 2027.' },
  { id: 't3', text: 'The 13-week cash flow forecast shows a tight treasury position in the third quarter before funding drawdowns improve liquidity.' },
  { id: 't4', text: 'La financiación senior de Kelpa HoldCo se concede a un tipo de interés referenciado a Euribor más un diferencial, con vencimiento bullet a cinco años.' },
  { id: 't5', text: 'The shareholders agreement was executed by the directors appointed by each investor, including the chair of the board and the fund representative.' },
  { id: 't6', text: 'La desviación del coste de construcción de Madrid frente al presupuesto aprobado es de aproximadamente ocho millones de euros, pendiente de validación por el CFO.' },
]
// Distractors: plausible financial sentences that must NOT outrank the real target.
const DISTRACTORS = [
  { id: 'd1', text: 'The portfolio-wide ESG reporting framework aggregates carbon metrics across all operating sites on a quarterly basis.' },
  { id: 'd2', text: 'El calendario de mantenimiento preventivo de las instalaciones se revisa anualmente por el equipo de operaciones.' },
  { id: 'd3', text: 'Marketing spend for the pre-opening campaign is allocated across digital channels and local partnerships.' },
  { id: 'd4', text: 'La política de recursos humanos establece los rangos salariales y el plan de incentivos para el personal de apertura.' },
  { id: 'd5', text: 'Insurance coverage for the construction phase includes contractor all-risk and third-party liability policies.' },
  { id: 'd6', text: 'El protocolo de ciberseguridad define las copias de seguridad y la respuesta ante incidentes de los sistemas internos.' },
]
const CORPUS = [...TARGETS, ...DISTRACTORS]
const ALL = [...QUERIES, ...CORPUS]

// ── embedding via REST embedContent (same endpoint shape the app uses) ─────
async function embed(model, text, dim) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent`
  const body = { model: `models/${model}`, content: { parts: [{ text }] } }
  if (dim) body.outputDimensionality = dim
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': API_KEY },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const t = await res.text()
    const e = new Error(`${model} ${res.status}: ${t.slice(0, 300)}`)
    e.status = res.status
    throw e
  }
  const j = await res.json()
  return j.embedding?.values ?? []
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

// ── linear algebra (cosine normalizes, so truncated/unnormalised vectors are fine) ──
function dot(a, b) { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s }
function norm(a) { return Math.sqrt(dot(a, a)) }
function cosine(a, b) { const n = norm(a) * norm(b); return n === 0 ? 0 : dot(a, b) / n }

function rank(queryVec, corpusVecs) {
  return CORPUS
    .map((c, i) => ({ id: c.id, score: cosine(queryVec, corpusVecs[i]) }))
    .sort((x, y) => y.score - x.score)
}
function rankOf(ranked, id) { return ranked.findIndex(r => r.id === id) + 1 } // 1-based
function ndcgAt(ranked, targetId, k) {
  // single relevant doc → nDCG = 1/log2(rank+1) if within k else 0 (ideal DCG = 1)
  const r = rankOf(ranked, targetId)
  return r > 0 && r <= k ? 1 / Math.log2(r + 1) : 0
}
function spearman(rankingA, rankingB) {
  // rank correlation over the corpus ordering (by id)
  const posA = new Map(rankingA.map((r, i) => [r.id, i]))
  const posB = new Map(rankingB.map((r, i) => [r.id, i]))
  const ids = rankingA.map(r => r.id)
  const n = ids.length
  let d2 = 0
  for (const id of ids) { const d = posA.get(id) - posB.get(id); d2 += d * d }
  return 1 - (6 * d2) / (n * (n * n - 1))
}

async function embedAllFor(model, dim) {
  const map = {}
  for (const item of ALL) {
    let tries = 0
    for (;;) {
      try { map[item.id] = await embed(model, item.text, dim); break }
      catch (e) {
        if (e.status === 429 && tries < 5) { tries++; await sleep(2000 * tries); continue }
        throw e
      }
    }
    await sleep(120)
  }
  return map
}

async function main() {
  const result = { dim: DIM, models: {}, metrics: {}, generatedBy: 'scripts/experiments/embedding-compat.mjs' }

  // 1) embed everything with each model (record native dim + whether 768 truncation honoured)
  const vecs = {}
  for (const model of MODELS) {
    try {
      const m = await embedAllFor(model, DIM)
      const got = m['q1'].length
      vecs[model] = m
      result.models[model] = { ok: true, requestedDim: DIM, returnedDim: got }
      process.stderr.write(`embedded ${model}: returnedDim=${got}\n`)
    } catch (e) {
      result.models[model] = { ok: false, error: String(e.message || e) }
      process.stderr.write(`FAILED ${model}: ${e.message}\n`)
    }
  }

  const available = MODELS.filter(m => vecs[m])
  const A = 'gemini-embedding-001' // prod (the corpus is embedded with this)

  // metric B — within-model retrieval quality (sanity: each model "works" on its own)
  for (const model of available) {
    const corpusVecs = CORPUS.map(c => vecs[model][c.id])
    let top1 = 0, ndcg5 = 0
    for (const q of QUERIES) {
      const r = rank(vecs[model][q.id], corpusVecs)
      if (r[0].id === q.target) top1++
      ndcg5 += ndcgAt(r, q.target, 5)
    }
    result.metrics[`within_${model}`] = {
      top1Accuracy: top1 / QUERIES.length,
      ndcg5: ndcg5 / QUERIES.length,
    }
  }

  // metric A — same-text cross-model cosine (A vs each other available model)
  for (const model of available) {
    if (model === A) continue
    const cosSame = ALL.map(it => cosine(vecs[A][it.id], vecs[model][it.id]))
    cosSame.sort((x, y) => x - y)
    const mean = cosSame.reduce((s, v) => s + v, 0) / cosSame.length
    result.metrics[`sameText_${A}_vs_${model}`] = {
      mean, min: cosSame[0], max: cosSame[cosSame.length - 1],
      median: cosSame[Math.floor(cosSame.length / 2)],
    }
  }

  // equivalence probe — are -preview and GA the same model? (direct same-text cosine)
  if (vecs['gemini-embedding-2-preview'] && vecs['gemini-embedding-2']) {
    const cosEq = ALL.map(it => cosine(vecs['gemini-embedding-2-preview'][it.id], vecs['gemini-embedding-2'][it.id]))
    const mean = cosEq.reduce((s, v) => s + v, 0) / cosEq.length
    result.metrics['equivalence_2preview_vs_2'] = {
      mean, min: Math.min(...cosEq), max: Math.max(...cosEq),
    }
  }

  // metric C — THE DECIDER: corpus embedded with A, queried with B (shared corpus, no re-embed)
  const corpusVecsA = CORPUS.map(c => vecs[A][c.id])
  for (const model of available) {
    if (model === A) continue
    let crossTop1 = 0, crossNdcg5 = 0, spearSum = 0, targetRankDrop = 0
    const perQuery = []
    for (const q of QUERIES) {
      const rNative = rank(vecs[A][q.id], corpusVecsA)        // prod baseline: A-query vs A-corpus
      const rCross = rank(vecs[model][q.id], corpusVecsA)      // interop: B-query vs A-corpus
      if (rCross[0].id === q.target) crossTop1++
      crossNdcg5 += ndcgAt(rCross, q.target, 5)
      spearSum += spearman(rNative, rCross)
      const drop = rankOf(rCross, q.target) - rankOf(rNative, q.target)
      targetRankDrop += drop
      perQuery.push({
        q: q.id,
        nativeTop1: rNative[0].id, crossTop1: rCross[0].id,
        nativeTargetRank: rankOf(rNative, q.target), crossTargetRank: rankOf(rCross, q.target),
      })
    }
    result.metrics[`interop_corpusA_query_${model}`] = {
      crossTop1Accuracy: crossTop1 / QUERIES.length,
      crossNdcg5: crossNdcg5 / QUERIES.length,
      meanSpearmanVsNative: spearSum / QUERIES.length,
      meanTargetRankDrop: targetRankDrop / QUERIES.length,
      perQuery,
    }
  }

  const out = JSON.stringify(result, null, 2)
  writeFileSync(new URL('./embedding-compat-result.json', import.meta.url), out)
  console.log(out)
}

main().catch(e => { console.error(e); process.exit(1) })
