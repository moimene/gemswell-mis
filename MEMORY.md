# Gemswell MIS Memory

Last updated: 2026-06-19

Read this first when resuming Gemswell MIS work.

## Current Operating State

- Repo: `/Users/moisesmenendez/Dropbox/DESARROLLO/GEMSWELL_MIS/gemswell-mis-app`
- Production Supabase: `nqxhsjkcvfxygiajdxki`
- Production app: `https://gemswell-mis-app.vercel.app`
- `origin/main` is production; pushing to `main` auto-deploys through Vercel.
- The app is admin-only and the corpus is RLS-locked.

## RAG / Ingest State

- Durable ingest table: `knowledge_ingest_jobs`.
- Governed pipeline entrypoint: `ingestBuffer` in `src/lib/ingest/queue-processor.ts`.
- Durable job helpers: `src/lib/ingest/jobs.ts`.
- Parser path: `src/lib/rag/parse.ts`.
- Dedup keys:
  - `source_hash` over original bytes, project-scoped.
  - `content_hash` over parsed body, used to supersede duplicate content.
- Project scope is mandatory for chat (`MAD`, `BHX`, `KLP`, `PHILAE`, `GVF`, `ETP`).

## SharePoint Corpus Refresh - 2026-06-19

The SharePoint refresh was completed from local ZIP exports, not Graph. A Graph connector still does not exist in this repo.

Final report:

- `docs/reports/sharepoint-local-reconcile-final-after-ingest.json`
- `docs/reports/sharepoint-local-reconcile-final-after-ingest.csv`

Final state:

- Corpus dashboard/RPC now reflects this run: `knowledge_corpus_health()` was updated by
  `sql/036_corpus_health_knowledge_ingest_jobs.sql` in prod on 2026-06-19 to read
  `knowledge_ingest_jobs` instead of legacy `ingest_queue`.
- Dashboard corpus counts: `rag_documents=6895`, `rag_chunks=213438`, `approved=3477`,
  `needs_review=1368`, `source_of_record=814`.
- Inventory: `2120` files.
- `enqueueable=0`.
- Queue: `queued=0`, `processing=0`, `done=1366`, `error=24`, `canceled=1`.
- Final non-ingested source documents are material failures only:
  - `22` failed paths / `20` unique docs.
  - `17` no usable extractable text.
  - `3` corrupt/invalid PDF structure.
  - `2` password-protected PDFs.
- Unsupported non-document formats remain out of scope: images, videos, CAD, archives, email containers, etc.

Detailed process and commands:

- `docs/sharepoint-rag-ingestion-runbook-2026-06-19.md`
- Historical memory: `docs/chat-rag-ingest-memory-state-2026-06-04.md`

## SharePoint / Local Ingestion Tools

Scripts are exposed in `package.json`:

- `npm run sharepoint:reconcile`
- `npm run sharepoint:ingest-large`
- `npm run ingest:jobs-loop`
- `npm run ingest:jobs-direct`

Use `RAG_LOCAL_PARSE_FALLBACK=force` when LlamaParse quota is unavailable.

Do not enqueue `legacy_title_match` by default. Do not reprocess `duplicate_content_superseded` unless changing dedup policy. Do not blindly retry `failed_unextractable`; replace/OCR/password-fix the source files first.

## Validation Gates

For ingest/tooling changes, run:

```bash
npx tsc --noEmit --pretty false
npm run lint
npx vitest run src/lib/ingest/__tests__/jobs.test.ts
```

For broad app changes, also run `npm run build` if time and environment allow.
