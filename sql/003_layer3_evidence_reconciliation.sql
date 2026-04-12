-- ============================================================================
-- LAYER 3: Evidence & Reconciliation Layer
-- Migration 003 — Gemswell MIS
--
-- Purpose: Bridge the gap between unstructured documents (Layer 2/RAG) and
-- structured fact tables (Layer 1/MIS) with full audit trail, authority
-- ranking, contradiction detection, and human-in-the-loop review.
--
-- Tables created:
--   intel_metric_definition     — Canonical metric catalog
--   intel_doc_authority         — Document authority/trust ranking
--   intel_metric_candidate      — Extracted values from documents
--   intel_review_task           — Human review queue
--   intel_review_decision       — Audit trail of accept/reject
--   intel_fact_publication      — Promoted facts in fct_* tables
--   intel_fact_source_link      — Evidence chain: fct row ↔ rag_chunk
--   intel_contradiction_alert   — Cross-source disagreements
--   intel_extraction_run        — Batch extraction job tracking
--
-- Author: Gemswell MIS / Claude
-- Date: 2026-04-12
-- ============================================================================

-- ─── 1. METRIC DEFINITION CATALOG ─────────────────────────────────────
-- Canonical definitions of every metric the system tracks.
-- Each metric has a domain (capex, cash, funding, commercial, covenant),
-- a target table/column where it publishes, and validation rules.

CREATE TABLE IF NOT EXISTS intel_metric_definition (
  id              text PRIMARY KEY,                  -- e.g. 'BHX.capex.eac.civil_works'
  display_name    text NOT NULL,                     -- 'BHX CapEx EAC — Civil Works'
  domain          text NOT NULL                      -- capex | cash_flow | funding | commercial | covenant | risk
                  CHECK (domain IN ('capex','cash_flow','funding','commercial','covenant','risk','general')),
  project_id      text,                              -- FK dim_project (NULL = cross-project)

  -- Target: where does this metric publish?
  target_table    text NOT NULL,                     -- 'fct_capex_snapshot'
  target_column   text NOT NULL,                     -- 'eac'
  target_filter   jsonb DEFAULT '{}',                -- {"capex_category_id":"civil_works"} — row-level filter

  -- Validation
  unit            text DEFAULT 'EUR',                -- EUR | GBP | pct | count | date | text
  min_value       numeric,                           -- sanity floor
  max_value       numeric,                           -- sanity ceiling
  precision_dp    integer DEFAULT 2,                 -- decimal places

  -- Extraction hints for LLM
  extraction_hint text,                              -- 'Look for EAC or Estimate at Completion in CapEx tables'
  synonyms        text[],                            -- {'EAC', 'estimate at completion', 'presupuesto final'}

  -- Lifecycle
  is_active       boolean DEFAULT true,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

COMMENT ON TABLE intel_metric_definition IS 'Canonical catalog of every metric the MIS tracks. Each metric maps to a specific cell in a fact table.';


-- ─── 2. DOCUMENT AUTHORITY RANKING ────────────────────────────────────
-- Establishes trust hierarchy for documents.
-- When two documents disagree on the same metric, the higher-authority
-- document wins (unless overridden by human review).
--
-- Authority tiers (highest → lowest):
--   1. audited       — Signed audit reports, certified accounts
--   2. executed      — Signed contracts, facility agreements, board resolutions
--   3. controller    — Controller/CFO reporting packs, management accounts
--   4. board_pack    — Board presentation materials, investor updates
--   5. dd_memo       — Due diligence memos, advisor reports
--   6. internal      — Internal emails, meeting notes, working papers
--   7. narrative     — Marketing materials, descriptions, general docs

CREATE TABLE IF NOT EXISTS intel_doc_authority (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  rag_document_id uuid REFERENCES rag_documents(id),       -- link to indexed document
  mis_document_id uuid,                                      -- link to mis_documents if exists
  ingest_queue_id uuid,                                      -- link to ingest_queue if bulk-ingested

  -- Authority classification
  authority_tier  text NOT NULL DEFAULT 'narrative'
                  CHECK (authority_tier IN (
                    'audited','executed','controller','board_pack',
                    'dd_memo','internal','narrative'
                  )),
  authority_score integer NOT NULL DEFAULT 10                -- numeric score: audited=100, executed=90, controller=80, etc.
                  CHECK (authority_score BETWEEN 1 AND 100),

  -- Document metadata for reconciliation
  document_date   date,                                      -- effective date of the document
  period_covered  text,                                      -- 'Q1 2026', 'FY2025', '2026-W14'
  project_id      text,                                      -- BHX | MAD | NULL
  domain          text,                                      -- capex | cash_flow | funding | etc.

  -- Override
  authority_override_by   text,                              -- user who manually upgraded/downgraded
  authority_override_note text,

  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_doc_authority_rag ON intel_doc_authority(rag_document_id);
CREATE INDEX idx_doc_authority_project ON intel_doc_authority(project_id, domain);

COMMENT ON TABLE intel_doc_authority IS 'Trust ranking for documents. Higher authority wins when sources conflict on the same metric.';


-- ─── 3. EXTRACTION RUN TRACKING ───────────────────────────────────────
-- Each time the system extracts metrics from documents, it creates a run.
-- This enables batch processing, retry logic, and audit of what was extracted when.

CREATE TABLE IF NOT EXISTS intel_extraction_run (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Scope
  trigger_type    text NOT NULL DEFAULT 'manual'
                  CHECK (trigger_type IN ('manual','scheduled','on_ingest','backfill')),
  project_id      text,                              -- NULL = all projects
  domain          text,                              -- NULL = all domains

  -- Documents processed
  documents_scanned  integer DEFAULT 0,
  candidates_created integer DEFAULT 0,
  contradictions_found integer DEFAULT 0,

  -- Status
  status          text NOT NULL DEFAULT 'running'
                  CHECK (status IN ('running','completed','failed','cancelled')),
  started_at      timestamptz DEFAULT now(),
  completed_at    timestamptz,
  error_message   text,

  -- LLM usage tracking
  llm_model       text,                              -- 'claude-sonnet-4-20250514'
  prompt_tokens   integer DEFAULT 0,
  completion_tokens integer DEFAULT 0,

  created_at      timestamptz DEFAULT now()
);

COMMENT ON TABLE intel_extraction_run IS 'Tracks each batch extraction job. Links to candidates and contradictions produced.';


-- ─── 4. METRIC CANDIDATE ──────────────────────────────────────────────
-- The core extraction table. Each row is a value extracted from a document
-- that *might* be promoted to a fact table. Until reviewed, it's a candidate.
--
-- Lifecycle: extracted → pending_review → accepted | rejected | superseded

CREATE TABLE IF NOT EXISTS intel_metric_candidate (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- What metric is this?
  metric_id       text NOT NULL REFERENCES intel_metric_definition(id),

  -- Where did it come from?
  extraction_run_id uuid REFERENCES intel_extraction_run(id),
  rag_document_id uuid REFERENCES rag_documents(id),
  rag_chunk_id    uuid REFERENCES rag_chunks(id),            -- specific chunk
  doc_authority_id uuid REFERENCES intel_doc_authority(id),

  -- The extracted value
  extracted_value numeric,                            -- numeric value (NULL if text-only)
  extracted_text  text,                               -- raw text as extracted
  extracted_date  date,                               -- if metric is a date
  period_label    text,                               -- 'Q1 2026', '2026-W14', 'FY2025'
  period_date     date,                               -- normalized period end date
  currency        text DEFAULT 'EUR',

  -- Extraction quality
  confidence      numeric(4,3) NOT NULL DEFAULT 0.5   -- 0.000–1.000, LLM self-assessed
                  CHECK (confidence BETWEEN 0 AND 1),
  extraction_method text DEFAULT 'llm'                -- llm | regex | manual | formula
                  CHECK (extraction_method IN ('llm','regex','manual','formula','hybrid')),
  context_snippet text,                               -- surrounding text for human review

  -- Reconciliation
  authority_score integer,                            -- copied from doc_authority at extraction time
  is_latest       boolean DEFAULT true,               -- false if superseded by newer extraction
  superseded_by   uuid,                               -- FK to newer candidate for same metric+period

  -- Status
  status          text NOT NULL DEFAULT 'pending_review'
                  CHECK (status IN ('pending_review','accepted','rejected','superseded','auto_accepted')),

  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_candidate_metric ON intel_metric_candidate(metric_id, period_date);
CREATE INDEX idx_candidate_status ON intel_metric_candidate(status) WHERE status = 'pending_review';
CREATE INDEX idx_candidate_doc ON intel_metric_candidate(rag_document_id);
CREATE INDEX idx_candidate_run ON intel_metric_candidate(extraction_run_id);

COMMENT ON TABLE intel_metric_candidate IS 'Extracted metric values awaiting human review. The bridge between unstructured documents and structured fact tables.';


-- ─── 5. REVIEW TASK ───────────────────────────────────────────────────
-- Groups related candidates into reviewable units.
-- E.g., "Review 12 CapEx values extracted from BHX Cost Report Q1 2026"

CREATE TABLE IF NOT EXISTS intel_review_task (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Scope
  title           text NOT NULL,                     -- 'Review BHX CapEx extractions — Q1 2026'
  description     text,
  domain          text,
  project_id      text,
  period_label    text,

  -- Source
  extraction_run_id uuid REFERENCES intel_extraction_run(id),
  candidate_count integer DEFAULT 0,
  contradiction_count integer DEFAULT 0,

  -- Assignment
  assigned_to     text,                              -- user email or role
  priority        text DEFAULT 'normal'
                  CHECK (priority IN ('critical','high','normal','low')),
  due_date        date,

  -- Status
  status          text NOT NULL DEFAULT 'open'
                  CHECK (status IN ('open','in_progress','completed','cancelled')),
  completed_at    timestamptz,
  completed_by    text,

  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_review_task_status ON intel_review_task(status) WHERE status IN ('open','in_progress');

COMMENT ON TABLE intel_review_task IS 'Grouped review units for human-in-the-loop validation of extracted metrics.';


-- ─── 6. REVIEW DECISION ──────────────────────────────────────────────
-- Immutable audit trail. Every accept/reject of a candidate is recorded.
-- Even if a decision is later reversed, the original record persists.

CREATE TABLE IF NOT EXISTS intel_review_decision (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),

  review_task_id  uuid REFERENCES intel_review_task(id),
  candidate_id    uuid NOT NULL REFERENCES intel_metric_candidate(id),

  -- Decision
  decision        text NOT NULL
                  CHECK (decision IN ('accept','reject','defer','override')),
  override_value  numeric,                           -- if decision = 'override', the corrected value
  override_reason text,

  -- Who decided
  decided_by      text NOT NULL,                     -- user email or 'system:auto_accept'
  decided_at      timestamptz DEFAULT now(),

  -- Resulting publication (if accepted)
  publication_id  uuid,                              -- FK to intel_fact_publication, set after publish

  created_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_decision_candidate ON intel_review_decision(candidate_id);
CREATE INDEX idx_decision_task ON intel_review_decision(review_task_id);

COMMENT ON TABLE intel_review_decision IS 'Immutable audit trail of every accept/reject/override decision on metric candidates.';


-- ─── 7. FACT PUBLICATION ──────────────────────────────────────────────
-- Records every write to a fact table that originated from Layer 3.
-- This is the "receipt" that proves a fact row came from a specific
-- document, was reviewed by a specific person, and published at a
-- specific time. Enables full rollback.

CREATE TABLE IF NOT EXISTS intel_fact_publication (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- What was published
  target_table    text NOT NULL,                     -- 'fct_capex_snapshot'
  target_row_id   uuid NOT NULL,                     -- PK of the row in the target table
  target_column   text NOT NULL,                     -- 'eac'

  -- Value
  published_value numeric,
  previous_value  numeric,                           -- for rollback

  -- Source chain
  candidate_id    uuid REFERENCES intel_metric_candidate(id),
  decision_id     uuid REFERENCES intel_review_decision(id),
  metric_id       text REFERENCES intel_metric_definition(id),

  -- Audit
  published_by    text NOT NULL,                     -- user or 'system:auto_publish'
  published_at    timestamptz DEFAULT now(),

  -- Rollback
  is_rolled_back  boolean DEFAULT false,
  rolled_back_by  text,
  rolled_back_at  timestamptz,
  rollback_reason text,

  created_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_publication_target ON intel_fact_publication(target_table, target_row_id);
CREATE INDEX idx_publication_metric ON intel_fact_publication(metric_id);

COMMENT ON TABLE intel_fact_publication IS 'Receipt for every write to fact tables from Layer 3. Enables full audit trail and rollback.';


-- ─── 8. FACT ↔ SOURCE LINK (Evidence Chain) ──────────────────────────
-- The critical bridge table. Links any row in any fact table to the
-- rag_chunks that provide evidence for it. Multiple chunks can support
-- one fact (corroboration), and one chunk can support multiple facts.
--
-- This replaces the loose `source_file` text column with proper FKs.

CREATE TABLE IF NOT EXISTS intel_fact_source_link (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Fact side (polymorphic: works with any fct_* table)
  fact_table      text NOT NULL,                     -- 'fct_capex_snapshot'
  fact_row_id     uuid NOT NULL,                     -- PK of the fact row
  fact_column     text,                              -- specific column, or NULL for whole-row

  -- Source side
  rag_chunk_id    uuid NOT NULL REFERENCES rag_chunks(id),
  rag_document_id uuid REFERENCES rag_documents(id),

  -- Relationship
  link_type       text NOT NULL DEFAULT 'evidence'
                  CHECK (link_type IN (
                    'evidence',          -- chunk directly supports this fact value
                    'corroboration',     -- chunk confirms a value from another source
                    'contradiction',     -- chunk contradicts this fact value
                    'context',           -- chunk provides context but not the value itself
                    'superseded'         -- chunk was evidence but has been replaced
                  )),

  -- Quality
  confidence      numeric(4,3) DEFAULT 0.8,
  authority_score integer,                           -- from doc_authority at link time

  -- Extraction metadata
  extracted_text  text,                              -- the specific text from the chunk
  extraction_run_id uuid REFERENCES intel_extraction_run(id),

  created_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_source_link_fact ON intel_fact_source_link(fact_table, fact_row_id);
CREATE INDEX idx_source_link_chunk ON intel_fact_source_link(rag_chunk_id);
CREATE INDEX idx_source_link_type ON intel_fact_source_link(link_type) WHERE link_type = 'contradiction';

COMMENT ON TABLE intel_fact_source_link IS 'Evidence chain linking fact table rows to the RAG chunks that support them. The core bridge between Layer 1 and Layer 2.';


-- ─── 9. CONTRADICTION ALERT ──────────────────────────────────────────
-- Raised when two or more sources disagree on the same metric for the
-- same period. Requires human resolution.

CREATE TABLE IF NOT EXISTS intel_contradiction_alert (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- What metric is in dispute?
  metric_id       text NOT NULL REFERENCES intel_metric_definition(id),
  period_label    text,
  period_date     date,
  project_id      text,

  -- The competing candidates
  candidate_a_id  uuid NOT NULL REFERENCES intel_metric_candidate(id),
  candidate_b_id  uuid NOT NULL REFERENCES intel_metric_candidate(id),

  -- Values in conflict
  value_a         numeric,
  value_b         numeric,
  delta_abs       numeric GENERATED ALWAYS AS (ABS(COALESCE(value_a,0) - COALESCE(value_b,0))) STORED,
  delta_pct       numeric,                           -- computed at creation: |a-b|/max(|a|,|b|)

  -- Authority comparison
  authority_a     integer,                           -- score of source A
  authority_b     integer,                           -- score of source B

  -- Severity
  severity        text NOT NULL DEFAULT 'medium'
                  CHECK (severity IN ('critical','high','medium','low')),

  -- Resolution
  status          text NOT NULL DEFAULT 'open'
                  CHECK (status IN ('open','investigating','resolved','dismissed')),
  resolution      text,                              -- 'accept_a' | 'accept_b' | 'manual_override' | 'dismissed'
  resolution_note text,
  resolved_by     text,
  resolved_at     timestamptz,

  -- Grouping
  review_task_id  uuid REFERENCES intel_review_task(id),
  extraction_run_id uuid REFERENCES intel_extraction_run(id),

  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_contradiction_status ON intel_contradiction_alert(status) WHERE status IN ('open','investigating');
CREATE INDEX idx_contradiction_metric ON intel_contradiction_alert(metric_id, period_date);
CREATE INDEX idx_contradiction_severity ON intel_contradiction_alert(severity) WHERE status = 'open';

COMMENT ON TABLE intel_contradiction_alert IS 'Raised when two sources disagree on the same metric. Requires human resolution via review task.';


-- ─── 10. HELPER VIEWS ─────────────────────────────────────────────────

-- View: Pending review dashboard
CREATE OR REPLACE VIEW v_intel_review_queue AS
SELECT
  rt.id AS task_id,
  rt.title,
  rt.priority,
  rt.domain,
  rt.project_id,
  rt.period_label,
  rt.status AS task_status,
  rt.candidate_count,
  rt.contradiction_count,
  rt.assigned_to,
  rt.due_date,
  rt.created_at
FROM intel_review_task rt
WHERE rt.status IN ('open', 'in_progress')
ORDER BY
  CASE rt.priority
    WHEN 'critical' THEN 1
    WHEN 'high' THEN 2
    WHEN 'normal' THEN 3
    WHEN 'low' THEN 4
  END,
  rt.created_at ASC;

-- View: Fact evidence coverage — shows which fct rows have source links
CREATE OR REPLACE VIEW v_intel_evidence_coverage AS
SELECT
  fsl.fact_table,
  COUNT(DISTINCT fsl.fact_row_id) AS rows_with_evidence,
  COUNT(fsl.id) AS total_links,
  COUNT(fsl.id) FILTER (WHERE fsl.link_type = 'evidence') AS evidence_links,
  COUNT(fsl.id) FILTER (WHERE fsl.link_type = 'contradiction') AS contradiction_links,
  AVG(fsl.confidence) AS avg_confidence,
  AVG(fsl.authority_score) AS avg_authority
FROM intel_fact_source_link fsl
GROUP BY fsl.fact_table;

-- View: Open contradictions summary
CREATE OR REPLACE VIEW v_intel_contradictions_open AS
SELECT
  ca.id,
  ca.severity,
  md.display_name AS metric_name,
  ca.project_id,
  ca.period_label,
  ca.value_a,
  ca.value_b,
  ca.delta_abs,
  ca.delta_pct,
  ca.authority_a,
  ca.authority_b,
  ca.status,
  ca.created_at
FROM intel_contradiction_alert ca
JOIN intel_metric_definition md ON md.id = ca.metric_id
WHERE ca.status IN ('open', 'investigating')
ORDER BY
  CASE ca.severity
    WHEN 'critical' THEN 1
    WHEN 'high' THEN 2
    WHEN 'medium' THEN 3
    WHEN 'low' THEN 4
  END,
  ca.delta_abs DESC;

-- View: Metric candidate pipeline
CREATE OR REPLACE VIEW v_intel_candidate_pipeline AS
SELECT
  mc.status,
  md.domain,
  md.project_id,
  COUNT(*) AS candidate_count,
  AVG(mc.confidence) AS avg_confidence,
  COUNT(*) FILTER (WHERE mc.confidence >= 0.8) AS high_confidence,
  COUNT(*) FILTER (WHERE mc.confidence < 0.5) AS low_confidence
FROM intel_metric_candidate mc
JOIN intel_metric_definition md ON md.id = mc.metric_id
GROUP BY mc.status, md.domain, md.project_id;


-- ─── 11. RPC FUNCTIONS ────────────────────────────────────────────────

-- Function: Get evidence for a specific fact row
CREATE OR REPLACE FUNCTION get_fact_evidence(
  p_fact_table text,
  p_fact_row_id uuid
)
RETURNS TABLE (
  link_id uuid,
  link_type text,
  confidence numeric,
  authority_score integer,
  extracted_text text,
  chunk_content text,
  document_title text,
  rag_document_id uuid
)
LANGUAGE sql STABLE
AS $$
  SELECT
    fsl.id,
    fsl.link_type,
    fsl.confidence,
    fsl.authority_score,
    fsl.extracted_text,
    rc.content,
    rd.title,
    rd.id
  FROM intel_fact_source_link fsl
  JOIN rag_chunks rc ON rc.id = fsl.rag_chunk_id
  JOIN rag_documents rd ON rd.id = fsl.rag_document_id
  WHERE fsl.fact_table = p_fact_table
    AND fsl.fact_row_id = p_fact_row_id
  ORDER BY fsl.authority_score DESC NULLS LAST, fsl.confidence DESC;
$$;

-- Function: Get candidates for a metric + period
CREATE OR REPLACE FUNCTION get_metric_candidates(
  p_metric_id text,
  p_period_date date DEFAULT NULL
)
RETURNS TABLE (
  candidate_id uuid,
  extracted_value numeric,
  extracted_text text,
  confidence numeric,
  authority_score integer,
  status text,
  document_title text,
  authority_tier text,
  period_label text,
  created_at timestamptz
)
LANGUAGE sql STABLE
AS $$
  SELECT
    mc.id,
    mc.extracted_value,
    mc.extracted_text,
    mc.confidence,
    mc.authority_score,
    mc.status,
    rd.title,
    da.authority_tier,
    mc.period_label,
    mc.created_at
  FROM intel_metric_candidate mc
  JOIN rag_documents rd ON rd.id = mc.rag_document_id
  LEFT JOIN intel_doc_authority da ON da.id = mc.doc_authority_id
  WHERE mc.metric_id = p_metric_id
    AND (p_period_date IS NULL OR mc.period_date = p_period_date)
  ORDER BY mc.authority_score DESC NULLS LAST, mc.confidence DESC;
$$;


-- ─── 12. SEED: Authority Score Defaults ───────────────────────────────
-- Lookup function for converting authority_tier to numeric score

CREATE OR REPLACE FUNCTION intel_authority_tier_score(tier text)
RETURNS integer
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE tier
    WHEN 'audited'     THEN 100
    WHEN 'executed'    THEN 90
    WHEN 'controller'  THEN 80
    WHEN 'board_pack'  THEN 70
    WHEN 'dd_memo'     THEN 60
    WHEN 'internal'    THEN 40
    WHEN 'narrative'   THEN 10
    ELSE 10
  END;
$$;


-- ─── 13. ROW LEVEL SECURITY ──────────────────────────────────────────
-- Open RLS for now (consistent with existing Gemswell MIS pattern).
-- Will be tightened when auth layer is properly implemented.

ALTER TABLE intel_metric_definition ENABLE ROW LEVEL SECURITY;
ALTER TABLE intel_doc_authority ENABLE ROW LEVEL SECURITY;
ALTER TABLE intel_extraction_run ENABLE ROW LEVEL SECURITY;
ALTER TABLE intel_metric_candidate ENABLE ROW LEVEL SECURITY;
ALTER TABLE intel_review_task ENABLE ROW LEVEL SECURITY;
ALTER TABLE intel_review_decision ENABLE ROW LEVEL SECURITY;
ALTER TABLE intel_fact_publication ENABLE ROW LEVEL SECURITY;
ALTER TABLE intel_fact_source_link ENABLE ROW LEVEL SECURITY;
ALTER TABLE intel_contradiction_alert ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on intel_metric_definition" ON intel_metric_definition FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on intel_doc_authority" ON intel_doc_authority FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on intel_extraction_run" ON intel_extraction_run FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on intel_metric_candidate" ON intel_metric_candidate FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on intel_review_task" ON intel_review_task FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on intel_review_decision" ON intel_review_decision FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on intel_fact_publication" ON intel_fact_publication FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on intel_fact_source_link" ON intel_fact_source_link FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on intel_contradiction_alert" ON intel_contradiction_alert FOR ALL USING (true) WITH CHECK (true);


-- ============================================================================
-- END MIGRATION 003
-- ============================================================================
