# Layer 3: Evidence & Reconciliation Layer

## Architecture Overview

Layer 3 bridges the gap between unstructured documents (Layer 2 — RAG/vector store with 27,600+ chunks) and structured fact tables (Layer 1 — dimensional model with fct_capex_snapshot, fct_cash_13w, fct_funding_snapshot). It provides a full audit trail, authority ranking, contradiction detection, and human-in-the-loop review for every metric that flows from a document into a KPI.

## Three-Layer System

```
┌─────────────────────────────────────────────────────────┐
│  LAYER 1: Structured MIS                                │
│  dim_project, dim_capex_category, dim_funding_instrument│
│  fct_capex_snapshot, fct_cash_13w, fct_funding_snapshot │
│  fct_risk_snapshot, fct_covenant_snapshot, ...           │
├─────────────────────────────────────────────────────────┤
│  LAYER 3: Evidence & Reconciliation  ← THIS LAYER      │
│  intel_metric_definition    — canonical metric catalog   │
│  intel_doc_authority        — document trust ranking     │
│  intel_extraction_run       — batch job tracking         │
│  intel_metric_candidate     — extracted values (pending) │
│  intel_review_task          — human review queue         │
│  intel_review_decision      — audit trail of decisions   │
│  intel_fact_publication     — published facts (receipts) │
│  intel_fact_source_link     — evidence chain fct↔chunk   │
│  intel_contradiction_alert  — cross-source disagreements │
├─────────────────────────────────────────────────────────┤
│  LAYER 2: Vector / RAG                                  │
│  rag_documents, rag_chunks (vector 768, HNSW index)     │
│  ingest_queue (2,675 files, 1,183 done)                 │
│  Embeddings: Gemini gemini-embedding-001                │
│  Parsing: LlamaParse Premium                            │
│  Reranking: Cohere rerank-v3.5                          │
└─────────────────────────────────────────────────────────┘
```

## Tables Reference

### intel_metric_definition
Canonical catalog of every metric the system tracks. Each metric maps to a specific cell in a fact table. Uses dotted notation: `{PROJECT}.{DOMAIN}.{METRIC}.{DETAIL}`.

**22 metrics seeded** across BHX and MAD, covering capex (EAC, baseline, committed, invoiced, paid, contingency), cash flow (inflow, outflow, net position), and funding (committed, drawn, undrawn).

### intel_doc_authority
Trust hierarchy for documents. Seven tiers from `audited` (score 100) down to `narrative` (score 10). When two documents disagree on the same metric, higher authority wins unless overridden.

| Tier | Score | Examples |
|------|-------|---------|
| audited | 100 | Signed audit reports, certified accounts |
| executed | 90 | Signed contracts, facility agreements |
| controller | 80 | CFO reporting packs, management accounts |
| board_pack | 70 | Board presentations, investor updates |
| dd_memo | 60 | Due diligence memos, advisor reports |
| internal | 40 | Internal emails, meeting notes |
| narrative | 10 | Marketing materials, general docs |

### intel_extraction_run
Batch job tracking for extraction runs. Records documents scanned, candidates created, contradictions found, LLM token usage.

### intel_metric_candidate
The core extraction table. Each row is a value extracted from a document that might be promoted to a fact table. Includes confidence score (0–1), extraction method (llm/regex/manual/formula/hybrid), and status lifecycle: `pending_review → accepted | rejected | superseded | auto_accepted`.

### intel_review_task
Groups related candidates into reviewable units. E.g., "Review 12 CapEx values extracted from BHX Cost Report Q1 2026". Priority-based queue with assignment.

### intel_review_decision
Immutable audit trail. Every accept/reject/defer/override of a candidate is recorded with the decider identity and timestamp.

### intel_fact_publication
Receipt for every write to fact tables. Records published_value, previous_value (for rollback), and full source chain back to candidate → decision → chunk.

### intel_fact_source_link
The critical evidence chain. Links any row in any fct_* table to the rag_chunks that provide evidence. Link types: evidence, corroboration, contradiction, context, superseded.

### intel_contradiction_alert
Raised when two sources disagree on the same metric. Includes computed delta_abs (generated column), severity classification, and resolution tracking.

## Views

| View | Purpose |
|------|---------|
| v_intel_review_queue | Pending review dashboard, ordered by priority |
| v_intel_evidence_coverage | Per-table evidence link statistics |
| v_intel_contradictions_open | Open contradictions with metric names |
| v_intel_candidate_pipeline | Pipeline summary by status/domain/project |

## RPC Functions

| Function | Purpose |
|----------|---------|
| get_fact_evidence(table, row_id) | Get all evidence chunks for a fact row |
| get_metric_candidates(metric_id, period_date?) | Get all candidates for a metric |
| intel_authority_tier_score(tier) | Convert tier name to numeric score |

## Data Flow: Document → KPI

```
1. Document ingested (ingest_queue → LlamaParse → rag_chunks)
2. Extraction run created (intel_extraction_run)
3. LLM reads chunks, matches to metric_definitions
4. Candidates created (intel_metric_candidate) with confidence scores
5. Doc authority assigned (intel_doc_authority)
6. Contradictions detected across candidates for same metric+period
7. Review task created grouping candidates + contradictions
8. Human reviews: accept/reject/override (intel_review_decision)
9. Accepted candidates published to fct_* tables (intel_fact_publication)
10. Source links created (intel_fact_source_link) for evidence trail
11. KPIs now have full provenance: click any number → see the source document
```

## Migration Files

- `sql/003_layer3_evidence_reconciliation.sql` — Full DDL with comments
- Applied as Supabase migrations: `layer3_evidence_reconciliation_tables` + `layer3_views_functions_rls`

## Implementation Status

- [x] Schema designed and applied to Supabase
- [x] 22 canonical metric definitions seeded (BHX + MAD)
- [x] Views and RPC functions deployed
- [x] RLS policies (open, consistent with existing pattern)
- [ ] Extraction Engine (API endpoint that reads chunks → creates candidates)
- [ ] Review UI (Next.js page for human review queue)
- [ ] Auto-publish logic (high-confidence + high-authority → auto_accepted)
- [ ] Contradiction detection engine
- [ ] Evidence panel in fact table views (click a number → see source)

## Date: 2026-04-12
