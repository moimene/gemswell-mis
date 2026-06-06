# Spec C — Chat Retrieval Quality · Implementation & Adversarial-Hardening Outcome

Date: 2026-06-05
Branch: `agent/chat-consolidation-c` (8 commits; merge status below)
Spec: `2026-06-05-chat-consolidation-C-design.md` · Plan: `../plans/2026-06-05-chat-consolidation-c.md`
Builds on: A (corpus gobernado) + B (gestor documental), both merged to `main` (`1914c06`).

## What shipped
Three chat-retrieval-quality fixes (the 4th original item — C2 hardcoded prompt facts — was already neutralized by `5b048af`, confirmed and dropped from scope):

1. **Trust-tier-dominant ranking** (`src/lib/rag/rank.ts`, new + tested). The chat used `relevance×reviewPenalty + authorityBoost` — an *additive* authority boost that let an unreviewed authority-95 chunk outrank an approved one. Replaced with `rankBySourceTrust`: order by **(trust tier desc, approved-ness desc, Cohere relevance desc)**, reusing A/B's `verificationFromGovernance`. needs_review evidence stays retrievable (transparency) but can't outrank equal-or-better-relevance approved/source-of-record evidence.
2. **Dual-language, accent-insensitive, index-backed keyword search** (`sql/012`). `keyword_search_chunks` was recomputing `to_tsvector('simple', content)` inline — no stemming, no `unaccent`, and **never using the GIN index** (seqscan over 156k rows). Also only 32% of `fts` cells were populated (the column was unused). Now: `unaccent` extension, a dual-language `fts` (`to_tsvector('spanish',unaccent(content)) || to_tsvector('english',unaccent(content))`), the RPC uses the GIN-indexed `c.fts`, and **all 156,898 cells were backfilled**. Fixes ES/EN stemming + accents AND the latent 68%-invisible-chunks bug AND the seqscan latency.
3. **Interactive embedding lane** (`src/lib/rag/embeddings.ts`). One global 4s-interval limiter serialized every embed, so a chat query queued behind the bulk ingest backlog. Split into `bulk` (4000ms, ingest unchanged) and `interactive` (50ms, chat query) lanes with independent state.

Minor: `RAG_MATCH_THRESHOLD` (0.18) left as-is — deliberately recall-first; precision is handled downstream by the Cohere reranker + trust-tier ordering. Proper calibration needs a live embedding probe (tuning task, not a correctness issue).

## Migration (applied to `nqxhsjkcvfxygiajdxki`)
- `012 dual_language_fts` — `unaccent` + dual-language `rag_chunks_fts_update` trigger + `keyword_search_chunks` rewritten to use `c.fts`. Then: 156,898-row `fts` backfill (via a temporary `backfill_fts_batch` RPC + `fts_done` marker, GIN index dropped during backfill for speed), then GIN index recreated, and **all backfill scaffolding dropped** (temp RPC + marker column + the now-dead `idx_rag_chunks_fts_simple`).

## Review (ruflo swarm + Claude 2nd pass + Codex)
**Round 1 — ruflo swarm `swarm-1780686942026-gn08gh` (3 opus reviewers) + Claude 2nd pass.** Findings, all addressed:
- **R1 (MED/HIGH):** trust tier didn't truly dominate — `verificationFromGovernance` collapses 62% of the corpus into the `context` tier where `approved`-low-authority and `needs_review` chunks tied and got ordered by raw relevance. **Fixed:** added `approved`-ness as a secondary sort key + regression test.
- **R2 (HIGH security):** the temp `backfill_fts_batch` was `SECURITY DEFINER` + EXECUTE-to-anon (CX-B1 class). **Fixed:** dropped post-backfill (verified gone). Plus the confirmed cleanup gate (recreate GIN index, drop `fts_done`, drop dead `simple` index) — all done. R2 verified the FTS logic CORRECT (||=OR, governance filters preserved exactly, unaccent/index interaction fine, trigger deterministic).
- **R3 (MED):** interactive lane was strict-serial at 250ms (N concurrent queries → N×250ms, could exceed 4s). **Fixed:** lowered to 50ms + added fake-timer tests proving the interactive lane doesn't queue behind a busy bulk lane (the headline invariant was previously untested).
- Low/non-issues (no action): English stopwords in the Spanish tsquery half (no false positives, verified); retry-reordering not FIFO (benign for current callers).

**Round 2 — Codex (gpt-5.5, medium reasoning, scope=diff).** Initially failed 3× (stdin hang; then its own configured MCP servers — Vercel/Supabase — failing auth and stalling startup). Fixed by invoking with `-c 'mcp_servers={}'` (disable the broken MCP) while keeping config's `model="gpt-5.5"` (`--ignore-user-config` had defaulted to the ChatGPT-unsupported `gpt-5.3-codex`). It then found **4 real issues the swarm missed — all fixed** (commit `bce7d72`):
- **CX-C1 (HIGH):** `rankBySourceTrust` ran *after* `rerankChunks(pool, 10)` already cut to Cohere's top-10 → trust only re-ordered, didn't dominate *selection*. Fixed: rerank the full pool (relaxed rerank early-return to `<=1`), trust-rank, then slice 10.
- **CX-C2 (HIGH):** the keyword path didn't pass `filter_doc_type` to the RPC (fetched global top-15 then TS-filtered → doc-type matches outside top-15 lost). Fixed: pass `filter_doc_type` in-query.
- **CX-C3/C4 (MED):** migration 012 wasn't self-contained/replayable (trigger bind + index only in comments) and omitted `public.` qualification. Fixed: bind trigger + ensure index + qualify, idempotent, applied as `fts_self_contained_qualified`.
- Codex found **no** two-lane limiter bug (confirms R3).

## Live verification (self-cleaning, corpus untouched)
- FTS e2e: unaccented Spanish query matches accented content (`climatizacion`→`climatización`), Spanish stems (`auditar`→`auditado`), English stems (`funding`→`funded`), unique-token visibility, governance exclusion (rejected → invisible). All pass. (The first run "failed" by returning 10 real corpus matches for `climatizacion` — itself proof the accent-insensitive Spanish search now works on real data.)
- 53 vitest green; lint + build clean.
- Corpus: 5,498 docs / 156,898 chunks, **0 null fts**, 0 leftover test rows.

## Final state
- Retrieval orders by trust tier then approved-ness then relevance; keyword search is index-backed, dual-language, accent-insensitive; interactive embeds decoupled from bulk ingest.
- No regressions: governance filters (parent-first, status='indexed', exclude rejected/agent_rejected) preserved exactly; chat error-handling fallback (embed fail → keyword-only) intact.

## Still out of scope
- **C1 (auth/RLS)** — the remaining pre-publication blocker (deferred by user direction).
- Embedding/chat model swaps; mass re-parse; ingest adapters.
