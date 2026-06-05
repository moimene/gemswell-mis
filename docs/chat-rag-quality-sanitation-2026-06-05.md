# Chat/RAG Quality Sanitation Status

Date: 2026-06-05
Scope: Gemswell MIS chat, RAG retrieval, ingestion defaults, and document-governance semantics.

## Objective

Improve answer quality before expanding the system: the chat must stop treating legacy RAG as fully verified truth, must retrieve evidence through tools, and must expose document review/authority limits instead of hiding them.

Security/RLS is intentionally out of scope for this pass because the priority is chat/RAG quality.

## Changes Implemented

### Chat Inference

- Removed hardcoded financial/corporate facts from the system prompt.
- Replaced them with an evidence-first prompt: tools before facts, no unsupported precision, explicit caveats for missing/stale/unreviewed evidence.
- Added model routing:
  - `CHAT_FAST_MODEL` defaults to `claude-sonnet-4-20250514`.
  - `CHAT_REASONING_MODEL` can be configured for finance/legal/risk/evidence-heavy questions.
  - `CHAT_VERIFIER_MODEL` can be configured separately.
- Added optional answer verification pass (`CHAT_VERIFIER_ENABLED`, enabled by default) to rewrite unsupported claims conservatively after tool execution.
- Added `get_portfolio_context` as an orientation-only tool. It reports corpus governance status and project routing context, but is explicitly not financial evidence.

### RAG Retrieval

- `search_documents` now passes `match_threshold` explicitly (`RAG_MATCH_THRESHOLD`, default `0.18`).
- Rejected sources are filtered again in application code even though SQL should also exclude them.
- Unreviewed/pending sources receive explicit warnings in the context shown to the model.
- Reranking now penalizes `pending` / `needs_review` sources and modestly boosts higher `authority_score`.
- Source cards default missing review metadata to `needs_review`, not `approved`.

### Ingestion Defaults

- Queue ingestion default review status is now `needs_review`.
- New documents created by the governed queue should not silently enter the corpus as approved.

### Database Semantics

`sql/005_quality_sanitation.sql` captures the quality migration:

- Adds canonical parent metadata to `rag_documents`: `project_id`, `doc_type`, `period`.
- Changes defaults away from fake trust:
  - `review_status = needs_review`
  - `classification_source = rule`
  - `authority_tier = unverified`
  - `authority_score = 0`
- Backfills parent metadata from existing chunk metadata.
- Applies rule-based document typing and authority scoring to legacy documents.
- Moves legacy `approved` documents to `needs_review` with a review reason.
- Recreates `keyword_search_chunks` with live parent governance.
- Defines an optimized `match_chunks` candidate search intended to use ANN before applying threshold/project/doc filters.

## Current Remote Data Snapshot

After the data sanitation already applied to Supabase project `nqxhsjkcvfxygiajdxki`:

- Documents: `5,498`
- Chunks: `156,898`
- Review status: all legacy documents are now `needs_review`
- Classification source: all legacy documents are now `rule`
- Authority distribution:
  - `audited`: 1 document, score 92
  - `executed`: 142 documents, score 88
  - `board_pack`: 67 documents, score 82
  - `controller`: 107 documents, score 78
  - `dd_memo`: 126 documents, score 72
  - `internal`: 58 documents, score 62
  - `narrative`: 17 documents, score 45
  - `unverified`: 4,980 documents, score 0
- Approved source-of-record documents: `0`

This is deliberate: the corpus is now honest about being unreviewed. Human/documentalist review must promote selected documents to `approved` before the UI can show `source_of_record`.

## Verification

Passed locally:

- `npm run lint`
- `npm run build`
- Local `/api/chat` smoke test against `http://localhost:3100`:
  - model returned: `claude-sonnet-4-20250514`
  - verifier returned: `claude-sonnet-4-20250514`
  - tool used: `get_portfolio_context`
  - response correctly framed BHX corpus as unreviewed / not source-of-record

Remote smoke tests:

- `keyword_search_chunks` returns live governance metadata (`needs_review`, `rule`, `authority_tier`, `authority_score`) in under 1 second for a BHX sample query.
- The remote `match_chunks` RPC still needs the optimized SQL definition applied after the Supabase CLI temporary auth circuit clears. The current remote vector function timed out during smoke testing; the optimized definition is versioned in `sql/005_quality_sanitation.sql`.

## Next Functional Gate

The next quality milestone is not another prompt change. It is a document-review workbench:

1. Show documents grouped by inferred project/doc_type/authority.
2. Let a reviewer approve/reject/reclassify/promote authority.
3. Write decisions to `rag_documents` and optionally `intel_review_decision`.
4. Re-run chat evals against approved and unreviewed evidence sets.

Until that exists, the bot can be conservative and auditable, but it cannot be fully authoritative.
