// Fast, deterministic behavioral gate for SYSTEM_PROMPT changes (complements the heavier, judge-based
// eval:answers). Runs the real chat agent (OpenAI primary loop + verifier) over the cases most sensitive
// to prompt edits and asserts behavioral signals — does it search? abstain? clarify? mention the key
// fact? — without the Opus-judge variance. Use it before/after each prompt increment to catch regressions.
//
// Usage: npx tsx scripts/eval/prompt-behavior-check.ts [label] [--only id1,id2] [--limit N]
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { config } from 'dotenv'
config({ path: '.env.local' })
import Anthropic from '@anthropic-ai/sdk'
import { runChatTurnOpenAIPrimary } from '../../src/lib/chat/agent-openai'

const PHASE_TIMEOUT_MS = positiveIntEnv('EVAL_PROMPT_BEHAVIOR_PHASE_TIMEOUT_MS', 300_000)
const ABSTAIN_RE = /(no\s+(?:hay|existe|se\s+(?:han?\s+)?encontr|dispongo|tengo|consta|encuentro)|sin\s+evidencia|no\s+evidence|there\s+(?:is|was)\s+no\s+(?:specific\s+)?(?:documentary\s+)?evidence|(?:do|did)\s+not\s+find(?:\s+\w+){0,4}\s+evidence|(?:do|did)\s+not\s+find(?:\s+\w+){0,10}\s+(?:policy|treasury|hedging)|found\s+no\s+(?:documentary\s+)?evidence|no\s+documentary\s+evidence|not\s+found|no\s+relevant|cannot\s+find|has\s+been\s+found|no\s+he\s+(?:encontrado|hallado)|no\s+.{0,90}(?:exists?|appears?|is\s+(?:found|present)|encontrad\w*)\s+in\s+the\s+.{0,25}corpus|no\s+.{0,30}(?:en\s+el\s+corpus|documental))/i
const CLARIFY_RE = /(qué\s+proyecto|which\s+project|podrías\s+(?:aclarar|especificar|indicar|concretar)|necesito\s+(?:más|un poco más)|could\s+you\s+(?:clarify|specify)|a\s+qué\s+te\s+refieres|te\s+refieres\s+(?:a|al|a\s+la|a\s+los|a\s+las)|aclarar|especific)/i

type Expect = { searched?: boolean; abstained?: boolean; clarifies?: boolean; includes?: string[]; tool?: string }
type Case = { id: string; q: string; expect: Expect }

const CASES: Case[] = [
  // FIND cases: positive-content signal (searched + key term present). NOT the abstain regex — a rich
  // answer that finds the main thing but honestly notes a missing sub-detail (e.g. "no consta el plazo")
  // would trip an abstain regex; the robust signal is "did it surface the key fact".
  { id: 'buenavista-find', q: '¿Cómo es la financiación de buenvista?', expect: { searched: true, includes: ['Buenavista', 'participativo'] } },
  { id: 'pacto-socios-doc', q: '¿En qué fecha se elevó a público el pacto de socios de Madrid Playa Surf?', expect: { searched: true, includes: ['2023'] } },
  { id: 'bhx-loan-doc', q: 'Who is the lender and borrower in the signed Birmingham (Wave Park) loan agreement?', expect: { searched: true } },
  // ABSTAIN cases: the answer's core IS a denial of the whole query.
  { id: 'sukarrieta-abstain', q: '¿Cómo es la financiación del prestamista Sukarrieta en el proyecto de Madrid?', expect: { searched: true, abstained: true } },
  { id: 'zero-ski-abstain', q: '¿Qué planes tiene Gemswell para construir una estación de esquí en los Alpes suizos?', expect: { abstained: true } },
  { id: 'zero-crypto-abstain', q: "What is Gemswell's cryptocurrency treasury and hedging policy?", expect: { abstained: true } },
  // CLARIFY: vague, no named term.
  { id: 'ambiguous-clarify', q: '¿Cuánto cuesta?', expect: { clarifies: true } },
]

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag)
  return i >= 0 ? process.argv[i + 1] : undefined
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
  console.log(JSON.stringify({ eval: 'prompt-behavior', event, at: new Date().toISOString(), ...fields }))
}

function normalizeBehaviorText(text: string): string {
  return text.replace(/[*_`]/g, '')
}

export function isAbstentionText(text: string): boolean {
  return ABSTAIN_RE.test(normalizeBehaviorText(text))
}

async function withTimeout<T>(
  run: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  const ac = new AbortController()
  let timeout: NodeJS.Timeout | null = null
  const timer = new Promise<T>((_, reject) => {
    timeout = setTimeout(() => {
      ac.abort()
      reject(new Error(`${label} timed out after ${timeoutMs}ms`))
    }, timeoutMs)
    timeout.unref?.()
  })
  try {
    return await Promise.race([run(ac.signal), timer])
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

async function run(c: Case, anthropic: Anthropic, signal: AbortSignal) {
  const r = await runChatTurnOpenAIPrimary(anthropic, c.q, { signal })
  const tools = r.toolCalls.map(t => t.name)
  const searched = tools.includes('search_documents')
  const behaviorText = normalizeBehaviorText(r.answer)
  const abstained = isAbstentionText(r.answer)
  const clarifies = CLARIFY_RE.test(behaviorText)
  const ans = behaviorText.toLowerCase()
  const checks: string[] = []
  const fail: string[] = []
  if (c.expect.searched !== undefined) (c.expect.searched === searched ? checks : fail).push(`searched=${searched}`)
  if (c.expect.abstained !== undefined) (c.expect.abstained === abstained ? checks : fail).push(`abstained=${abstained}`)
  if (c.expect.clarifies !== undefined) (c.expect.clarifies === clarifies ? checks : fail).push(`clarifies=${clarifies}`)
  if (c.expect.tool) (tools.includes(c.expect.tool) ? checks : fail).push(`tool:${c.expect.tool}`)
  for (const inc of c.expect.includes ?? []) (ans.includes(inc.toLowerCase()) ? checks : fail).push(`includes:${inc}`)
  return { id: c.id, pass: fail.length === 0, tools, sources: r.sources.length, checks, fail, snippet: r.answer.slice(0, 120).replace(/\n/g, ' ') }
}

async function main() {
  const label = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'run'
  const only = arg('--only')?.split(',').map((s) => s.trim())
  const limit = arg('--limit') ? Number(arg('--limit')) : undefined
  let cases = CASES
  if (only) cases = cases.filter((c) => only.includes(c.id))
  if (limit) cases = cases.slice(0, limit)

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
  console.log(`\n=== prompt behavior check [${label}] — ${cases.length} cases, phase_timeout=${PHASE_TIMEOUT_MS}ms ===`)
  let pass = 0
  const rows = []
  for (const c of cases) {
    const t0 = Date.now()
    logProgress('case_start', { id: c.id, expect: c.expect })
    try {
      const r = await withTimeout((signal) => run(c, anthropic, signal), PHASE_TIMEOUT_MS, `${c.id} prompt behavior`)
      if (r.pass) pass++
      console.log(`${r.pass ? 'PASS' : 'FAIL'} ${r.id} | tools=${JSON.stringify(r.tools)} src=${r.sources}${r.fail.length ? ' | FAILED: ' + r.fail.join(',') : ''}`)
      if (!r.pass) console.log(`     snippet: ${r.snippet}`)
      rows.push({ ...r, ms: Date.now() - t0 })
      logProgress('case_done', { id: c.id, ms: Date.now() - t0, pass: r.pass, tools: r.tools, sources: r.sources, failed: r.fail })
    } catch (e) {
      const message = errorMessage(e)
      console.log(`ERROR ${c.id}: ${message}`)
      rows.push({ id: c.id, pass: false, error: message, ms: Date.now() - t0 })
      logProgress('case_error', { id: c.id, ms: Date.now() - t0, error: message })
    }
  }

  console.log(`\n[${label}] ${pass}/${cases.length} passed`)
  const outDir = resolve(process.cwd(), 'scripts/eval/results')
  mkdirSync(outDir, { recursive: true })
  const outPath = resolve(outDir, `prompt-behavior-${label}.json`)
  writeFileSync(outPath, JSON.stringify({ label, at: new Date().toISOString(), rows }, null, 2))
  console.log(`Wrote ${outPath}\n`)
  if (pass !== cases.length && process.env.EVAL_PROMPT_BEHAVIOR_STRICT !== 'false') process.exitCode = 1
}
if (process.env.VITEST !== 'true') {
  main().catch(e => { console.error(e); process.exit(1) })
}
