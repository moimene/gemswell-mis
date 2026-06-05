-- ============================================================================
-- Quality Sanitation — Gemswell MIS documentary RAG
--
-- Purpose:
--   Make document governance semantically honest enough for high-quality chat.
--   This migration does not lock down RLS; it focuses on retrieval quality,
--   parent-document metadata, review defaults, and rule-based authority.
--
-- Principles:
--   - New documents are not approved by default.
--   - Authority is not the same as human review.
--   - Legacy documents get rule-based authority labels but stay needs_review.
--   - RAG search keeps retrieving needs_review docs, but exposes that status.
-- ============================================================================

ALTER TABLE public.rag_documents
  ADD COLUMN IF NOT EXISTS project_id text,
  ADD COLUMN IF NOT EXISTS doc_type text,
  ADD COLUMN IF NOT EXISTS period text;

ALTER TABLE public.rag_documents
  ALTER COLUMN review_status SET DEFAULT 'needs_review',
  ALTER COLUMN classification_source SET DEFAULT 'rule',
  ALTER COLUMN authority_tier SET DEFAULT 'unverified',
  ALTER COLUMN authority_score SET DEFAULT 0,
  ALTER COLUMN md_status SET DEFAULT 'pending';

CREATE INDEX IF NOT EXISTS idx_rag_documents_project_id
  ON public.rag_documents(project_id)
  WHERE project_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rag_documents_doc_type
  ON public.rag_documents(doc_type)
  WHERE doc_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rag_documents_authority_score
  ON public.rag_documents(authority_score);

CREATE INDEX IF NOT EXISTS idx_rag_documents_review_authority
  ON public.rag_documents(review_status, authority_score);

-- Backfill parent document project/doc type/period from the most frequent chunk metadata.
WITH project_mode AS (
  SELECT DISTINCT ON (document_id)
    document_id,
    metadata->>'project_id' AS project_id
  FROM public.rag_chunks
  WHERE metadata ? 'project_id' AND NULLIF(metadata->>'project_id', '') IS NOT NULL
  GROUP BY document_id, metadata->>'project_id'
  ORDER BY document_id, count(*) DESC, metadata->>'project_id'
),
doc_type_mode AS (
  SELECT DISTINCT ON (document_id)
    document_id,
    metadata->>'doc_type' AS doc_type
  FROM public.rag_chunks
  WHERE metadata ? 'doc_type' AND NULLIF(metadata->>'doc_type', '') IS NOT NULL
  GROUP BY document_id, metadata->>'doc_type'
  ORDER BY document_id, count(*) DESC, metadata->>'doc_type'
),
period_mode AS (
  SELECT DISTINCT ON (document_id)
    document_id,
    metadata->>'period' AS period
  FROM public.rag_chunks
  WHERE metadata ? 'period' AND NULLIF(metadata->>'period', '') IS NOT NULL
  GROUP BY document_id, metadata->>'period'
  ORDER BY document_id, count(*) DESC, metadata->>'period'
)
UPDATE public.rag_documents d
SET
  project_id = COALESCE(d.project_id, p.project_id),
  doc_type = COALESCE(d.doc_type, t.doc_type),
  period = COALESCE(d.period, r.period)
FROM project_mode p
FULL OUTER JOIN doc_type_mode t ON t.document_id = p.document_id
FULL OUTER JOIN period_mode r ON r.document_id = COALESCE(p.document_id, t.document_id)
WHERE d.id = COALESCE(p.document_id, t.document_id, r.document_id);

-- Backfill doc_type from title when chunk metadata is absent or too generic.
UPDATE public.rag_documents
SET doc_type = CASE
  WHEN title ~* '(board|minutes|committee|resolution|pack)' THEN 'board'
  WHEN title ~* '(loan|facility|funding|debt|cesce|santander|bbva|caixabank|grant|wmca|equity|shareholder|subscription)' THEN 'funding'
  WHEN title ~* '(capex|procurement|cost|budget|eac)' THEN 'capex'
  WHEN title ~* '(cash[ _-]?flow|runway|treasury|liquidity)' THEN 'cash_flow'
  WHEN title ~* '(business[ _-]?plan|bp[ _-]?model|underwriting|forecast|model)' THEN 'bp_model'
  WHEN title ~* '(accounts|financial statements|trial balance|balance sheet|nominal ledger|aged payables|monthly financial reporting|reporting)' THEN 'financial_statements'
  WHEN title ~* '(tax|vat|hmrc|aeat)' THEN 'tax'
  WHEN title ~* '(kyc|aml|sanction)' THEN 'kyc'
  WHEN title ~* '(due diligence|\\bdd\\b)' THEN 'dd'
  WHEN title ~* '(lease|contract|agreement|docusign|signed|executed|deed|spa|legal|statutory|register)' THEN 'legal'
  WHEN title ~* '(asset|operations|monitoring|maintenance)' THEN 'asset_management'
  ELSE COALESCE(doc_type, 'unknown')
END
WHERE doc_type IS NULL OR doc_type IN ('general', 'unknown', '');

-- Authority is rule-derived, not human review. Keep review_status separate.
UPDATE public.rag_documents
SET
  classification_source = CASE
    WHEN classification_source = 'human' AND review_reason IS NULL THEN 'rule'::classification_source_enum
    ELSE classification_source
  END,
  lifecycle = CASE
    WHEN title ~* '(signed|executed|docusign|complete_with_docusign)' THEN 'executed'::lifecycle_enum
    WHEN title ~* '(audited|annual accounts|statutory accounts)' THEN 'audited'::lifecycle_enum
    WHEN title ~* '(draft|working|model|forecast|budget)' THEN 'working_paper'::lifecycle_enum
    ELSE lifecycle
  END,
  authority_tier = CASE
    WHEN title ~* '(audited|annual accounts|statutory accounts|financial statements)' THEN 'audited'::authority_tier_enum
    WHEN title ~* '(signed|executed|docusign|loan|facility|deed|lease|contract|agreement|spa)' THEN 'executed'::authority_tier_enum
    WHEN title ~* '(board|minutes|committee|resolution|pack)' THEN 'board_pack'::authority_tier_enum
    WHEN title ~* '(monthly financial reporting|reporting|balance sheet|trial balance|nominal ledger|aged payables|cash flow)' THEN 'controller'::authority_tier_enum
    WHEN title ~* '(due diligence|\\bdd\\b|memo)' THEN 'dd_memo'::authority_tier_enum
    WHEN title ~* '(business[ _-]?plan|bp[ _-]?model|underwriting|forecast|budget|model)' THEN 'internal'::authority_tier_enum
    WHEN title ~* '(presentation|narrative|overview)' THEN 'narrative'::authority_tier_enum
    ELSE 'unverified'::authority_tier_enum
  END,
  authority_score = CASE
    WHEN title ~* '(audited|annual accounts|statutory accounts|financial statements)' THEN 92
    WHEN title ~* '(signed|executed|docusign|loan|facility|deed|lease|contract|agreement|spa)' THEN 88
    WHEN title ~* '(board|minutes|committee|resolution|pack)' THEN 82
    WHEN title ~* '(monthly financial reporting|reporting|balance sheet|trial balance|nominal ledger|aged payables|cash flow)' THEN 78
    WHEN title ~* '(due diligence|\\bdd\\b|memo)' THEN 72
    WHEN title ~* '(business[ _-]?plan|bp[ _-]?model|underwriting|forecast|budget|model)' THEN 62
    WHEN title ~* '(presentation|narrative|overview)' THEN 45
    ELSE 0
  END,
  review_status = CASE
    WHEN review_status = 'approved' AND review_reason IS NULL THEN 'needs_review'::review_status_enum
    ELSE review_status
  END,
  review_reason = CASE
    WHEN review_status = 'approved' AND review_reason IS NULL THEN 'quality_sanitation_2026_06_05: legacy corpus requires documentary review before approved/source-of-record treatment'
    ELSE review_reason
  END;

-- Avoid a heavy full-corpus rag_chunks rewrite here. The RPCs below inject live
-- parent-document governance at read time, which is safer for large corpora and
-- keeps later review changes immediately effective.
DROP FUNCTION IF EXISTS public.match_chunks(vector, integer, text, text);

CREATE OR REPLACE FUNCTION public.match_chunks(
  query_embedding vector,
  match_count integer DEFAULT 25,
  filter_project text DEFAULT NULL,
  filter_doc_type text DEFAULT NULL,
  match_threshold double precision DEFAULT 0.18
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  content text,
  metadata jsonb,
  similarity double precision
)
LANGUAGE sql
STABLE
AS $$
  WITH candidates AS MATERIALIZED (
    SELECT
      c.id,
      c.document_id,
      c.content,
      c.metadata,
      d.project_id,
      d.doc_type,
      d.period,
      d.review_status,
      d.classification_source,
      d.authority_tier,
      d.authority_score,
      d.lifecycle,
      d.source_channel,
      d.md_path,
      d.source_hash,
      c.embedding <=> query_embedding AS distance,
      d.created_at
    FROM public.rag_chunks c
    JOIN public.rag_documents d ON d.id = c.document_id
    WHERE d.review_status <> 'rejected'
    ORDER BY c.embedding <=> query_embedding
    LIMIT GREATEST(match_count * 120, 1000)
  )
  SELECT
    candidates.id,
    candidates.document_id,
    candidates.content,
    COALESCE(candidates.metadata, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
      'project_id', COALESCE(candidates.metadata->>'project_id', candidates.project_id),
      'doc_type', COALESCE(candidates.metadata->>'doc_type', candidates.doc_type),
      'period', COALESCE(candidates.metadata->>'period', candidates.period),
      'review_status', candidates.review_status,
      'classification_source', candidates.classification_source,
      'authority_tier', candidates.authority_tier,
      'authority_score', candidates.authority_score,
      'lifecycle', candidates.lifecycle,
      'source_channel', candidates.source_channel,
      'md_path', candidates.md_path,
      'document_source_hash', candidates.source_hash
    )) AS metadata,
    1 - candidates.distance AS similarity
  FROM candidates
  WHERE 1 - candidates.distance >= match_threshold
    AND (filter_project IS NULL OR COALESCE(candidates.metadata->>'project_id', candidates.project_id, '') = filter_project)
    AND (filter_doc_type IS NULL OR COALESCE(candidates.metadata->>'doc_type', candidates.doc_type, '') = filter_doc_type)
  ORDER BY
    candidates.distance ASC,
    candidates.authority_score DESC,
    candidates.created_at DESC
  LIMIT match_count;
$$;

CREATE OR REPLACE FUNCTION public.keyword_search_chunks(
  query_text text,
  filter_project text DEFAULT NULL,
  match_count integer DEFAULT 15
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  content text,
  metadata jsonb,
  rank real
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    c.id,
    c.document_id,
    c.content,
    COALESCE(c.metadata, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
      'project_id', COALESCE(c.metadata->>'project_id', d.project_id),
      'doc_type', COALESCE(c.metadata->>'doc_type', d.doc_type),
      'period', COALESCE(c.metadata->>'period', d.period),
      'review_status', d.review_status,
      'classification_source', d.classification_source,
      'authority_tier', d.authority_tier,
      'authority_score', d.authority_score,
      'lifecycle', d.lifecycle,
      'source_channel', d.source_channel,
      'md_path', d.md_path,
      'document_source_hash', d.source_hash
    )) AS metadata,
    ts_rank_cd(to_tsvector('simple', c.content), plainto_tsquery('simple', query_text)) AS rank
  FROM public.rag_chunks c
  JOIN public.rag_documents d ON d.id = c.document_id
  WHERE d.review_status <> 'rejected'
    AND to_tsvector('simple', c.content) @@ plainto_tsquery('simple', query_text)
    AND (filter_project IS NULL OR COALESCE(c.metadata->>'project_id', d.project_id, '') = filter_project)
  ORDER BY
    rank DESC,
    d.authority_score DESC,
    d.created_at DESC
  LIMIT match_count;
$$;

-- ============================================================================
-- END
-- ============================================================================
