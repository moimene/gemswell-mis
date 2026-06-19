@AGENTS.md

# Gemswell MIS — Project Context for Claude Code

Read `MEMORY.md` first for the current operating state. The detailed SharePoint/local RAG ingestion runbook is `docs/sharepoint-rag-ingestion-runbook-2026-06-19.md`.

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
1. **Layer 1 — Corpus**: `rag_documents` (6,895 docs), `rag_chunks` (213,438 chunks) as of 2026-06-19 after the SharePoint ZIP refresh. Fact tables: `fct_capex_snapshot`, `fct_funding_snapshot`, `fct_cash_13w`.
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
- `npm run sharepoint:reconcile` — inventory local SharePoint/OneDrive ZIP exports, diff against `rag_documents`, and optionally upload/enqueue only missing/changed files.
- `npm run sharepoint:ingest-large` — locally parse and ingest files over the normal 50 MB durable-job limit, preserving original-byte `source_hash`; records terminal extraction failures as `rag_documents.status='error'`.
- `npm run ingest:jobs-loop` — local durable queue worker around `processIngestJobs`.
- `npm run ingest:jobs-direct` — targeted recovery for expired `processing` jobs or LlamaParse quota errors using existing Storage objects.
- Always `dotenv.config({ path: '.env.local' })` and use `NEXT_PUBLIC_SUPABASE_*` env vars in scripts

## Status (as of 2026-06-19)
- **LIVE in production** at https://gemswell-mis-app.vercel.app — admin-only. **`sql/013` IS applied: corpus is RLS-locked** (anon denied on tables/views/RPCs; admin reads 6,895 docs as of 2026-06-19). This supersedes any earlier "013 not applied / anon-open" note.
- **Chat + Gestor production pass DONE 2026-06-07** (sql/014 + sql/015): chat now SSE-streams; vector retrieval was silently timing out via PostgREST (bind-param LIMIT + generic plan defeated the HNSW index) and is FIXED (`match_chunks` two-stage + HNSW iterative scan); keyword search now OR-semantics; citations deep-link to the gestor; prompt-injection boundary + verifier-gated answers. Gestor: direct-to-Storage upload (`/api/knowledge/upload/sign`), old `/admin/ingest` retired, bulk review, error mapping, doc_type allowlist synced to DB. `ingest_queue` drained (only `done` history remains).
- **SharePoint ZIP corpus refresh DONE 2026-06-19**: no Graph connector existed and no Azure app credentials were available, so the approved fallback was local ZIP export ingestion. Final reconciliation is `docs/reports/sharepoint-local-reconcile-final-after-ingest.json` / `.csv`: `total=2120`, `enqueueable=0`, no queued/processing jobs. Queue state: `queued=0`, `processing=0`, `done=1366`, `error=24`, `canceled=1`. `knowledge_corpus_health()` is updated in prod by `sql/036_corpus_health_knowledge_ingest_jobs.sql`, so `/admin/documents` and the chat corpus stats read the completed durable queue (`knowledge_ingest_jobs`) rather than legacy `ingest_queue`. Terminal non-ingested source material is limited to `22` paths / `20` unique docs with extraction failures (no text, corrupt PDFs, or encrypted PDFs) plus unsupported non-document formats.
- **Durable ingest job path is now the bulk-ingest default**: `knowledge_ingest_jobs` has 2-hour leases, `.doc` is accepted, and local parser fallback is available with `RAG_LOCAL_PARSE_FALLBACK=force` for PDF/PPTX/DOCX/DOC/TXT/CSV/XLSX/XLS when LlamaParse is exhausted. Do not bypass `ingestBuffer`.
- Corpus distributed across MAD/BHX/KLP/GVF/PHILAE; **fact tables (`fct_capex_*`, `fct_funding_*`) hold MAD + BHX only** — dashboard/funding hardcoding `['MAD','BHX']` is intentional.
- MAD capex contradiction is registered in `intel_contradiction_alert` (current figures ~€57M vs ~€65M) — open, awaiting CFO.
- RAG/chat migrations applied to prod include **019, 022, 023, 025, 026, 028, 031, 034, 035, 036**. `036` is the corpus-health dashboard fix for the new durable queue. Keep applying future RAG SQL deliberately and document verification/rollback in `sql/rollback/`. New ingests stamp `metadata.page` (WS2-T4) + `metadata.embedding_model`; OCR is ported + opt-in (`MISTRAL_API_KEY`+`RAG_OCR_ENABLED=true`, live in Vercel).
- **Embedding pin (Fase 8 WS7-T1, DECIDED — `docs/embedding-pin-decision.md`):** Gemswell is pinned to `gemini-embedding-001` (768d). Empirically `001` and `gemini-embedding-2`/`-2-preview` are **NOT interoperable** (querying a 001-corpus with model-2 vectors collapses retrieval; `2-preview≡2`). **Never share a corpus or cross-query across embedding models without a full re-embed.** `rag_chunks.embedding_model` is the provenance guard but is **not yet enforced** in `match_chunks` (read only at ingest-write today) — enforcement rides the next 023-class RPC recreation.
- New uploads persist the raw file in Storage (`storage_path`) + record `source_hash`. Legacy rows may still have NULL `source_hash`; the SharePoint/local workflow avoids duplicating them by treating title/project matches as `legacy_title_match` unless explicitly overridden.

## SharePoint Ingest Operating Rules
- Read `docs/sharepoint-rag-ingestion-runbook-2026-06-19.md` before rerunning SharePoint ingestion.
- Start with `npm run sharepoint:reconcile -- ... --report <path>` in dry-run mode.
- Only run `--apply` after reviewing `missing`, `changed`, `reingest_same_hash`, `unmapped`, and `unsupported`.
- Do not enqueue `legacy_title_match` by default; that is the legacy-corpus duplicate guard.
- Do not retry `failed_unextractable` blindly; fix the source file first (OCR, password, valid PDF replacement).
- Do not reingest `duplicate_content_superseded` unless intentionally changing content dedup behavior.
- Use `RAG_LOCAL_PARSE_FALLBACK=force` for recovery while LlamaParse or Anthropic quotas are exhausted.
