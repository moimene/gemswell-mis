// Tier-B answer evaluation: runs each golden question through the REAL chat pipeline (runChatTurn =
// agent loop + Opus verifier) and scores the answer with (a) deterministic signals (did it cite the
// ground-truth doc / include the expected figure / call the right structured tool / abstain) and
// (b) an Opus LLM-judge (faithfulness, citation precision, completeness, behaviour correctness).
//
// Usage: npx tsx scripts/eval/run-answers.ts [label] [--only id1,id2] [--limit N] [--concurrency N]
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import Anthropic from '@anthropic-ai/sdk'
import { getSupabase, loadGolden, resolveDocMeta, titleMatches, mean, pad, padL, type Golden, type DocMeta } from './_harness'
import { runChatTurn, type ChatTurnResult } from '../../src/lib/chat/agent'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
const JUDGE_MODEL = process.env.EVAL_JUDGE_MODEL || 'claude-opus-4-8'

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag)
  return i >= 0 ? process.argv[i + 1] : undefined
}

type Verdict = {
  faithfulness: number
  citation_precision: number
  completeness: number
  found_ground_truth: boolean
  behavior_correct: boolean
  verdict: 'pass' | 'weak' | 'fail'
  notes: string
}

type Deterministic = {
  citedExpectedDoc: boolean
  answerHasMustContain: boolean
  usedExpectedTool: boolean
  toolNames: string[]
  citedProjects: string[]
  abstainedHeuristic: boolean
}

const ABSTAIN_RE = /\b(no\s+(?:hay|existe|se\s+(?:han?\s+)?encontr|dispongo|tengo|consta)|sin\s+evidencia|no\s+evidence|not\s+(?:found|available|retrieved)|couldn'?t\s+find|no\s+relevant|cannot\s+find|no\s+(?:se\s+)?ha\s+recuperado|aclar|clarif|especif|which\s+project|qué\s+proyecto)/i

function deterministic(g: Golden, r: ChatTurnResult, cache: Map<string, DocMeta>): Deterministic {
  const expectedTitles = g.ground_truth?.titles
  const citedExpectedDoc = !!expectedTitles && r.sources.some((s) => {
    const t = s.documentId ? cache.get(s.documentId)?.title : undefined
    return titleMatches(t, expectedTitles) || titleMatches(s.label, expectedTitles)
  })
  const must = g.ground_truth?.must_contain ?? []
  const ans = r.answer.toLowerCase()
  const answerHasMustContain = must.length > 0 && must.some((m) => ans.includes(m.toLowerCase()))
  const toolNames = r.toolCalls.map((t) => t.name)
  const usedExpectedTool = !!g.ground_truth?.tool && toolNames.includes(g.ground_truth.tool)
  const citedProjects = [...new Set(r.sources.map((s) => (s.documentId ? cache.get(s.documentId)?.project_id : null)).filter(Boolean) as string[])]
  const abstainedHeuristic = ABSTAIN_RE.test(r.answer)
  return { citedExpectedDoc, answerHasMustContain, usedExpectedTool, toolNames, citedProjects, abstainedHeuristic }
}

async function judge(g: Golden, r: ChatTurnResult, cache: Map<string, DocMeta>): Promise<Verdict | null> {
  const sourceCards = r.sources.slice(0, 12).map((s, i) => ({
    i: i + 1,
    label: s.label,
    project: s.documentId ? cache.get(s.documentId)?.project_id : undefined,
    title: s.documentId ? cache.get(s.documentId)?.title : undefined,
    verification: s.verification,
    preview: String(s.preview ?? '').slice(0, 220),
  }))
  const tools = r.toolCalls.map((t) => ({ name: t.name, input: t.input, source_count: t.source_count }))

  const system = [
    'You are a strict evaluator of a financial/documentary RAG assistant for a CFO audience.',
    'Score the ANSWER against the QUESTION and the GROUND TRUTH. Be harsh about fabrication and mis-citation.',
    'Scores are integers 1-5 (5 best).',
    '- faithfulness: every material claim is supported by a cited source card or tool result; no invented numbers/names/dates. A confident answer with NO supporting evidence scores 1.',
    '- citation_precision: the cited sources actually support the claims and are the RIGHT documents; citing irrelevant/!=ground-truth docs lowers this.',
    '- completeness: covers what the question asks (without padding).',
    'STRUCTURED questions: the evidence is the TOOL RESULT, not source cards — source_count=0 is NORMAL for get_capex_summary/get_funding_status/get_covenant_status/get_risk_register/get_cash_runway/compare_projects/get_contradictions and must NOT by itself lower faithfulness or citation_precision. Judge whether the reported figures are consistent with what that structured tool returns; only penalise numbers that look invented relative to the tool call.',
    'Booleans:',
    '- found_ground_truth: did the answer actually use/cite the expected document (titles) OR state the expected fact (must_contain) OR call the expected structured tool? For abstain/ambiguous questions set true if the EXPECTED behaviour happened.',
    '- behavior_correct: documentary→cited the right doc & answered; structured→used the structured tool (not doc search) & gave the figure; abstain→explicitly abstained / said no evidence (did NOT fabricate); ambiguous→asked for clarification instead of guessing.',
    'verdict: "pass" if a CFO could trust & act on it; "weak" if partially right or under-evidenced; "fail" if wrong, fabricated, or mis-scoped.',
    'Output ONLY a JSON object: {"faithfulness":n,"citation_precision":n,"completeness":n,"found_ground_truth":bool,"behavior_correct":bool,"verdict":"pass|weak|fail","notes":"<=200 chars"}',
  ].join('\n')

  const user = [
    `QUESTION (${g.lang}, expected_kind=${g.expected_kind}, category=${g.category}):\n${g.question}`,
    `GROUND TRUTH:\n${JSON.stringify(g.ground_truth ?? {})}${g.notes ? `\nNOTE: ${g.notes}` : ''}`,
    `ASSISTANT ANSWER:\n${r.answer}`,
    `TOOLS CALLED:\n${JSON.stringify(tools, null, 1)}`,
    `CITED SOURCE CARDS:\n${JSON.stringify(sourceCards, null, 1)}`,
    `(verified=${r.verified}, model=${r.model})`,
    'Return ONLY the JSON object.',
  ].join('\n\n---\n\n')

  try {
    const resp = await anthropic.messages.create({ model: JUDGE_MODEL, max_tokens: 700, system, messages: [{ role: 'user', content: user }] })
    const text = resp.content.find((b) => b.type === 'text')?.text ?? ''
    const m = text.match(/\{[\s\S]*\}/)
    if (!m) return null
    const v = JSON.parse(m[0]) as Verdict
    // Harden: normalise verdict; if the model omitted/garbled it, infer from the numeric scores.
    const norm = String((v as { verdict?: unknown }).verdict ?? '').toLowerCase().trim()
    const avg = (Number(v.faithfulness) + Number(v.citation_precision) + Number(v.completeness)) / 3
    v.verdict = (['pass', 'weak', 'fail'].includes(norm) ? norm : avg >= 4 ? 'pass' : avg >= 3 ? 'weak' : 'fail') as Verdict['verdict']
    return v
  } catch (e) {
    console.error('judge failed:', (e as Error).message)
    return null
  }
}

async function pool<T, R>(items: T[], n: number, fn: (t: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let idx = 0
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (idx < items.length) {
      const i = idx++
      out[i] = await fn(items[i], i)
    }
  }))
  return out
}

async function main() {
  const label = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'baseline'
  const only = arg('--only')?.split(',').map((s) => s.trim())
  const limit = arg('--limit') ? Number(arg('--limit')) : undefined
  const concurrency = arg('--concurrency') ? Number(arg('--concurrency')) : 3

  const sb = getSupabase()
  let golden = loadGolden()
  if (only) golden = golden.filter((g) => only.includes(g.id))
  if (limit) golden = golden.slice(0, limit)

  console.log(`\n=== TIER-B ANSWER EVAL (label=${label}) — ${golden.length} questions, concurrency=${concurrency}, judge=${JUDGE_MODEL} ===\n`)
  const cache = new Map<string, DocMeta>()

  const rows = await pool(golden, concurrency, async (g) => {
    const t0 = Date.now()
    let r: ChatTurnResult
    try {
      r = await runChatTurn(anthropic, g.question)
    } catch (e) {
      console.log(`${pad(g.id, 22)} ERROR: ${(e as Error).message}`)
      return { g, error: (e as Error).message }
    }
    const ms = Date.now() - t0
    await resolveDocMeta(sb, r.sources.map((s) => s.documentId).filter(Boolean) as string[], cache)
    const det = deterministic(g, r, cache)
    const v = await judge(g, r, cache)
    const line = `${pad(g.id, 22)} ${pad(g.expected_kind, 12)} ${padL(ms, 6)}ms verdict=${pad(v?.verdict ?? '?', 5)} ` +
      `F${v?.faithfulness ?? '?'} C${v?.citation_precision ?? '?'} K${v?.completeness ?? '?'} ` +
      `gt=${det.citedExpectedDoc || det.answerHasMustContain || det.usedExpectedTool ? 'Y' : 'n'} ` +
      `tools=[${det.toolNames.join(',')}] proj=[${det.citedProjects.join(',')}]${r.verified ? '' : ' UNVERIFIED'}`
    console.log(line)
    if (v && v.verdict !== 'pass') console.log(`      ↳ ${v.notes}`)
    const sourceDetail = r.sources.map((s) => ({
      label: s.label,
      project: s.documentId ? cache.get(s.documentId)?.project_id ?? null : null,
      title: s.documentId ? cache.get(s.documentId)?.title ?? null : null,
      verification: s.verification,
    }))
    return { g, r: { answer: r.answer, sourceCount: r.sources.length, sources: sourceDetail, verified: r.verified, model: r.model }, ms, det, verdict: v }
  })

  // ── Aggregate ──
  const ok = rows.filter((x) => 'verdict' in x && x.verdict) as Array<{ g: Golden; ms: number; det: Deterministic; verdict: Verdict }>
  const by = (kind: string) => ok.filter((x) => x.g.expected_kind === kind)
  const avg = (xs: typeof ok, k: 'faithfulness' | 'citation_precision' | 'completeness') => mean(xs.map((x) => x.verdict[k]))
  const rate = (xs: typeof ok, pred: (x: typeof ok[number]) => boolean) => xs.length ? `${Math.round((xs.filter(pred).length / xs.length) * 100)}%` : 'n/a'

  console.log('\n── AGGREGATE ──')
  console.log(`  N scored: ${ok.length}/${golden.length}   avg latency ${Math.round(mean(ok.map((x) => x.ms)))}ms`)
  console.log(`  faithfulness ${avg(ok, 'faithfulness').toFixed(2)}  citation ${avg(ok, 'citation_precision').toFixed(2)}  completeness ${avg(ok, 'completeness').toFixed(2)}`)
  console.log(`  verdict: pass ${rate(ok, (x) => x.verdict.verdict === 'pass')}  weak ${rate(ok, (x) => x.verdict.verdict === 'weak')}  fail ${rate(ok, (x) => x.verdict.verdict === 'fail')}`)
  console.log(`  found_ground_truth ${rate(ok, (x) => x.verdict.found_ground_truth)}  behavior_correct ${rate(ok, (x) => x.verdict.behavior_correct)}`)
  for (const kind of ['documentary', 'structured', 'abstain', 'ambiguous']) {
    const xs = by(kind)
    if (!xs.length) continue
    console.log(`  [${pad(kind, 12)}] n=${xs.length} pass ${rate(xs, (x) => x.verdict.verdict === 'pass')} behavior ${rate(xs, (x) => x.verdict.behavior_correct)} F${avg(xs, 'faithfulness').toFixed(1)} C${avg(xs, 'citation_precision').toFixed(1)}`)
  }

  const outDir = resolve(process.cwd(), 'scripts/eval/results')
  mkdirSync(outDir, { recursive: true })
  const outPath = resolve(outDir, `answers-${label}.json`)
  writeFileSync(outPath, JSON.stringify({ label, at: new Date().toISOString(), rows }, null, 2))
  console.log(`\nWrote ${outPath}\n`)
}

main().catch((e) => { console.error(e); process.exit(1) })
