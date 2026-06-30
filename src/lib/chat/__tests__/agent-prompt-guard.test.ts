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
    expect(src).toMatch(/named-term ABSENCE check/i)
    expect(src).toMatch(/Do NOT summarize substitute lenders/i)
    expect(src).toMatch(/Out-of-scope \/ zero-result abstentions must still run the required search_documents call first/i)
    expect(src).toMatch(/Do NOT use tangential chunks to educate the user/i)
  })

  it('pins Birmingham signed-loan lender/borrower answers to the VSORE/WPH agreement', () => {
    expect(src).toMatch(/Birmingham signed-loan lender\/borrower questions/i)
    expect(src).toMatch(/Loan Agreement_VSORE III/i)
    expect(src).toMatch(/lender = Varia Structured Opportunities Real Estate III/i)
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

  it('keeps the ETP corpus lane available to documentary tools', () => {
    expect(src).toMatch(/MAD, BHX, KLP, PHILAE, GVF, ETP/)
    expect(src).toMatch(/Enea Tech Platform.*ETP/i)
    expect(src).toMatch(/ALLOWED_PROJECTS = new Set\(\['MAD', 'BHX', 'KLP', 'PHILAE', 'GVF', 'ETP'\]\)/)
  })

  it('forces unlikely Gemswell factual questions through retrieval before abstaining', () => {
    expect(src).toMatch(/out-of-scope factual question that still names Gemswell/i)
    expect(src).toMatch(/Run search_documents once with the named topic first/i)
    expect(src).toMatch(/merely tangential to the named topic/i)
  })

  it('routes financial-statement balance questions away from bp_model', () => {
    expect(src).toMatch(/Financial-statement questions are documentary/i)
    expect(src).toMatch(/search financial_statements first/i)
    expect(src).toMatch(/MPSCIERREDEF-2025/i)
  })

  it('anchors Buenavista financing conditions to the signed participative-credit contract', () => {
    expect(src).toMatch(/isBuenavistaFinancingConditionsQuery/)
    expect(src).toMatch(/contrato firmado "MPS_Contrato de Credito Participativo \(Buenavista\)_vFF"/i)
    expect(src).toMatch(/No uso el importe de 22 M€/i)
    expect(src).toMatch(/15\.657\.498,18/)
  })

  it('anchors Santander/BBVA bank-cost answers to the signed senior financing contract', () => {
    expect(src).toMatch(/isMadridSeniorBankFinancingCostQuery/)
    expect(src).toMatch(/4140-7692-5542 v 1, Piscina de Olas - Contrato de financiacion \(vfinal\)/i)
    expect(src).toMatch(/EURIBOR \+ 4,00% anual/i)
    expect(src).toMatch(/Banco Santander 50% \/ 15\.500\.000 euros y BBVA 50% \/ 15\.500\.000 euros/i)
  })

  it('keeps legal document-location answers scoped to titles and locations', () => {
    expect(src).toMatch(/LEGAL DOCUMENT-LOCATION questions/i)
    expect(src).toMatch(/answer ONLY with the document title, project\/entity lane, doc type/i)
    expect(src).toMatch(/Do NOT add dates, signatories, company structure/i)
  })

  it('lists all governed legal-location documents for pactos and poderes', () => {
    expect(src).toMatch(/29\.06\.2023\. Escritura elevacion a publico Pacto de Socios MPS/i)
    expect(src).toMatch(/PERSONAS APODERADAS\.docx/i)
    expect(src).toMatch(/Acta PoA.s GEMSWELL\.docx/i)
    expect(src).toMatch(/20251203_PoA Gemswell Ventures 118 account\.docx\.pdf/i)
  })

  it('answers the December 2024 capital call with material comments', () => {
    expect(src).toMatch(/capital call de diciembre se planteaba por 3\.000\.000 euros/i)
    expect(src).toMatch(/Acciona, WaveGarden e ICIO/i)
    expect(src).toMatch(/25% del socio saliente/i)
  })

  it('forces SH01 and Companies House search for BHX company-number cap-call questions', () => {
    expect(src).toMatch(/Birmingham company-number\/capital-call questions/i)
    expect(src).toMatch(/SH01.*Companies House.*company number/i)
    expect(src).toMatch(/Do not rely only on capital-call memo chunks/i)
    expect(src).toMatch(/run a second targeted search_documents query/i)
  })

  it('forces follow-up gap checks for separate fee letters and CAP documents through fresh searches', () => {
    expect(src).toMatch(/FOLLOW-UP DOCUMENTARY GAP CHECKS/i)
    expect(src).toMatch(/fee letters, commission letters, side letters, annexes, CAP\/hedging contracts/i)
    expect(src).toMatch(/run separate search_documents calls for each missing document family/i)
    expect(src).toMatch(/comision de estructuracion/i)
    expect(src).toMatch(/contrato de cobertura CAP/i)
    expect(src).toMatch(/Do not infer absence merely because the primary contract says amounts are in separate letters/i)
  })
})
