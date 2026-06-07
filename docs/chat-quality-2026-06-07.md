# Chat documental — quality pass (2026-06-07)

Goal: raise `/chat` to a level where a CFO trusts every answer and citation — measured with evidence, not vibes.

## Method — evaluation harness (`scripts/eval/`)
Two tiers, both exercising the **real production pipeline** against the **live client path** (supabase-js/PostgREST → Gemini embed → `match_chunks` + `keyword_search_chunks` → Cohere rerank → trust-tier sort → Claude agent loop → Opus verifier):

- **Tier-A `run-retrieval.ts`** — recall@k / MRR / pool diagnostics / latency / cross-vs-scoped, via the shared `src/lib/rag/retrieve.ts` (the exact function `/api/chat` calls).
- **Tier-B `run-answers.ts`** — full `runChatTurn` + an Opus LLM-judge (faithfulness, citation precision, completeness, behaviour), cross-checked with deterministic signals.
- `golden.json` — 22 ground-truthed questions (legal, funding, board, financial statements, cross-project, multilingual, structured, contradictions, zero-result, ambiguous, all-common-term regression guard).

Run: `npx tsx scripts/eval/run-retrieval.ts <label>` / `npx tsx scripts/eval/run-answers.ts <label>`.

## Before → after (measured)

| Metric | Before | After |
|---|---|---|
| Retrieval latency (avg) | 8,729 ms | **1,580 ms** |
| Keyword results / real question | 0 (silent timeout) | **15** |
| Tier-A recall@10 (documentary, cross) | 60% | 60% |
| Faithfulness (Opus judge, blended) | 4.00 | 4.48 |
| Citation precision (blended) | 3.71 | 4.52 |
| Structured-question pass | 57% | 86% |
| Ambiguous-question pass | 50% | 100% |

**Honest caveat on the blended Tier-B numbers** (surfaced by an eval-soundness review): the documentary bucket — the only one judged on an *unchanged* rubric — was **flat** (faithfulness 4.40→4.30, citation 4.10→4.20). The blended lift comes from the structured + ambiguous buckets, which reflect (a) genuine product wins — the new `get_contradictions` tool and ambiguity handling — and (b) a fair measurement correction (structured tool results now count as evidence; `source_count=0` is normal). So: the **retrieval/latency wins are large and real**; documentary answer quality was already high and stayed high; the structured gains are part real, part measurement-definition.

## Root causes found by live measurement + fixed

1. **Keyword lane silently dead** — `keyword_search_chunks` OR-combined `plainto('spanish')`+`plainto('english')`; the English config kept Spanish stopwords → the tsquery matched 62% of the corpus → `ts_rank_cd` >8s → killed by the `authenticator` 8s `statement_timeout` on the PostgREST path → swallowed → `[]`. The chat had been **vector-only**. → `sql/016` (df-aware term selection + `rag_term_df`) + `sql/018` (AND-fallback + capped OR for all-common-term queries). Latency 8.7s→1.6s; keyword 0→15.
2. **Project-scoping defect** — KLP (Kelpa HoldCo) holds MAD/BHX shareholder/loan docs, PHILAE = fund, GVF = group, but the tool enum was `MAD|BHX` → a "Madrid" query hard-filtered out the authoritative KLP doc. → corpus entity taxonomy in the system prompt + widened `search_documents`/`get_portfolio_context` enum; structured tools keep the MAD/BHX-only check.
3. **Contradictions invisible** — `get_capex_summary` returned the contested €103.21M (an open registered contradiction vs €57.13M UW budget) with no warning. → new `get_contradictions` tool + a rule to disclose conflicts on any CapEx/funding total.
4. **Ambiguity / over-stripping verifier** — vague queries got a giant unverified report; the verifier (seeing only 220-char previews) deleted grounded detail. → ambiguity-clarification rule + verifier told previews are truncated and structured tool results are first-class evidence.

## Architecture
Behavior-preserving extraction: retrieval core → `src/lib/rag/retrieve.ts`; agent machinery → `src/lib/chat/agent.ts`; `route.ts` is now a thin SSE + persistence wrapper. This made the harness measure the exact production path.

## Adversarial review (Codex + 3-agent workflow + standalone eval reviewer)
All findings triaged + fixed: rag_term_df RLS/grant consistency + filtered df (`sql/017`); the df-fallback all-common timeout (`sql/018`, HIGH); the judge now sees structured tool payloads; ground-truth tightening. The extraction was confirmed behavior-preserving with no weakened trust-boundary guarantees (verifier gate, injection boundary, rejected-source filtering, persistence ownership all intact).

## DB migrations (all applied live, reversible)
- `sql/016` keyword df-selectivity + `rag_term_df` — rollback `sql/rollback/016_rollback.sql`
- `sql/017` rag_term_df RLS + filtered df — rollback `sql/rollback/017_rollback.sql`
- `sql/018` keyword AND-fallback + capped OR — rollback `sql/rollback/018_rollback.sql`
- Refresh `rag_term_df` after a bulk ingest (re-run the `ts_stat` insert in `sql/018`'s population query).

## Known residuals (not blocking)
- `bhx-loan-lender`: the model lands on KLP intercompany loans instead of the VSORE senior loan (hard disambiguation; both are valid loan docs).
- `mad-dec-capitalcall`: over-broad cross-entity search can dilute citations for a clearly project-scoped board doc.
- 5,496 legacy docs have no Storage artifact → citation deep-links open the gestor ficha, not the file (backfill blocked: original bytes not in Storage).
