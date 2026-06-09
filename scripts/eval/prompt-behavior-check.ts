// Fast, deterministic behavioral gate for SYSTEM_PROMPT changes (complements the heavier, judge-based
// eval:answers). Runs the real chat agent (runChatTurn = loop + verifier) over the cases most sensitive
// to prompt edits and asserts behavioral signals — does it search? abstain? clarify? mention the key
// fact? — without the Opus-judge variance. Use it before/after each prompt increment to catch regressions.
//
// Usage: npx tsx scripts/eval/prompt-behavior-check.ts [label]
import { config } from 'dotenv'
config({ path: '.env.local' })
import Anthropic from '@anthropic-ai/sdk'
import { runChatTurn } from '../../src/lib/chat/agent'

const ABSTAIN_RE = /(no\s+(?:hay|existe|se\s+(?:han?\s+)?encontr|dispongo|tengo|consta|encuentro)|sin\s+evidencia|not\s+found|no\s+relevant|cannot\s+find|has\s+been\s+found|no\s+he\s+(?:encontrado|hallado)|no\s+.{0,90}(?:exists?|appears?|is\s+(?:found|present)|encontrad\w*)\s+in\s+the\s+.{0,25}corpus|no\s+.{0,30}(?:en\s+el\s+corpus|documental))/i
const CLARIFY_RE = /(qué\s+proyecto|which\s+project|podrías\s+(?:aclarar|especificar|indicar|concretar)|necesito\s+(?:más|un poco más)|could\s+you\s+(?:clarify|specify)|a\s+qué\s+te\s+refieres|aclarar|especific)/i

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

async function run(c: Case, anthropic: Anthropic) {
  const r = await runChatTurn(anthropic, c.q)
  const tools = r.toolCalls.map(t => t.name)
  const searched = tools.includes('search_documents')
  const abstained = ABSTAIN_RE.test(r.answer)
  const clarifies = CLARIFY_RE.test(r.answer)
  const ans = r.answer.toLowerCase()
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
  const label = process.argv[2] || 'run'
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
  console.log(`\n=== prompt behavior check [${label}] — ${CASES.length} cases ===`)
  let pass = 0
  for (const c of CASES) {
    try {
      const r = await run(c, anthropic)
      if (r.pass) pass++
      console.log(`${r.pass ? 'PASS' : 'FAIL'} ${r.id} | tools=${JSON.stringify(r.tools)} src=${r.sources}${r.fail.length ? ' | FAILED: ' + r.fail.join(',') : ''}`)
      if (!r.pass) console.log(`     snippet: ${r.snippet}`)
    } catch (e) {
      console.log(`ERROR ${c.id}: ${e instanceof Error ? e.message : e}`)
    }
  }
  console.log(`\n[${label}] ${pass}/${CASES.length} passed`)
}
main().catch(e => { console.error(e); process.exit(1) })
