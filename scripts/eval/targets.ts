// scripts/eval/targets.ts — machine-readable SSOT for "maximum documentary-chat quality".
//
// This is the yardstick the whole remediation program optimises against (see scripts/eval/QUALITY.md
// for prose, and docs/plan-saneamiento-chat-maxima-calidad-2026-06-07.md for the roadmap). Consumed by
// the Fase-7 gate runner (scripts/eval/gate.ts) and by targets.test.ts. Baselines are the 2026-06-07
// pre-remediation freeze (answers-final.json / retrieval-v018.json). `current: null` = not yet measured.

export type Gate = 'hard' | 'soft'
export type Bucket = 'documentary' | 'structured' | 'abstain' | 'ambiguous' | 'governance'

export type MetricTarget = {
  metric: string // dotted: `<bucket>.<name>`
  bucket: Bucket
  current: number | null // baseline value (2026-06-07), null if unmeasured
  target: number
  unit: 'rate' | 'score_1_5' | 'ratio' | 'bool'
  gate: Gate // hard = fails the build; soft = warn/fail by severity
  higherIsBetter: boolean
  howMeasured: string
}

/** A soft metric may not drop more than this (fraction) below the committed baseline without failing. */
export const REGRESSION_BAND = 0.05

export const TARGETS: MetricTarget[] = [
  // ── Documentary bucket — the FLAT laggard; the headline targets of the whole plan ──
  { metric: 'documentary.judge_pass_rate', bucket: 'documentary', current: 0.60, target: 0.80, unit: 'rate', gate: 'soft', higherIsBetter: true, howMeasured: 'run-answers.ts: fraction of documentary rows with verdict=pass' },
  { metric: 'documentary.faithfulness', bucket: 'documentary', current: 4.30, target: 4.5, unit: 'score_1_5', gate: 'soft', higherIsBetter: true, howMeasured: 'run-answers.ts Opus judge: faithfulness 1-5' },
  { metric: 'documentary.citation_precision', bucket: 'documentary', current: 4.20, target: 4.5, unit: 'score_1_5', gate: 'soft', higherIsBetter: true, howMeasured: 'run-answers.ts Opus judge: citation_precision 1-5' },
  { metric: 'documentary.completeness', bucket: 'documentary', current: 4.40, target: 4.5, unit: 'score_1_5', gate: 'soft', higherIsBetter: true, howMeasured: 'run-answers.ts Opus judge: completeness 1-5' },
  { metric: 'documentary.recall_at_5', bucket: 'documentary', current: 0.60, target: 0.80, unit: 'rate', gate: 'soft', higherIsBetter: true, howMeasured: 'run-retrieval.ts recall@5 (cross), by expected_doc_ids when pinned else title' },
  { metric: 'documentary.recall_at_10', bucket: 'documentary', current: 0.60, target: 0.90, unit: 'rate', gate: 'soft', higherIsBetter: true, howMeasured: 'run-retrieval.ts recall@10 = right doc reached the capped pool the model sees' },
  { metric: 'documentary.mrr', bucket: 'documentary', current: 0.475, target: 0.60, unit: 'ratio', gate: 'soft', higherIsBetter: true, howMeasured: 'run-retrieval.ts mean(1/rank) over documentary GT questions' },
  { metric: 'documentary.precision_at_5', bucket: 'documentary', current: 0.28, target: 0.40, unit: 'rate', gate: 'soft', higherIsBetter: true, howMeasured: 'run-retrieval.ts precision@5 = relevant-in-top-5 / 5 (standard P@k), over the 10 id-pinned documentary cases. Baseline 0.28 (2026-06-07, ws1-base). Target recalibrated from 0.55: most questions have only 1-2 relevant docs so P@5 is structurally capped; 0.40 is a realistic stretch driven by getting the right doc into the top-5 (RRF/floor).' },
  { metric: 'documentary.grounding', bucket: 'documentary', current: null, target: 0.95, unit: 'rate', gate: 'hard', higherIsBetter: true, howMeasured: 'run-answers.ts deterministic: numeric/date tokens in the answer present verbatim in a source/tool preview (anti-fabrication)' },

  // ── Regression guards — the audit §5 strengths must NOT degrade ──
  { metric: 'structured.judge_pass_rate', bucket: 'structured', current: 0.86, target: 0.86, unit: 'rate', gate: 'soft', higherIsBetter: true, howMeasured: 'run-answers.ts structured pass-rate (hold)' },
  { metric: 'structured.behavior_correct', bucket: 'structured', current: 1.0, target: 1.0, unit: 'rate', gate: 'hard', higherIsBetter: true, howMeasured: 'structured rows call the right structured tool, NOT search_documents' },
  { metric: 'abstain.behavior_correct', bucket: 'abstain', current: null, target: 1.0, unit: 'rate', gate: 'hard', higherIsBetter: true, howMeasured: 'abstain rows say no-evidence and do NOT fabricate' },
  { metric: 'ambiguous.behavior_correct', bucket: 'ambiguous', current: 1.0, target: 1.0, unit: 'rate', gate: 'hard', higherIsBetter: true, howMeasured: 'ambiguous rows ask to clarify instead of guessing' },

  // ── Governance invariants — binary HARD gates (Fase-7 run-governance.ts, deterministic, no LLM judge) ──
  { metric: 'governance.superseded_never_cited', bucket: 'governance', current: null, target: 1.0, unit: 'bool', gate: 'hard', higherIsBetter: true, howMeasured: 'run-governance.ts G1: no cited source is missing metadata or has lifecycle=superseded, status=retired, review_status=rejected, classification_source=agent_rejected' },
  { metric: 'governance.unreviewed_disclosed', bucket: 'governance', current: null, target: 1.0, unit: 'bool', gate: 'hard', higherIsBetter: true, howMeasured: 'run-governance.ts G2: cited needs_review/pending/unreviewed sources require explicit disclosure in the answer' },
  { metric: 'governance.outage_not_governance', bucket: 'governance', current: null, target: 1.0, unit: 'bool', gate: 'hard', higherIsBetter: true, howMeasured: 'G4: forced lane failure (RAG_FORCE_*_FAIL) => outage message, never a governance/no-docs message' },
]

export function targetFor(metric: string): MetricTarget | undefined {
  return TARGETS.find((t) => t.metric === metric)
}

export const HARD_GATES = TARGETS.filter((t) => t.gate === 'hard')
export const SOFT_GATES = TARGETS.filter((t) => t.gate === 'soft')
