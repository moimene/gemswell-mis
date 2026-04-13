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
1. **Layer 1 — Corpus**: `rag_documents`, `rag_chunks` (102K+ chunks). Fact tables: `fct_capex_snapshot`, `fct_funding_snapshot`, `fct_cash_13w`.
2. **Layer 2 — RAG**: `/api/chat` — vector search → Cohere rerank → GPT-4o. Project-scoped.
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

## Open items (as of 2026-04-13)
- MAD capex contradiction (€103M vs €57M) — open, awaiting CFO decision
- BHX corpus not yet ingested
- LlamaParse credits pending
