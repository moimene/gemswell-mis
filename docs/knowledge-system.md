# Gemswell Knowledge System

## Purpose

The Knowledge System is the critical environment for the document bot and document ingestion. It is separate from the Tower Control dashboards.

Its job is to answer CEO/CFO questions with:

- consistent reasoning,
- explicit data/tool usage,
- traceable documentary sources,
- clear confidence and authority signals,
- auditable ingestion and retrieval behavior.

## Boundary

Knowledge System:

- `/chat` user experience.
- `/api/chat` financial/document agent.
- `src/lib/rag/*` parsing, chunking, embeddings and reranking.
- `scripts/ingest-worker.mjs`, `scripts/ingest-dms.mjs`, `scripts/ingest-key-docs.mjs`.
- `rag_documents`, `rag_chunks`, `rag_conversations`, `rag_messages`.
- `ingest_queue`.
- Evidence/review surfaces under `/admin/review` and `/admin/packs`.

Tower Control:

- CEO dashboard and operational pages.
- Structured fact-table reporting.
- Pack publication and Layer 3 to Layer 4 reporting.
- UI summaries built from `fct_*` and `dim_*` tables.

Shared contract:

- Both systems can read the same Supabase database.
- Tower Control should not own RAG prompts, ingestion heuristics, or document source formatting.
- Knowledge System should not silently mutate fact snapshots. Facts remain append-only and evidence-linked.

## Bot Invariants

1. The bot must use tools for retrievable data instead of guessing.
2. Every documentary answer should expose sources from `rag_chunks`.
3. Every structured-data answer should store the tools used in `rag_messages.tool_calls`.
4. A source must show at least file name, project, document type, relevance and authority when available.
5. A source URL is shown only when the system actually has a URL or storage path. Do not fabricate links from bare file names.
6. Search filters requested by the agent, such as `project_id` and `doc_type`, must be applied to retrieval.
7. Ingested documents should carry enough metadata to support verification: `project_id`, `doc_type`, `source_file`, `dms_folder` or `storage_path`, `authority`, `parser`, and `chunk_type`.

## Verification Workflow

For a critical answer:

1. Read the answer and identify each numerical or legal claim.
2. Expand sources in the chat UI.
3. Check source authority:
   - `authority >= 90`: source-of-record or high authority.
   - `authority 75-89`: supporting evidence.
   - missing/low authority: context only, not final proof.
4. Confirm the source file and document type match the claim.
5. If the answer used structured data only, inspect stored `tool_calls` for the database tool path.
6. If a contradiction exists, route it through Layer 3 review before publishing any structured fact.

## Current Operational State

As of 2026-06-03 local inspection and hardening pass:

- The GitHub repo is `moimene/gemswell-mis`.
- The app repo root is `gemswell-mis-app`.
- The document corpus has thousands of indexed documents and an estimated 150K+ chunks.
- The queue is not fully complete; pending items are mainly BHX reporting/model files.
- `match_chunks` and `keyword_search_chunks` both respond in the configured Supabase project.
- The chat agent uses function calling and hybrid retrieval, preserves tool-call audit logs, applies document filters, and exposes source verification metadata.
- The queue ingestion path is centralized in `src/lib/ingest/queue-processor.ts`; `/api/ingest/process` is the canonical executor and `scripts/ingest-worker.mjs` is an API driver.
- Evidence Review and Pack Grounding read document type/source metadata from `rag_chunks.metadata`, not from `rag_documents` columns.
- `npm run lint` and `npm run build` pass locally.

## Next Hardening Items

- Add a corpus status API/page for queue health, parser mix, chunk count and pending errors.
- Add signed URL support for Supabase Storage documents when uploads are present.
- Add an answer evaluation set with recurring questions and expected source files.
- Decide whether legacy direct-ingest scripts such as `scripts/ingest-dms.mjs` should be retired or converted into queue population only.
- Add contradiction checks before facts are published into Tower Control.
