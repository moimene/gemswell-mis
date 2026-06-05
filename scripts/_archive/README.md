# ⛔ Archived ingest scripts — DO NOT RUN

These scripts are kept for reference only. **Do not execute them.**

- `ingest-dms.mjs`
- `ingest-key-docs.mjs`

## Why they are quarantined

Both write **directly** to `rag_documents` / `rag_chunks`, bypassing the canonical
pipeline (`src/lib/ingest/queue-processor.ts` via `/api/ingest/process`). Running them:

- computes **no `source_hash`** → cannot dedup against the governed corpus; re-running
  creates **duplicate** documents + chunk sets;
- sets **no governance metadata** (`review_status`, `classification_source`,
  `authority_tier`/`score`) → docs land trusted-by-default in the chat;
- generates **no markdown artifact** and runs their own divergent parser/chunker/embedding.

The single governed writer is `queue-processor.ts`. To ingest, enqueue into
`ingest_queue` (e.g. `POST /api/ingest/queue`) and run `POST /api/ingest/process`
(or `scripts/ingest-worker.mjs`, which only drives that endpoint).

Quarantined as part of sub-project A — see
`docs/superpowers/plans/2026-06-05-corpus-gobernado-foundation.md` (Task 7) and
`docs/auditoria-critica-chat-documental-2026-06-05.md` (risk C4).
