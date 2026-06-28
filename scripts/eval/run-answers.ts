// Tier-B answer evaluation: runs each golden question through the REAL chat pipeline (OpenAI primary
// agent loop + verifier) and scores the answer with (a) deterministic signals (did it cite the
// ground-truth doc / include the expected figure / call the right structured tool / abstain) and
// (b) an OpenAI primary LLM-judge (faithfulness, citation precision, completeness, behaviour correctness).
//
// Usage: npx tsx scripts/eval/run-answers.ts [label] [--only id1,id2] [--limit N] [--concurrency N]
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenAI } from '@google/genai'
import OpenAI from 'openai'
import { getSupabase, loadGolden, resolveDocMeta, titleMatches, mean, pad, padL, type Golden, type DocMeta } from './_harness'
import type { ChatTurnResult } from '../../src/lib/chat/agent'
import { isAnthropicUnavailable } from '../../src/lib/chat/agent-gemini'
import { isOpenAIUnavailable, runChatTurnOpenAIPrimary, type PrimaryChatTurnResult } from '../../src/lib/chat/agent-openai'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
const OPENAI_JUDGE_MODEL = process.env.EVAL_OPENAI_JUDGE_MODEL || process.env.OPENAI_VERIFIER_MODEL || process.env.OPENAI_CHAT_MODEL || 'gpt-5.5'
const JUDGE_MODEL = process.env.EVAL_JUDGE_MODEL || 'claude-opus-4-8'
const GEMINI_JUDGE_MODEL = process.env.EVAL_GEMINI_JUDGE_MODEL || process.env.GEMINI_VERIFIER_MODEL || 'gemini-2.5-flash'
let geminiJudge: GoogleGenAI | null = null

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

type JudgedVerdict = Verdict & { judge_provider: 'openai' | 'anthropic' | 'gemini'; judge_model: string }

type Deterministic = {
  citedExpectedDoc: boolean
  answerHasMustContain: boolean
  usedExpectedTool: boolean
  toolNames: string[]
  citedProjects: string[]
  abstainedHeuristic: boolean
}

const ABSTAIN_RE = /\b(no\s+(?:hay|existe|(?:he|hemos)\s+(?:podido\s+)?encontr|se\s+(?:han?\s+)?encontr|dispongo|tengo|consta)|sin\s+evidencia|no\s+evidence|not\s+(?:found|available|retrieved)|couldn'?t\s+find|no\s+relevant|cannot\s+find|no\s+(?:se\s+)?ha\s+recuperado|aclar|clarif|especif|which\s+project|qué\s+proyecto)/i

function mustContainMatches(answerLower: string, expected: string): boolean {
  const expectedLower = expected.toLowerCase()
  if (answerLower.includes(expectedLower)) return true

  // Accept localized numeric formatting in Spanish/English answers:
  // 27,031,176.36 and 27.031.176,36 are the same fact.
  const expectedDigits = expectedLower.replace(/\D/g, '')
  if (expectedDigits.length < 5) return false
  const answerDigits = answerLower.replace(/\D/g, '')
  return answerDigits.includes(expectedDigits)
}

function deterministic(g: Golden, r: ChatTurnResult, cache: Map<string, DocMeta>): Deterministic {
  const expectedTitles = g.ground_truth?.titles
  const expectedIds = g.ground_truth?.expected_doc_ids
  const citedExpectedDoc = expectedIds?.length
    ? r.sources.some((s) => !!s.documentId && expectedIds.includes(s.documentId))
    : !!expectedTitles && r.sources.some((s) => {
    const t = s.documentId ? cache.get(s.documentId)?.title : undefined
    return titleMatches(t, expectedTitles) || titleMatches(s.label, expectedTitles)
  })
  const must = g.ground_truth?.must_contain ?? []
  const ans = r.answer.toLowerCase()
  const answerHasMustContain = must.length > 0 && must.some((m) => mustContainMatches(ans, m))
  const toolNames = r.toolCalls.map((t) => t.name)
  const usedExpectedTool = !!g.ground_truth?.tool && toolNames.includes(g.ground_truth.tool)
  const citedProjects = [...new Set(r.sources.map((s) => (s.documentId ? cache.get(s.documentId)?.project_id : null)).filter(Boolean) as string[])]
  const abstainedHeuristic = ABSTAIN_RE.test(r.answer)
  return { citedExpectedDoc, answerHasMustContain, usedExpectedTool, toolNames, citedProjects, abstainedHeuristic }
}

function parseVerdict(text: string): Verdict | null {
  const start = text.indexOf('{')
  if (start < 0) return null
  const end = text.lastIndexOf('}')
  const raw = end > start ? text.slice(start, end + 1) : text.slice(start)
  const fromFields = (): Verdict | null => {
    const num = (key: string) => {
      const m = raw.match(new RegExp(`"${key}"\\s*:\\s*(\\d+)`))
      return m ? Number(m[1]) : null
    }
    const bool = (key: string) => {
      const m = raw.match(new RegExp(`"${key}"\\s*:\\s*(true|false)`))
      return m ? m[1] === 'true' : null
    }
    const str = (key: string) => raw.match(new RegExp(`"${key}"\\s*:\\s*"([^"]*)`))?.[1] ?? ''
    const faithfulness = num('faithfulness')
    const citation_precision = num('citation_precision')
    const completeness = num('completeness')
    const found_ground_truth = bool('found_ground_truth')
    const behavior_correct = bool('behavior_correct')
    const verdict = str('verdict')
    if (
      faithfulness == null ||
      citation_precision == null ||
      completeness == null ||
      found_ground_truth == null ||
      behavior_correct == null ||
      !['pass', 'weak', 'fail'].includes(verdict)
    ) return null
    return {
      faithfulness,
      citation_precision,
      completeness,
      found_ground_truth,
      behavior_correct,
      verdict: verdict as Verdict['verdict'],
      notes: str('notes').slice(0, 200),
    }
  }

  let v: Verdict
  try {
    v = JSON.parse(raw) as Verdict
  } catch {
    try {
      v = JSON.parse(raw.replace(/[\r\n]+/g, ' ')) as Verdict
    } catch {
      const partial = fromFields()
      if (!partial) return null
      v = partial
    }
  }
  // Harden: normalise verdict; if the model omitted/garbled it, infer from the numeric scores.
  const norm = String((v as { verdict?: unknown }).verdict ?? '').toLowerCase().trim()
  const avg = (Number(v.faithfulness) + Number(v.citation_precision) + Number(v.completeness)) / 3
  v.verdict = (['pass', 'weak', 'fail'].includes(norm) ? norm : avg >= 4 ? 'pass' : avg >= 3 ? 'weak' : 'fail') as Verdict['verdict']
  return v
}

async function judgeWithGemini(system: string, user: string): Promise<JudgedVerdict | null> {
  const key = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY
  if (!key) throw new Error('GOOGLE_AI_API_KEY not set for Gemini judge fallback')
  geminiJudge ??= new GoogleGenAI({ apiKey: key })
  const resp = await geminiJudge.models.generateContent({
    model: GEMINI_JUDGE_MODEL,
    contents: [{ role: 'user', parts: [{ text: user }] }],
    config: { systemInstruction: system, maxOutputTokens: 2000, responseMimeType: 'application/json' },
  })
  const text = resp.text ?? ''
  const verdict = parseVerdict(text)
  if (!verdict) console.error('gemini judge returned non-JSON:', text.slice(0, 300))
  return verdict ? { ...verdict, judge_provider: 'gemini', judge_model: GEMINI_JUDGE_MODEL } : null
}

async function judgeWithOpenAI(system: string, user: string): Promise<JudgedVerdict | null> {
  const resp = await openai.responses.create({
    model: OPENAI_JUDGE_MODEL,
    instructions: system,
    input: user,
    max_output_tokens: 2000,
    store: false,
  })
  const text = resp.output_text ?? ''
  const verdict = parseVerdict(text)
  if (!verdict) console.error('openai judge returned non-JSON:', text.slice(0, 300))
  return verdict ? { ...verdict, judge_provider: 'openai', judge_model: OPENAI_JUDGE_MODEL } : null
}

async function judge(g: Golden, r: ChatTurnResult, cache: Map<string, DocMeta>): Promise<JudgedVerdict | null> {
  const dedupedSources = r.sources.filter((s, i, all) => {
    if (!s.documentId) return true
    return all.findIndex((candidate) => candidate.documentId === s.documentId) === i
  })
  const sourceCards = dedupedSources.slice(0, 24).map((s, i) => ({
    i: i + 1,
    document_id: s.documentId,
    label: s.label,
    project: s.documentId ? cache.get(s.documentId)?.project_id : undefined,
    title: s.documentId ? cache.get(s.documentId)?.title : undefined,
    review_status: s.metadata.review_status,
    authority_score: s.metadata.authority_score,
    verification: s.verification,
    preview: String(s.preview ?? '').slice(0, 220),
  }))
  // Include the tool RESULT preview so the judge can actually verify structured figures (not just trust them).
  const tools = r.toolCalls.map((t) => ({ name: t.name, input: t.input, source_count: t.source_count, result_preview: t.result_preview }))

  const system = [
    'You are a strict evaluator of a financial/documentary RAG assistant for a CFO audience.',
    'Score the ANSWER against the QUESTION and the GROUND TRUTH. Be harsh about fabrication and mis-citation.',
    'Scores are integers 1-5 (5 best).',
    '- faithfulness: every material claim is supported by a cited source card or tool result; no invented numbers/names/dates. A confident answer with NO supporting evidence scores 1.',
    '- citation_precision: the cited sources actually support the claims and are the RIGHT documents; citing irrelevant/!=ground-truth docs lowers this. If GROUND TRUTH has expected_doc_ids, a cited source card with a matching document_id is expected and must NOT be penalized as irrelevant merely because its title/project is not repeated in GROUND TRUTH titles.',
    '- completeness: covers what the question asks (without padding).',
    'STRUCTURED questions: the evidence is the TOOL RESULT (each tool entry includes a result_preview), not source cards — source_count=0 is NORMAL for get_capex_summary/get_funding_status/get_covenant_status/get_risk_register/get_cash_runway/compare_projects/get_contradictions and must NOT by itself lower faithfulness or citation_precision. Verify the reported figures AGAINST the tool result_preview: numbers consistent with the preview are supported; numbers NOT present in (and not derivable from) the preview are fabrications and must lower faithfulness. Do not assume a figure is invented just because the question NOTE highlights a different one — credit any value that matches the tool result.',
    'Numeric formatting may be localized: treat 27,031,176.36 and 27.031.176,36 as the same value when comparing the answer to ground truth or source previews.',
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
    return await judgeWithOpenAI(system, user)
  } catch (e) {
    if (isOpenAIUnavailable(e)) {
      console.error('openai judge unavailable:', (e as Error).message)
    } else {
      console.error('openai judge failed:', (e as Error).message)
      return null
    }
  }

  try {
    const resp = await anthropic.messages.create({ model: JUDGE_MODEL, max_tokens: 2000, system, messages: [{ role: 'user', content: user }] })
    const text = resp.content.find((b) => b.type === 'text')?.text ?? ''
    const verdict = parseVerdict(text)
    return verdict ? { ...verdict, judge_provider: 'anthropic', judge_model: JUDGE_MODEL } : null
  } catch (e) {
    if (isAnthropicUnavailable(e)) {
      try {
        return await judgeWithGemini(system, user)
      } catch (fallbackErr) {
        console.error('gemini judge failed:', (fallbackErr as Error).message)
      }
    } else {
      console.error('judge failed:', (e as Error).message)
    }
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
  const skippedLatencyOnly = golden.filter((g) => g.id === 'common-terms-latency')
  golden = golden.filter((g) => g.id !== 'common-terms-latency')

  console.log(`\n=== TIER-B ANSWER EVAL (label=${label}) — ${golden.length} questions, concurrency=${concurrency}, judge=openai:${OPENAI_JUDGE_MODEL} ===\n`)
  if (skippedLatencyOnly.length) console.log(`Skipped latency-only retrieval guards: ${skippedLatencyOnly.map((g) => g.id).join(', ')}\n`)
  const cache = new Map<string, DocMeta>()

  const rows = await pool(golden, concurrency, async (g) => {
    const t0 = Date.now()
    let r: PrimaryChatTurnResult
    try {
      r = await runChatTurnOpenAIPrimary(anthropic, g.question)
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
      `tools=[${det.toolNames.join(',')}] proj=[${det.citedProjects.join(',')}] provider=${r.provider}${v ? `/judge=${v.judge_provider}` : ''}${r.verified ? '' : ' UNVERIFIED'}`
    console.log(line)
    if (v && v.verdict !== 'pass') console.log(`      ↳ ${v.notes}`)
    const sourceDetail = r.sources.map((s) => ({
      document_id: s.documentId,
      label: s.label,
      project: s.documentId ? cache.get(s.documentId)?.project_id ?? null : null,
      title: s.documentId ? cache.get(s.documentId)?.title ?? null : null,
      review_status: s.metadata.review_status ?? null,
      authority_score: s.metadata.authority_score ?? null,
      verification: s.verification,
    }))
    return { g, r: { answer: r.answer, sourceCount: r.sources.length, sources: sourceDetail, verified: r.verified, model: r.model, provider: r.provider, fallback: r.fallback }, ms, det, verdict: v }
  })

  // ── Aggregate ──
  const ok = rows.filter((x) => 'verdict' in x && x.verdict) as Array<{ g: Golden; ms: number; det: Deterministic; verdict: JudgedVerdict }>
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

  const gateFailures = rows.flatMap((row) => {
    if (!('verdict' in row) || !row.verdict) return [{ id: row.g.id, reason: 'unscored/error' }]
    const reasons = [
      row.verdict.verdict !== 'pass' ? `verdict=${row.verdict.verdict}` : null,
      !row.verdict.found_ground_truth ? 'missing_ground_truth' : null,
      !row.verdict.behavior_correct ? 'behavior_incorrect' : null,
    ].filter((reason): reason is string => Boolean(reason))
    return reasons.length ? [{ id: row.g.id, reason: reasons.join(',') }] : []
  })
  if (gateFailures.length) {
    console.log('\n── GATE FAILURES ──')
    for (const failure of gateFailures) console.log(`  ✗ ${failure.id}: ${failure.reason}`)
    if (process.env.EVAL_ANSWERS_STRICT !== 'false') process.exitCode = 1
  }

  const outDir = resolve(process.cwd(), 'scripts/eval/results')
  mkdirSync(outDir, { recursive: true })
  const outPath = resolve(outDir, `answers-${label}.json`)
  writeFileSync(outPath, JSON.stringify({ label, at: new Date().toISOString(), rows }, null, 2))
  console.log(`\nWrote ${outPath}\n`)
}

main().catch((e) => { console.error(e); process.exit(1) })
