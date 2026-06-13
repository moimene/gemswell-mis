import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'

// Deterministic guard for the Buenavista tool-orchestration fix (2026-06-09): the agent must never deny
// that a named entity/lender/instrument exists based on get_portfolio_context alone — it must
// search_documents first, and only abstain AFTER an empty search. We assert the rule is present in the
// system prompt source (reading the file avoids importing agent.ts's server-only deps into the test).
// The live behavior is covered by golden case `mad-buenavista-lender` (npm run eval:answers).
const src = readFileSync(new URL('../agent.ts', import.meta.url), 'utf8')

describe('agent system prompt — entity-existence orchestration guard', () => {
  it('forbids concluding non-existence from get_portfolio_context (scoped to named terms)', () => {
    expect(src).toMatch(/When the user names a specific term/i)
    expect(src).toMatch(/NEVER conclude it "does not exist"/i)
    expect(src).toMatch(/orientation dictionary of TOP-LEVEL/i)
  })

  it('requires search_documents before saying nothing was found', () => {
    expect(src).toMatch(/you MUST run search_documents for that term/i)
  })

  it('preserves abstain — only after an empty search, and not from low-relevance chunks', () => {
    expect(src).toMatch(/Only abstain AFTER search_documents/i)
    expect(src).toMatch(/do NOT manufacture an answer from low-relevance chunks/i)
  })

  // Council safe-subset (2026-06-09, eval-gated 0-regression): evidence-discipline + orchestration rules.
  it('closes the evidence escape clause (no independent knowledge of Gemswell)', () => {
    expect(src).toMatch(/NO independent knowledge of Gemswell/i)
    expect(src).toMatch(/Use a tool before answering ANY factual question about Gemswell/i)
  })

  it('subordinates style/depth to evidence discipline', () => {
    expect(src).toMatch(/Evidence discipline OUTRANKS/i)
  })

  it('requires an auditable coverage statement on abstention', () => {
    expect(src).toMatch(/disclose your COVERAGE so the abstention is auditable/i)
  })

  it('has the bilingual alias list (compensates tsvector simple, no stemming)', () => {
    expect(src).toMatch(/pacto de socios.*shareholders agreement/i)
    expect(src).toMatch(/the keyword lane has no stemming/i)
  })

  it('generalizes the contradiction check beyond totals', () => {
    expect(src).toMatch(/funding gap, sufficiency\/headroom conclusion, facility size, or a drawn-vs-available/i)
  })

  it('distinguishes injection from legitimate contractual language', () => {
    expect(src).toMatch(/legitimate CONTRACTUAL\/CORPORATE language/i)
    expect(src).toMatch(/supersedes all prior agreements/i)
  })

  it('centralizes strict grounding prompt text for HTTP and eval paths', () => {
    expect(src).toMatch(/systemPromptForGrounding/)
    expect(src).toMatch(/official_only: search_documents returns only source-of-record evidence/)
    expect(src).toMatch(/If strict grounding returns no evidence, abstain/)
  })
})
