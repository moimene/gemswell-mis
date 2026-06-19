<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Gemswell MIS Agent Notes

Read `MEMORY.md` before making RAG, ingest, chat, Supabase, or deployment changes.

## Production Safety

- `origin/main` is production. Pushes to `main` auto-deploy through Vercel.
- Supabase prod is `nqxhsjkcvfxygiajdxki`.
- The app is admin-only and corpus access is RLS-locked.
- Do not apply migrations, push to `main`, or run bulk ingestion without explicit intent.

## RAG / Ingest Entry Points

- Detailed SharePoint/local ingestion runbook: `docs/sharepoint-rag-ingestion-runbook-2026-06-19.md`.
- Memory state: `docs/chat-rag-ingest-memory-state-2026-06-04.md`.
- Governed pipeline: `src/lib/ingest/queue-processor.ts` (`ingestBuffer`).
- Durable jobs: `src/lib/ingest/jobs.ts` and `knowledge_ingest_jobs`.
- Parser fallback: `src/lib/rag/parse.ts`.

Use the governed pipeline. Do not create ad hoc direct inserts into `rag_chunks` or mark jobs `done` unless `ingestBuffer` actually completed or an existing indexed document with matching `source_hash/project_id` was verified.

## SharePoint Ingestion Tools

- `npm run sharepoint:reconcile`
- `npm run sharepoint:ingest-large`
- `npm run ingest:jobs-loop`
- `npm run ingest:jobs-direct`

For local recovery when parser SaaS quota is unavailable, run tools with:

```bash
RAG_LOCAL_PARSE_FALLBACK=force
```

Final SharePoint export reconciliation from 2026-06-19 is in:

- `docs/reports/sharepoint-local-reconcile-final-after-ingest.json`
- `docs/reports/sharepoint-local-reconcile-final-after-ingest.csv`

Final clean condition was `enqueueable=0`, `queued=0`, `processing=0`.
Dashboard health is also aligned with the new queue: `sql/036_corpus_health_knowledge_ingest_jobs.sql`
updates `knowledge_corpus_health()` to report `knowledge_ingest_jobs` (`done=1366`, `error=24`,
`canceled=1`) instead of legacy `ingest_queue`.

## Completion Checks

For ingest/tooling changes:

```bash
npx tsc --noEmit --pretty false
npm run lint
npx vitest run src/lib/ingest/__tests__/jobs.test.ts
```
