# Maximum documentary-chat quality — operational definition (SSOT)

This is the yardstick the remediation program optimises against. It is a **number-backed, regression-gated
state, not a vibe.** Machine-readable targets live in [`targets.ts`](./targets.ts) (and are asserted by
`__tests__/targets.test.ts`); the roadmap is `docs/plan-saneamiento-chat-maxima-calidad-2026-06-07.md`.

## How it is measured

Two tiers, both over the **real production path** (no mocks):

- **Tier-A — retrieval** (`run-retrieval.ts`): every golden question → the real `retrieveDocuments`
  (`match_chunks` + `keyword_search_chunks` via PostgREST → Cohere rerank → trust-tier sort). Measures
  recall@{1,3,5,10}, MRR, and — once cases are **id-pinned** — precision@5. Cheap/fast (Gemini+Cohere).
- **Tier-B — answers** (`run-answers.ts`): every question → the real `runChatTurn` (agent loop + Opus
  verifier), scored by an Opus LLM-judge (faithfulness, citation_precision, completeness, behavior_correct)
  plus deterministic signals (cited-expected-doc, must_contain, expected-tool, abstain). Expensive/slow (Opus×2/q).

**Honest ground truth (do this first):** retrieval recall is scored by `ground_truth.titles` substring today —
optimistic and precision-blind. Run `resolve-ids.ts` and pin `ground_truth.expected_doc_ids` (canonical UUIDs,
human-chosen, **excluding superseded/duplicates**); then scoring switches to id-match and `precision@5` lights up.

## The bar (reached when ALL hold simultaneously)

The **documentary bucket is the flat laggard** (baseline 2026-06-07: judge pass 60%, F 4.30, C 4.20, recall@5 60%).
Targets:

| Dimension | Baseline | Target | Gate |
|---|---|---|---|
| documentary judge pass-rate | 60% | **≥ 80%** | soft |
| documentary faithfulness / citation / completeness | 4.30 / 4.20 / 4.40 | **≥ 4.5** each | soft |
| documentary recall@5 / recall@10 / MRR | 60% / 60% / 0.475 | **≥ 80% / ≥ 90% / ≥ 0.60** | soft |
| documentary precision@5 | (unmeasured) | **≥ 0.55** | soft (needs pinning) |
| documentary grounding (numeric tokens present in a source/tool) | (unmeasured) | **≥ 0.95** | **hard** |
| structured pass-rate / behavior_correct | 86% / 100% | **hold ≥ 86% / = 100%** | soft / **hard** |
| abstain & ambiguous behavior_correct (no fabrication) | — / 100% | **= 100%** | **hard** |
| governance G1/G2/G4 invariants | not asserted | **all pass** | **hard** |

**Hard gates fail the build.** Soft gates warn-or-fail by severity and may not drop more than `REGRESSION_BAND`
(5pts) below the committed baseline. Governance invariants (Fase-7 `run-governance.ts`, deterministic):
**G1** superseded/rejected never cited · **G2** unreviewed-used ⇒ disclosed · **G4** lane outage ⇒ outage message,
not a governance/no-docs message.

## Definition of done (the program is "maximum quality")

`ws1-final` beats the frozen `ws1-base` on documentary F/C/recall **with zero regression** on
structured/abstain/ambiguous; all hard gates green; the CI eval-gate (`gate.ts`) is wired and a deliberate
regression turns it red naming the failing metric.
