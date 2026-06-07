# Readiness — Chat documental + Gestor documental (2026-06-07)

Production-grade pass over the two user-facing surfaces of Gemswell MIS: **`/chat`** (documentary RAG
assistant) and **`/admin/documents`** (document manager). All work merged on `agent/prod-chat-gestor`,
verified live against the shared Supabase project `nqxhsjkcvfxygiajdxki`. Migrations applied: **014, 015**.

## Verdict

| Surface | Before | After |
|---|---|---|
| `/chat` | NOT production-grade: vector retrieval **silently timed out** (never returned documents via vector), dead citation links, 2-min blank blocking wait, no injection boundary | **Production-grade**: retrieval fixed + index-served, SSE-streamed with progress, verified-only answers, live deep-link citations, injection-hardened |
| `/admin/documents` | Mostly solid governance core, but 25MB upload was a lie (4.5MB cap), OCR-less, dead `/admin/ingest` leaking stuck rows, raw error leaks, doc_type filter silently wrong | **Production-grade**: direct-to-Storage upload, retry/reconcile, queue drained + ingest retired, bulk review, error mapping, doc_type correctness |

## The headline find (live verification, not code review)

`match_chunks` (vector search) **timed out via the app's client (supabase-js → PostgREST)** and returned
empty — so the documentary chat had effectively **never retrieved documents by vector** in production;
it answered only from structured fact tables + keyword. Root cause: PostgREST passes every arg as a bind
param (incl. `LIMIT $2`) and reuses prepared statements → generic plan; the multi-key `ORDER BY` over the
`rag_documents` JOIN then abandoned the HNSW index → seq scan of 156,898 vectors (~47s) → killed by the
~8s statement timeout. Identical call was 1–440ms in psql with a constant. Fixed in **sql/014** (two-stage
bare-table HNSW top-N) and refined in **sql/015** (HNSW iterative scan with filters inside the indexed
scan, restoring narrow-project recall — KLP went 2→10 results).

## What shipped (by finding)

**Chat (F1,F4,F5,F6,F7,F12,F13,F21,F23 + retrieval):**
- SSE streaming: progress channel (searching→drafting→verifying, 5s heartbeat + elapsed), answer text only in the verified `final` event (decision D2-A). Client: SSE parser, per-chunk idle watchdog, **Cancel** button (aborts server-side calls). `verified` flag → "sin verificar" badge if the verifier fails/disabled (CX-1).
- Live citations: every source deep-links to `/admin/documents?doc=<id>` (inspectable even with no stored artifact); external URLs http(s)-validated.
- Prompt-injection: chunk bodies wrapped in `<document_content trust="untrusted">` (case/whitespace-tolerant defang), heuristic scan → answer/source advisories, SYSTEM_PROMPT + verifier treat boundary content as data. Source labels/filenames sanitized to inert single lines (CX-4).
- Verifier runs even on zero-tool answers (forces abstention); `[SIN REVISAR]` caveat required inline for needs_review sources; relevance normalized + `degradado` flag; truncation flag; conversation persistence ownership-checked + insert errors surfaced (`persisted:false`); financial tables render as aligned `<table>`.

**Gestor (F2,F3,F8,F9,F10,F11,F14,F15,F16,F17,F18,F20,F22):**
- Direct-to-Storage upload (`/api/knowledge/upload/sign` → PUT → ingest) bypassing the 4.5MB body cap (50MB limit); `storagePath` validated to the signed namespace (CX-2). Per-batch retry/reconcile in `ingestBuffer`; scanned-doc error message; `reapStrandedDocuments` reaper; raw upload errors no longer leaked (CX-6).
- `/admin/ingest` + `/api/ingest/*` retired (serverless-incompatible, read a non-existent DMS_ROOT); `ingest_queue` drained (269 stuck rows deleted, corpus untouched).
- Governance: error mapping (no raw Postgres leaks), doc_type allowlist synced to live DB (+annual_accounts/bank_statement; unknown → 0 results not full list), bulk approve/reject + review-priority sort + rendered `onlyNeedsReview`, classifier can't auto-approve high-authority claims (F16), source_of_record tile hint, health RPC shape guard.

## Live verification evidence
- SSE: 19–21 progress events → verified `final`, Opus + verifier, `persisted:true`, document citations with clickable deep-links.
- Retrieval (supabase-js, the failing path): match_chunks all projects 10 rows in 225–722ms (was timeout / KLP 2).
- F17: `doc_type=NONSENSE` → 0 (was full 5498); bank_statement→8, annual_accounts→2.
- F19 governance lifecycle on scratch docs: approve→retire→restore→supersede all correct; double-supersede → 409 with clean message.
- Upload flow E2E (sign→PUT→ingest→indexed, storage_path recorded); synthetic data cleaned, corpus held at 5,498/156,898.
- Prompt-injection probe: model did not obey embedded instructions; evidence-disciplined abstention.
- Adversarial: Codex review (base `0e8123f`) → 6 findings, all addressed (CX-1..6).
- Gates per commit: 72 vitest green, lint clean, `npm run build` clean (`ƒ Proxy (Middleware)`), tsc clean.

## Residual backlog (documented, not blocking)
- **Artifact / source_hash backfill for the legacy 5,496 docs**: blocked — original bytes are not in Storage (only on the local DMS). New uploads are covered going forward. Needs a bulk DMS→Storage upload to enable openable artifacts + reliable dedup for the legacy corpus.
- **4 unparseable queue files** (CFB/OLE2 binaries with modern extensions): re-save as real .docx/.xlsx in Office to ingest.
- **Background ingest / true async** (F15 deeper half): ingest still runs synchronously in the request; the reaper makes strandings retryable, but a Vercel Workflow/queue would be more robust for very large docs.
- **Project scoping** limited to MAD/BHX regex (KLP/PHILAE/GVF not project-filterable from the chat tool, though retrievable cross-project).
- **Real 15–20MB PDF ingest** not run end-to-end (cost/time); the cap-bypass is structural (file never transits the function body).
