@AGENTS.md

# Gemswell MIS — Project Context for Claude Code

## Stack
- Next.js 16.2.3, App Router, all pages are `'use client'` using `useEffect` + `fetch()` (no RSC data fetching)
- Supabase Postgres + pgvector. Server routes use `createApiClient()` from `@/lib/supabase-server`. Client pages use `createClient()` from `@/lib/supabase`
- Tailwind CSS. Utilities: `cn()` from `@/lib/utils`, `formatCompact(value, currency)` for compact EUR/GBP display
- Deployed on Vercel Pro. Push to `main` triggers auto-deploy.

## Key DB conventions
- `rpt_pack` primary key is `pack_id` (NOT `id`)
- `intel_metric_definition` primary key is `id`; FK from candidates uses `metric_id → intel_metric_definition.id`
- `intel_contradiction_alert`: `candidate_a_id` is NOT NULL; `delta_abs` is a **generated column** — never include it in inserts
- `fct_funding_snapshot.instrument_id` has FK → `dim_funding_instrument.instrument_id` — insert dim row first
- `intel_metric_candidate` status lifecycle: `pending_review → accepted | rejected | validation_failed`
- `rpt_pack` status lifecycle: `in_progress → submitted → published`

## Four-layer architecture
1. **Layer 1 — Corpus**: `rag_documents` (5,498 docs), `rag_chunks` (156,898 chunks). Fact tables: `fct_capex_snapshot`, `fct_funding_snapshot`, `fct_cash_13w`.
2. **Layer 2 — RAG**: `/api/chat` — vector search (`match_chunks`, HNSW iterative scan) + bilingual keyword (`keyword_search_chunks`, OR semantics) → Cohere rerank → trust-tier rank → **Claude** (analytical→`claude-opus-4-8`, simple→`claude-sonnet-4-6`) with an Opus verifier pass. **SSE-streamed** (progress channel + verified `final` event). Project-scoped. Retrieved chunks wrapped in an untrusted-content boundary (prompt-injection hardening). (No OpenAI/GPT-4o anywhere; ⚠ Opus 4.x rejects `temperature`.)
3. **Layer 3 — Extraction Engine**: `intel_metric_*` tables. Review UI at `/admin/review`. Pack management at `/admin/packs`.
4. **Layer 4 — Reporting**: `rpt_pack`, CEO dashboard, all domain pages.

## Project IDs
- `MAD` — Madrid Playa Surf (in construction, opening Q1 2027)
- `BHX` — Birmingham (planning phase)
- `KLP` — Kelpa HoldCo, `PHILAE` — fund-level, `GVF` — portfolio-wide

## Scripts
- `scripts/publish-pack.mjs` — Layer 3 → 4 publication pipeline (funding fixes + intel_fact_publication + contradiction alerts)
- `scripts/pack-report.mjs` — submit pack + generate CEO markdown report
- Always `dotenv.config({ path: '.env.local' })` and use `NEXT_PUBLIC_SUPABASE_*` env vars in scripts

## Status (as of 2026-06-07)
- **LIVE in production** at https://gemswell-mis-app.vercel.app — admin-only. **`sql/013` IS applied: corpus is RLS-locked** (anon denied on tables/views/RPCs; admin reads 5,498). This supersedes any earlier "013 not applied / anon-open" note.
- **Chat + Gestor production pass DONE 2026-06-07** (sql/014 + sql/015): chat now SSE-streams; vector retrieval was silently timing out via PostgREST (bind-param LIMIT + generic plan defeated the HNSW index) and is FIXED (`match_chunks` two-stage + HNSW iterative scan); keyword search now OR-semantics; citations deep-link to the gestor; prompt-injection boundary + verifier-gated answers. Gestor: direct-to-Storage upload (`/api/knowledge/upload/sign`), old `/admin/ingest` retired, bulk review, error mapping, doc_type allowlist synced to DB. `ingest_queue` drained (only `done` history remains).
- Corpus distributed across MAD/BHX/KLP/GVF/PHILAE; **fact tables (`fct_capex_*`, `fct_funding_*`) hold MAD + BHX only** — dashboard/funding hardcoding `['MAD','BHX']` is intentional.
- MAD capex contradiction is registered in `intel_contradiction_alert` (current figures ~€57M vs ~€65M) — open, awaiting CFO.
- Migrations applied through **015**. New uploads persist the raw file in Storage (`storage_path`) + record `source_hash`; legacy 5,496 docs have NULL `source_hash` (no original bytes in Storage) so full artifact/hash backfill is deferred backlog.
