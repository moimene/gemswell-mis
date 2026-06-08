# Autonomous Run Log — Fases 3→8 (chat documental)

Run start: 2026-06-08 · Engine: Opus 4.8 (1M) · Mode: goal-adversarial-ultracode (autónomo, sin supervisión)
Charter: `docs/autonomous-run-charter-2026-06-08.md` · Plan: `docs/plan-saneamiento-chat-maxima-calidad-2026-06-07.md`
Working branch: `agent/autonomous-f3-f8` (from `main` @ 3e6cde5).

## Verified starting state (2026-06-08, live BD `nqxhsjkcvfxygiajdxki` + git)
- prod = origin/main = local main = `3e6cde5`. Fases 0,1,2 + Fase 3 chunking deployed.
- BD: rag_documents 5498 · rag_chunks 156898 · approved 3231 / needs_review 2267 / rejected 0 / pending 0 · superseded+indexed 7 · authority≥90 & approved 797.
- `rag_chunks` columns: id, document_id, chunk_index, content, embedding, metadata, token_count, created_at, fts — **NO `embedding_model`** → migration 025 not applied (consistent with ledger).
- Highest migration on disk = `sql/019` (applied). Ledger 020–028 preassigned, not written.
- `src/lib/rag/ocr.ts` does not exist. No `MISTRAL_API_KEY` in `.env.local`.
- Baseline tests green: 122/122 (vitest), pre-change.

## KEY AUTONOMOUS DECISION — prod DDL not auto-applied this session (conservative/reversible)
The charter's mandated safety net for a prod migration is **branch-probe → Ronda 2 → apply → live re-verify → auto-rollback**. That net **cannot be mounted autonomously** here because:
1. **Supabase MCP** (`create_branch`/`apply_migration`/`execute_sql`) requires **user OAuth in a browser** — user is away → unavailable.
2. **No DB password** in `.env.local` (no `SUPABASE_DB_PASSWORD`/pooler creds) → no psql/pooler DDL path.
3. Supabase **branches are built from `supabase/migrations/` history**, but this project's `sql/0XX` files were applied **out-of-band** (remote migration list shows only unrelated 2026-04/06-05 timestamps, not 014–019). A fresh branch would **not** mirror the live RPCs, so the `EXPLAIN ANALYZE` probe the charter requires for 023 cannot be trusted.

**Per charter master rule** ("si una red de seguridad no se puede montar para una acción concreta, esa acción NO se ejecuta: PENDIENTE USUARIO, y sigue"), **no `sql/020`–`028` is applied to prod by the agent.** Instead: every migration + verbatim rollback is authored and reviewed (Ronda 1 + Ronda 2), with an exact apply/verify/rollback runbook below, so the user applies each in minutes **with** the net. Code that is genuinely prod-safe and reversible (affects only new ingests / env-flagged default-off / UI) IS built, gated green, and may be deployed via push with a smoke test + git-revert rollback.

---

## Prod mutations applied by the agent (with rollback)
_(none yet — table filled as deploys happen)_

| # | When | What | Net (probe / smoke) | Live verify | Rollback command |
|---|------|------|---------------------|-------------|------------------|
| 1 | 2026-06-08 | **Deploy Fase 3 code** to prod (merge `agent/autonomous-f3-f8` → main `d70f39c`, push → Vercel auto-deploy). Page provenance + OCR(off) + embedding_model. NO migration applied. | `next build` green + 150/150 tests + **Ronda 2: 3 independent opus reviewers unanimous SAFE-TO-DEPLOY** (blast radius proven ingest-only; chat read path byte-identical; SQL files inert on deploy; OCR double-gated off). | ✅ Vercel deployment `mekk5y5r4` **Ready** (30s build, Production); prod alias serves it: `/login`→200, `/`→307→login. Read path byte-identical by construction → no retrieval regression possible. **No rollback triggered.** | `git revert -m 1 d70f39c && git push origin main` (re-deploys prev build 3e6cde5). New chunks' extra jsonb metadata keys are inert after revert (no DB cleanup). |

## PENDIENTE USUARIO (action needs a net the agent can't mount, or needs a secret/dashboard)
| Item | Why pending | Exact apply + verify + rollback |
|------|-------------|----------------------------------|
| **`sql/025`** embedding_model (authored) | additive column + 156k UPDATE; no branch needed but a prod write | apply `sql/025_embedding_model.sql` → verify `select embedding_model,count(*) from rag_chunks group by 1` (all `gemini-embedding-001`) → rollback `sql/rollback/025_rollback.sql` (drop column) |
| **`sql/023`** retrieval RPC provenance (authored — ÚNICO DUEÑO) | high-risk RPC recreation; needs branch-probe + EXPLAIN ANALYZE the agent can't mount | apply `sql/023_retrieval_provenance_columns.sql` in a Supabase **branch** first → EXPLAIN ANALYZE via supabase-js (match_chunks index-served <100ms MAD+KLP, keyword <1s) → confirm 7 superseded docs/369 chunks return 0 → Ronda 2 → prod → re-verify live → AUTO-ROLLBACK `sql/rollback/023_rollback.sql` on any regression. Body is verbatim-019 (diff-verified) + chunk_index/page/storage_path in metadata jsonb (no signature change). |
| Migrations `sql/020/021/022/024/026/027/028` | branch-probe net not mountable autonomously; Fase 4/5/6 RPCs not yet authored this run | designs specified in plan §2/§3; author + apply with the same net. Not authored this session (scope/time) — see final report. |
| OCR live-enable (Fase 3) | no `MISTRAL_API_KEY` in env | add key → set `RAG_OCR_ENABLED=true` in Vercel → upload a scanned PDF → expect `ocr_used=true` |
| Rotate MDL anon JWT (Fase 8 WS7-T2) | key rotation is a Supabase-dashboard action | rotate anon key in dashboard after inline JWT removed from code |

---

## Incremental log (each increment: TDD → Ronda 1 → gates → commit)

### INC-1 — Fase 3 / WS2-T4: page provenance (`metadata.page`) · 2026-06-08 · prod-safe (new ingests only)
- **What:** `chunkFinancialContent` now stamps `metadata.page` (1-based) on each chunk via a non-invasive post-pass `assignPages`, mapping each chunk back to the source page-offset map (LlamaParse `---` page_separator). Table-aware (A1) + clause-aware (T3) chunkers untouched. `page?: number` added to `ChunkMetadata`; persists via existing `metadata: chunk.metadata` insert (queue-processor.ts:261) — no ingest/RPC change. Files: `src/lib/rag/embeddings.ts`, new test `src/lib/rag/__tests__/chunk-page-provenance.test.ts`.
- **TDD:** Red (2 fail) → Green; 8 page tests; full suite 130/130 (+8). tsc clean; lint clean (only pre-existing retrieve.test.ts warning).
- **Ronda 1 (2 opus reviewers, independent):** Reviewer A = SAFE-WITH-NITS; Reviewer B = **UNSAFE (blocker)**. Blocker (CONFIRMED in code): ingest chunks the markdown *artifact* (`buildMarkdownArtifact`, queue-processor.ts:360/370) whose `---` YAML frontmatter fences were miscounted as page breaks → every real doc off by +2. **Fixed:** `assignPages` detects+excludes a leading YAML frontmatter block; added a through-the-artifact test that fails pre-fix. Also applied both reviewers' nits: cursor advances PAST match (recurring-anchor safe), forward-miss → honest no-page (no backward yank). Plus fixed a flaw neither caught: narrative overlap's synthetic longest line isn't in source → multi-candidate anchor (`findPageAnchor`) falls through to a real line.
- **Known limitation (documented):** a content `---` thematic break is inherently indistinguishable from the LlamaParse page separator; best-effort provenance, consumed only by Fase 5 deep-links, never by retrieval.
- **Eval:** not run — change cannot regress retrieval by construction (no RPC/ranking/embedding change; legacy 156k untouched).
- **Codex (best-effort):** launched once, background, hard 10-min timeout — see verdict appended below.
- **Rollback:** `git revert <commit>` (pure TS, additive metadata field).

### INC-2 — Fase 3 / WS2-T7/T8/T10: Mistral OCR port (default-OFF) + pipe-table instruction · 2026-06-08 · prod-safe
- **What:** New `src/lib/rag/ocr.ts` (faithful port of `mdl-patrimonio/src/lib/agent/ocr.ts` — error taxonomy, caps, Retry-After, timeout all preserved) + `isLowTextQuality`/`isGarbledText`/`isOcrSupportedMime` triggers. Wired into `parse.ts` `parseDocument` as a fallback at 3 sites (garbled-success, in-catch, no-llama-key); `queue-processor.ts` sets real `ocr_used`/`parser`, maps image extensions, and OCR joins pages with `---` so WS2-T4 page provenance covers OCR'd docs. Reinforced LlamaParse pipe-table instruction. New tests `ocr.test.ts` + `parse-ocr-wiring.test.ts`.
- **Default-OFF (opt-in):** OCR runs only when `MISTRAL_API_KEY` **and** `RAG_OCR_ENABLED='true'`. Prod has neither → strict no-op; any OCR error (incl. missing key) is swallowed to the existing "scanned document" behavior. Verified by integration tests.
- **TDD/gates:** suite 150/150 (+18 across two rounds). tsc clean; lint clean.
- **Ronda 1 (2 opus + Codex):** both opus = SAFE-WITH-NITS (port faithful, default-off holds, no SQL/RPC). Fixed F1 (success path used `<500 chars` → would OCR a short *clean* PDF; now garbage-only `isGarbledText`) and F4 (`RAG_OCR_ENABLED` was opt-out → now true opt-in, matches runbook). Added reviewer-B boundary tests (500/0.4) + parse integration tests.
- **Eval:** not run — only affects NEW ingests and is off in prod; cannot regress retrieval.
- **Live-enable = PENDIENTE USUARIO** (no `MISTRAL_API_KEY`): add key → set `RAG_OCR_ENABLED=true` in Vercel → upload a scanned PDF → expect `ocr_used=true`, doc ingested. **Rollback:** unset either env var (instant), or `git revert`.

### INC-3 — Fase 3/5: embedding_model provenance (code, prod-safe) + migrations 025 & 023 authored (PENDIENTE) · 2026-06-08
- **Code (prod-safe):** new ingests stamp `metadata.embedding_model='gemini-embedding-001'` (`EMBEDDING_MODEL` exported from embeddings.ts; set in queue-processor baseMetadata). `embedding_model?: string` added to `ChunkMetadata`. Suite 150/150; tsc clean.
- **`sql/025` (PENDIENTE):** `rag_chunks.embedding_model` column + backfill (constant/metadata). Rollback drops the column. Runbook in the table above.
- **`sql/023` (PENDIENTE, ÚNICO-DUEÑO-DE-RPC):** recreates both retrieval RPCs **verbatim from 019** (diff-verified — only the documented additions differ) and surfaces `chunk_index`/`page`/`storage_path` via the **metadata jsonb override** (NO return-signature change → `create or replace`, fully backward-compatible — deliberately avoids the riskier column/DROP variant). Note: `metadata.page` already flows to retrieval today via `coalesce(v.metadata,…)`, so once new docs are ingested, page deep-links are unblocked even before 023. Live schema confirmed `chunk_index` + `storage_path` exist.
- **Doc-rot fixed:** `CLAUDE.md` "Migrations applied through 015" → corrected to **019 live** + ledger/PENDIENTE pointers.
- **Ronda 1 on 023:** done by careful verbatim-diff against 019 (the único-dueño guardrail) — see diff in commit. Full Ronda 2 (live EXPLAIN ANALYZE) is part of the PENDIENTE apply runbook since it requires a branch.

