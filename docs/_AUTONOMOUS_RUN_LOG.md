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

## PENDIENTE USUARIO (action needs a net the agent can't mount, or needs a secret/dashboard)
| Item | Why pending | Exact apply + verify + rollback |
|------|-------------|----------------------------------|
| Migrations `sql/020`–`028` | branch-probe net not mountable autonomously (see decision above) | runbook per-migration appended below as each is authored |
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

