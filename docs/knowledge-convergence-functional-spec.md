# Knowledge Convergence Functional SPEC

## Purpose

This SPEC defines how to review and converge the two documentary chat systems:

- Gemswell MIS Knowledge System.
- MDL/Teras documentary assistant.

The goal is not to merge both applications immediately. The goal is to align their document intake, classification, evidence, markdown, RAG and chat verification contracts so a document expert can validate that both bots behave consistently and that critical answers can be audited.

## Review Audience

Primary reviewer:

- Expert documentalist / knowledge manager.

Secondary reviewers:

- Product owner for Gemswell MIS.
- Product owner for MDL/Teras.
- Engineering owner for ingestion and RAG.
- Finance/legal reviewer for source authority rules.

The expert documentalist should validate taxonomy, document lifecycle, source authority, review states, versioning, evidence coverage and whether the chat exposes enough provenance to trust an answer.

## Functional Boundary

In scope:

- Manual upload.
- Drive sync.
- Dedicated email bot such as `bot@terascap.es`.
- Local/backfill ingestion.
- Canonical document record.
- Classification and labeling.
- Markdown version generation.
- Chunk generation.
- Embedding and vector indexing.
- Source verification.
- Chat retrieval.
- Human review.
- Fact/evidence linking.
- Contradiction detection.

Out of scope for this SPEC:

- Full UI redesign.
- Full schema migration design.
- Model/vendor selection.
- Production auth redesign.
- Cross-repo package extraction.
- Final data warehouse design.

## Convergence Principle

Both systems should implement the same knowledge contract even if their internal schemas differ.

Every document should move through the same conceptual lifecycle:

```text
intake
stored
reserved
classified
review_checked
parsed
markdown_generated
chunked
embedded
indexed
available_to_chat
evidence_linked
```

Each chat answer should be able to answer:

- Which documents were used?
- Are they reviewed?
- Are they source-of-record or merely context?
- Which chunks supported the answer?
- Did the answer use structured data, RAG, or both?
- Is there a contradiction or pending review?

## Common Intake Contract

All source adapters should emit a common conceptual payload:

```ts
type KnowledgeIntakeItem = {
  source_channel:
    | 'browser_upload'
    | 'drive_sync'
    | 'gmail_bot'
    | 'local_backfill'
    | 'manual_admin'

  external_id: string | null
  external_thread_id?: string | null
  source_hash: string
  file_name: string
  mime_type: string
  file_size: number
  storage_path: string | null
  local_path?: string | null
  uploaded_by?: string | null
  from_email?: string | null
  received_at: string

  project_id?: string | null
  business_line_id?: string | null
  entity_ids?: string[]
  doc_type?: string | null

  classification_source:
    | 'human'
    | 'rule'
    | 'agent_auto'
    | 'agent_reviewed'
    | 'agent_corrected'
    | 'agent_rejected'

  review_status:
    | 'pending'
    | 'approved'
    | 'rejected'
    | 'needs_review'

  confidentiality:
    | 'public'
    | 'internal'
    | 'confidential'
    | 'restricted'
}
```

Reviewer checks:

- Every intake path can produce these fields or an explicit `unknown`.
- `source_hash` is stable and can deduplicate retries.
- `source_channel` is never inferred from filename alone.
- Bot-ingested material is never treated as human-reviewed by default.
- Missing business line/project is handled fail-closed for scoped chat.

## Classification And Labeling Contract

Classification should be multi-axis. A single `category` is insufficient.

Required document-level labels:

```ts
type DocumentLabels = {
  project_id?: string | null
  business_line_id?: string | null
  entity_ids: string[]

  doc_type:
    | 'legal'
    | 'board'
    | 'funding'
    | 'capex'
    | 'cash_flow'
    | 'bp_model'
    | 'financial_statements'
    | 'tax'
    | 'kyc'
    | 'dd'
    | 'asset_management'
    | 'correspondence'
    | 'general'
    | 'unknown'

  lifecycle:
    | 'draft'
    | 'signed'
    | 'executed'
    | 'filed'
    | 'audited'
    | 'working_paper'
    | 'superseded'
    | 'unknown'

  authority_tier:
    | 'audited'
    | 'executed'
    | 'controller'
    | 'board_pack'
    | 'dd_memo'
    | 'internal'
    | 'narrative'
    | 'unverified'

  authority_score: number
  topics: string[]
  period?: string | null
  currency?: 'EUR' | 'GBP' | 'USD' | null
  confidence: number
  review_status: 'pending' | 'approved' | 'rejected' | 'needs_review'
  review_reason?: string | null
}
```

Authority score defaults:

```text
audited        100
executed        90
controller      80
board_pack      70
dd_memo         60
internal        40
narrative       10
unverified       0
```

Reviewer checks:

- Rules classify obvious cases before LLM classification.
- LLM classification has confidence and reason.
- Low confidence routes to review.
- Signed/audited/executed labels are not assigned solely from optimistic filename matching.
- Rejected classifications are excluded from retrieval or clearly filtered.
- The chat surfaces unreviewed/bot-classified documents cautiously.

## Canonical Document Contract

Each repo should converge on one canonical document record concept.

Minimum required fields:

```text
id
source_channel
source_hash
file_name
mime_type
file_size
storage_path
md_path
project_id / business_line_id
entity_ids
doc_type
lifecycle
authority_tier
authority_score
classification_source
classification_confidence
review_status
rag_status
md_status
current_version
supersedes_document_id
created_at
updated_at
```

Reviewer checks:

- The canonical document exists before chunks are inserted.
- Chunks can always trace back to the canonical document.
- Reprocessing updates status and versioning without orphaning prior chunks.
- Superseded documents remain auditable.
- Storage path and markdown path are not fabricated.

## Markdown Artifact Contract

The markdown artifact is the controlled bridge between binary/original files and RAG.

Required frontmatter:

```yaml
document_id: uuid
source_channel: gmail_bot
source_hash: sha256
file_name: example.pdf
mime_type: application/pdf
business_line_id: templus
project_id:
doc_type: funding
lifecycle: executed
authority_tier: executed
authority_score: 90
classification_source: agent_auto
review_status: pending
parser: llamaparse
ocr_used: false
generated_at: 2026-06-04T00:00:00.000Z
version: 1
```

Reviewer checks:

- Markdown preserves headings, tables, clauses, page markers and section names where possible.
- OCR fallback is marked.
- Parser quality problems are visible.
- The markdown version can be regenerated deterministically or explicitly versioned.
- Chunking uses markdown section metadata.

## RAG Chunk Contract

Each chunk should carry enough metadata for audit and filtering.

Minimum metadata:

```text
document_id
chunk_index
content_hash
section_heading
page_start
page_end
source_offset_start
source_offset_end
project_id / business_line_id
entity_ids
doc_type
lifecycle
authority_tier
authority_score
review_status
classification_source
parser_used
embedding_model
source_channel
source_file
storage_path / md_path
```

Reviewer checks:

- Scoped retrieval can filter by project/business line.
- The chat can suppress or downgrade `review_status != approved`.
- Authority is available at retrieval time.
- Section headings are shown in source cards.
- Embedding model and dimension are stable.
- Reindexed documents delete or supersede previous chunks deterministically.

## Chat Contract

Both chats should converge toward explicit tools instead of one large implicit context block.

Recommended common tools:

```text
search_documents
get_document_inventory
get_document_status
get_structured_context
get_fact_evidence
get_pending_reviews
compare_sources
```

Reviewer checks:

- The chat uses tools for retrievable facts.
- The chat stores tool calls.
- Final responses expose sources.
- Source cards show label, authority, review status and relevance.
- The chat distinguishes structured data from documentary evidence.
- The chat does not silently promote unreviewed bot-classified documents.

## Evidence And Review Contract

For critical metrics and facts, both systems should support:

```text
metric_definition
metric_candidate
doc_authority
review_decision
fact_publication
fact_source_link
contradiction_alert
```

Reviewer checks:

- Extracted facts are candidates until reviewed or auto-accepted under explicit rules.
- Human decisions are immutable audit records.
- Published facts keep a receipt linking them to source chunks.
- Contradictions remain visible until resolved.
- Review screens show source, value, confidence, authority and context snippet.

## Functional Coverage Matrix

| Area | Functional Requirement | Gemswell Current Coverage | MDL/Teras Current Coverage | Convergence Gap |
| --- | --- | --- | --- | --- |
| Knowledge boundary | Separate documentary bot from dashboard/control surfaces | Explicit in `docs/knowledge-system.md` | Partially via domain context and docs memory | Add formal Knowledge System boundary to MDL |
| Intake sources | Upload, Drive, email bot, local backfill | Queue/local DMS; upload/storage less mature | Upload, Drive, Gmail bot, Inngest harness | Define common intake adapter contract |
| Job state | Single stateful ingestion job | `ingest_queue` plus centralized processor | `agent_attachment_jobs`, Inngest, legacy endpoints | Normalize states and idempotency |
| Canonical document | One document record before chunks | `rag_documents`, metadata-heavy | `bl_documents` plus `rag_documents` bridge | Align canonical fields and versioning |
| Classification | Project/BL, doc type, authority, review | Folder-map authority, source verification | Strong classifier, review source labels | Add common taxonomy and authority tiers |
| Markdown artifact | Controlled `.md` between binary and RAG | Not yet first-class | Agent harness publishes markdown | Bring markdown versioning into Gemswell |
| Chunking | Section-aware, metadata-rich chunks | Financial-aware chunking, needs section metadata | Heading-aware markdown chunking | Use heading-aware contract in both |
| Embeddings | Stable model and dimensions | Gemini 768, dimension checks | Gemini 768, batch retry path | Pin model/metadata consistently |
| Chat retrieval | Hybrid search, rerank, tool loop | Strong tool loop and source verification | Strong structured context, direct retrieval | Combine tool loop with structured context |
| Source cards | Authority and verification visible | Implemented | Partial source category display | Port source verification to MDL |
| Review/evidence | Candidate review, publication, contradiction | Layer 3 schema and APIs | Suggestions/review patterns, no full evidence chain | Adapt Layer 3 evidence model to MDL |
| Operations | Queue status and smoke/reprocess | Basic worker/API path | Strong Inngest/reprocess scripts | Share smoke tests and stuck-job recovery |

## Key Code Files For Review

### Gemswell MIS

Knowledge boundary and product contract:

- `/Users/moisesmenendez/Dropbox/DESARROLLO/GEMSWELL_MIS/gemswell-mis-app/docs/knowledge-system.md`

Chat and tool loop:

- `/Users/moisesmenendez/Dropbox/DESARROLLO/GEMSWELL_MIS/gemswell-mis-app/src/app/api/chat/route.ts`
- `/Users/moisesmenendez/Dropbox/DESARROLLO/GEMSWELL_MIS/gemswell-mis-app/src/app/chat/page.tsx`

Source verification:

- `/Users/moisesmenendez/Dropbox/DESARROLLO/GEMSWELL_MIS/gemswell-mis-app/src/lib/knowledge/source-reference.ts`

Ingestion:

- `/Users/moisesmenendez/Dropbox/DESARROLLO/GEMSWELL_MIS/gemswell-mis-app/src/lib/ingest/queue-processor.ts`
- `/Users/moisesmenendez/Dropbox/DESARROLLO/GEMSWELL_MIS/gemswell-mis-app/src/app/api/ingest/queue/route.ts`
- `/Users/moisesmenendez/Dropbox/DESARROLLO/GEMSWELL_MIS/gemswell-mis-app/src/app/api/ingest/process/route.ts`
- `/Users/moisesmenendez/Dropbox/DESARROLLO/GEMSWELL_MIS/gemswell-mis-app/scripts/ingest-worker.mjs`
- `/Users/moisesmenendez/Dropbox/DESARROLLO/GEMSWELL_MIS/gemswell-mis-app/scripts/ingest-dms.mjs`

Parsing, chunking and embeddings:

- `/Users/moisesmenendez/Dropbox/DESARROLLO/GEMSWELL_MIS/gemswell-mis-app/src/lib/rag/parse.ts`
- `/Users/moisesmenendez/Dropbox/DESARROLLO/GEMSWELL_MIS/gemswell-mis-app/src/lib/rag/embeddings.ts`
- `/Users/moisesmenendez/Dropbox/DESARROLLO/GEMSWELL_MIS/gemswell-mis-app/src/lib/rag/rerank.ts`

Evidence and document grounding:

- `/Users/moisesmenendez/Dropbox/DESARROLLO/GEMSWELL_MIS/gemswell-mis-app/sql/003_layer3_evidence_reconciliation.sql`
- `/Users/moisesmenendez/Dropbox/DESARROLLO/GEMSWELL_MIS/gemswell-mis-app/src/lib/intel/grounding.ts`
- `/Users/moisesmenendez/Dropbox/DESARROLLO/GEMSWELL_MIS/gemswell-mis-app/src/app/api/intel/candidates/route.ts`
- `/Users/moisesmenendez/Dropbox/DESARROLLO/GEMSWELL_MIS/gemswell-mis-app/src/app/api/intel/review/route.ts`
- `/Users/moisesmenendez/Dropbox/DESARROLLO/GEMSWELL_MIS/gemswell-mis-app/src/app/api/intel/packs/[id]/route.ts`
- `/Users/moisesmenendez/Dropbox/DESARROLLO/GEMSWELL_MIS/gemswell-mis-app/src/app/admin/review/page.tsx`
- `/Users/moisesmenendez/Dropbox/DESARROLLO/GEMSWELL_MIS/gemswell-mis-app/src/app/admin/packs/page.tsx`
- `/Users/moisesmenendez/Dropbox/DESARROLLO/GEMSWELL_MIS/gemswell-mis-app/src/app/admin/packs/[id]/page.tsx`

### MDL/Teras

Chat and structured context:

- `/Users/moisesmenendez/Dropbox/DESARROLLO/mdl-patrimonio/src/app/api/chat/route.ts`
- `/Users/moisesmenendez/Dropbox/DESARROLLO/mdl-patrimonio/src/app/chat/page.tsx`
- `/Users/moisesmenendez/Dropbox/DESARROLLO/mdl-patrimonio/src/lib/domain/information-context.ts`
- `/Users/moisesmenendez/Dropbox/DESARROLLO/mdl-patrimonio/src/lib/domain/index.ts`

Email bot and intake:

- `/Users/moisesmenendez/Dropbox/DESARROLLO/mdl-patrimonio/src/app/api/agent/poll-inbox/route.ts`
- `/Users/moisesmenendez/Dropbox/DESARROLLO/mdl-patrimonio/src/app/api/agent/ingest-email/route.ts`
- `/Users/moisesmenendez/Dropbox/DESARROLLO/mdl-patrimonio/src/inngest/functions/poll-inbox.ts`
- `/Users/moisesmenendez/Dropbox/DESARROLLO/mdl-patrimonio/src/inngest/functions/process-attachment.ts`

Manual upload and Drive:

- `/Users/moisesmenendez/Dropbox/DESARROLLO/mdl-patrimonio/src/app/api/upload/route.ts`
- `/Users/moisesmenendez/Dropbox/DESARROLLO/mdl-patrimonio/src/app/api/drive/route.ts`
- `/Users/moisesmenendez/Dropbox/DESARROLLO/mdl-patrimonio/src/lib/rag/drive.ts`

Legacy ingestion and RAG bridge:

- `/Users/moisesmenendez/Dropbox/DESARROLLO/mdl-patrimonio/src/app/api/ingest-document/route.ts`
- `/Users/moisesmenendez/Dropbox/DESARROLLO/mdl-patrimonio/src/app/api/ingest/route.ts`
- `/Users/moisesmenendez/Dropbox/DESARROLLO/mdl-patrimonio/src/lib/rag/ingest.ts`
- `/Users/moisesmenendez/Dropbox/DESARROLLO/mdl-patrimonio/scripts/batch-ingest.ts`

New agent harness:

- `/Users/moisesmenendez/Dropbox/DESARROLLO/mdl-patrimonio/src/lib/agent/reserve.ts`
- `/Users/moisesmenendez/Dropbox/DESARROLLO/mdl-patrimonio/src/lib/agent/classify.ts`
- `/Users/moisesmenendez/Dropbox/DESARROLLO/mdl-patrimonio/src/lib/agent/convert.ts`
- `/Users/moisesmenendez/Dropbox/DESARROLLO/mdl-patrimonio/src/lib/agent/ocr.ts`
- `/Users/moisesmenendez/Dropbox/DESARROLLO/mdl-patrimonio/src/lib/agent/embed.ts`
- `/Users/moisesmenendez/Dropbox/DESARROLLO/mdl-patrimonio/src/lib/agent/publish.ts`
- `/Users/moisesmenendez/Dropbox/DESARROLLO/mdl-patrimonio/src/lib/agent/gmail.ts`
- `/Users/moisesmenendez/Dropbox/DESARROLLO/mdl-patrimonio/src/lib/agent/preview.ts`

Embeddings and retrieval:

- `/Users/moisesmenendez/Dropbox/DESARROLLO/mdl-patrimonio/src/lib/rag/embeddings.ts`
- `/Users/moisesmenendez/Dropbox/DESARROLLO/mdl-patrimonio/src/lib/rag/rerank.ts`
- `/Users/moisesmenendez/Dropbox/DESARROLLO/mdl-patrimonio/src/lib/rag/graph.ts`

Schema and governance:

- `/Users/moisesmenendez/Dropbox/DESARROLLO/mdl-patrimonio/supabase/migrations/20260608_002_agent_attachment_jobs.sql`
- `/Users/moisesmenendez/Dropbox/DESARROLLO/mdl-patrimonio/supabase/migrations/20260608_003_bl_documents_extensions.sql`
- `/Users/moisesmenendez/Dropbox/DESARROLLO/mdl-patrimonio/supabase/migrations/20260608_004_rag_chunks_extend.sql`
- `/Users/moisesmenendez/Dropbox/DESARROLLO/mdl-patrimonio/supabase/migrations/20260608_005_agent_workflow_events.sql`
- `/Users/moisesmenendez/Dropbox/DESARROLLO/mdl-patrimonio/supabase/migrations/20260611_011_match_chunks_filtered.sql`

Operational scripts and notes:

- `/Users/moisesmenendez/Dropbox/DESARROLLO/mdl-patrimonio/scripts/reprocess-stuck-jobs.mjs`
- `/Users/moisesmenendez/Dropbox/DESARROLLO/mdl-patrimonio/scripts/send-smoke-v2b.mjs`
- `/Users/moisesmenendez/Dropbox/DESARROLLO/mdl-patrimonio/docs/superpowers/build-notes/bot-harness-v1-todos.md`
- `/Users/moisesmenendez/Dropbox/DESARROLLO/mdl-patrimonio/ARQUITECTURA_CHAT_RAG.md`

## Expert Documentalist Review Checklist

### 1. Intake And Provenance

- Confirm every source path records origin: upload, Drive, Gmail, local.
- Confirm each document has a stable source hash.
- Confirm retries cannot create indistinguishable duplicates.
- Confirm sender/uploader/source folder is preserved.
- Confirm bot email attachments do not bypass review.

### 2. Classification

- Validate doc type taxonomy against real corpora.
- Validate business line/project/entity assignment.
- Validate authority tier rules.
- Validate low-confidence routing.
- Validate rejection behavior.
- Confirm classification is visible to users and reviewers.

### 3. Markdown Quality

- Inspect markdown for representative PDFs, DOCX, XLSX, PPTX and emails.
- Confirm tables survive conversion.
- Confirm section headings are preserved.
- Confirm parser and OCR fallbacks are recorded.
- Confirm markdown version can be tied back to the original.

### 4. RAG Metadata

- Confirm chunks retain document labels.
- Confirm chunk section/page offsets are present when available.
- Confirm content hash is stable.
- Confirm embedding model is stored.
- Confirm retrieval filters can use project/BL/doc type/review status.

### 5. Chat Behavior

- Ask critical questions requiring official sources.
- Ask questions likely to retrieve unreviewed bot documents.
- Ask cross-source questions with possible contradictions.
- Confirm the answer identifies source authority.
- Confirm the answer does not overstate weak sources.
- Confirm tool calls or retrieval decisions are auditable.

### 6. Evidence And Review

- Confirm extracted facts are candidates before publication.
- Confirm review decisions are immutable.
- Confirm fact rows can link back to document chunks.
- Confirm contradictions are visible.
- Confirm stale/provisional/missing evidence is surfaced.

## Minimum Test Corpus For Review

The review should include at least:

- One signed contract.
- One audited/accounting document.
- One board pack or minutes document.
- One financing agreement.
- One business plan/model spreadsheet.
- One cash flow spreadsheet.
- One low-quality scanned PDF.
- One email with attachment from the bot account.
- One Drive-synced file.
- One manually uploaded file.
- One superseded/revised document pair.
- One deliberately ambiguous document requiring review.

## Acceptance Criteria

The convergence work can be considered functionally covered when:

- All intake paths produce the common intake fields.
- Each indexed chunk has a canonical document and classification metadata.
- Bot-ingested documents default to pending or needs-review unless explicitly approved.
- The chat displays source authority and review status.
- Critical answers expose document sources and tool usage.
- Structured facts can link to supporting chunks.
- Reprocessing is idempotent.
- Superseded documents remain auditable.
- Contradictions can be detected or at least routed to review.
- The expert documentalist can trace one answer from chat response to chunk, document, markdown and original source.

## Recommended Implementation Sequence

1. Freeze this SPEC as the functional review baseline.
2. Add the common taxonomy and intake contract to both repos.
3. Normalize intake adapters to create jobs instead of direct ingestion.
4. Ensure canonical document reservation before parsing.
5. Add markdown frontmatter and version status.
6. Enrich chunk metadata.
7. Port source verification to MDL/Teras.
8. Port heading-aware markdown chunking to Gemswell.
9. Convert MDL structured context into auditable chat tools.
10. Adapt Gemswell evidence/reconciliation model to MDL/Teras.
11. Run the minimum test corpus through both systems.
12. Review results with the expert documentalist and close taxonomy gaps.

## Open Decisions

- Whether to extract a shared `knowledge-contract` package or keep parallel implementations.
- Whether markdown artifacts live in GitHub, Supabase Storage, Drive or all three.
- Whether unreviewed documents are searchable but downgraded, or excluded by default.
- Whether authority labels are fully rule-based or allow human override only.
- Whether both repos should share one email bot address or separate addresses with one contract.
- Whether RAG search should fail closed for missing business line/project labels in scoped chats.

