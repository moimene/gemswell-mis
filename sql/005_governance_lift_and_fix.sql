-- 005_governance_lift_and_fix.sql — DDL only, idempotent.
-- Data backfill lives in scripts/backfill-governance.ts.
-- Plan: docs/superpowers/plans/2026-06-05-corpus-gobernado-foundation.md (Task 4)

-- 1. New defaults for FUTURE inserts (existing rows untouched).
ALTER TABLE public.rag_documents ALTER COLUMN review_status SET DEFAULT 'needs_review';
ALTER TABLE public.rag_documents ALTER COLUMN classification_source SET DEFAULT 'agent_auto';

-- 2. Enrichment columns (maximize info surfaced to the chat).
ALTER TABLE public.rag_documents
  ADD COLUMN IF NOT EXISTS summary text,
  ADD COLUMN IF NOT EXISTS topics text[],
  ADD COLUMN IF NOT EXISTS currency text,
  ADD COLUMN IF NOT EXISTS entity_ids text[];

-- 3. Append-only governance audit trail.
CREATE TABLE IF NOT EXISTS public.rag_document_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.rag_documents(id) ON DELETE CASCADE,
  action text NOT NULL,
  field text,
  old_value text,
  new_value text,
  actor text NOT NULL DEFAULT 'system',
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rag_document_events_document_id
  ON public.rag_document_events(document_id);
ALTER TABLE public.rag_document_events ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY open_all ON public.rag_document_events FOR ALL TO public USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4. Rewrite match_chunks as a SINGLE 5-arg function (unified with a concurrent change
--    that added match_threshold + authority-aware ordering). Drops the legacy 4-arg overload
--    to remove the "function is not unique" ambiguity that broke the chat RPC.
--    Adds: NULLIF un-shadow of real chunk authority (authority_score has DEFAULT 0), and
--    status='indexed' exclusion (retired docs). Applied as migration unify_match_chunks_threshold_governance.
DROP FUNCTION IF EXISTS public.match_chunks(vector, integer, text, text);

CREATE OR REPLACE FUNCTION public.match_chunks(
  query_embedding vector,
  match_count integer DEFAULT 25,
  filter_project text DEFAULT NULL,
  filter_doc_type text DEFAULT NULL,
  match_threshold double precision DEFAULT 0.18
)
RETURNS TABLE (id uuid, document_id uuid, content text, metadata jsonb, similarity double precision)
LANGUAGE sql STABLE AS $$
  SELECT
    c.id, c.document_id, c.content,
    COALESCE(c.metadata, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
      'project_id', COALESCE(c.metadata->>'project_id', d.project_id),
      'doc_type', COALESCE(c.metadata->>'doc_type', d.doc_type),
      'period', COALESCE(c.metadata->>'period', d.period),
      'review_status', d.review_status,
      'classification_source', d.classification_source,
      'authority_tier', COALESCE(NULLIF(d.authority_tier::text,'unverified'), c.metadata->>'authority_tier'),
      'authority_score', COALESCE(NULLIF(d.authority_score,0), NULLIF(c.metadata->>'authority','')::int),
      'lifecycle', d.lifecycle,
      'source_channel', d.source_channel,
      'md_path', d.md_path,
      'document_source_hash', d.source_hash
    )) AS metadata,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM public.rag_chunks c
  JOIN public.rag_documents d ON d.id = c.document_id
  WHERE d.review_status <> 'rejected'
    AND d.status = 'indexed'
    AND 1 - (c.embedding <=> query_embedding) >= match_threshold
    AND (filter_project IS NULL OR COALESCE(c.metadata->>'project_id', d.project_id, '') = filter_project)
    AND (filter_doc_type IS NULL OR COALESCE(c.metadata->>'doc_type', d.doc_type, '') = filter_doc_type)
  ORDER BY (c.embedding <=> query_embedding) ASC, d.authority_score DESC, d.created_at DESC
  LIMIT match_count;
$$;

-- 5. Same governance + exclusion for keyword search.
CREATE OR REPLACE FUNCTION public.keyword_search_chunks(
  query_text text,
  filter_project text DEFAULT NULL,
  match_count integer DEFAULT 15
)
RETURNS TABLE (id uuid, document_id uuid, content text, metadata jsonb, rank real)
LANGUAGE sql STABLE AS $$
  SELECT
    c.id, c.document_id, c.content,
    COALESCE(c.metadata, '{}'::jsonb) || jsonb_build_object(
      'review_status', d.review_status,
      'classification_source', d.classification_source,
      'authority_tier', COALESCE(NULLIF(d.authority_tier::text,'unverified'), c.metadata->>'authority_tier'),
      'authority_score', COALESCE(NULLIF(d.authority_score,0), NULLIF(c.metadata->>'authority','')::int),
      'lifecycle', d.lifecycle,
      'doc_type', COALESCE(d.doc_type, c.metadata->>'doc_type'),
      'project_id', COALESCE(d.project_id, c.metadata->>'project_id'),
      'source_channel', d.source_channel,
      'md_path', d.md_path,
      'document_source_hash', d.source_hash
    ) AS metadata,
    ts_rank_cd(to_tsvector('simple', c.content), plainto_tsquery('simple', query_text)) AS rank
  FROM public.rag_chunks c
  JOIN public.rag_documents d ON d.id = c.document_id
  WHERE d.review_status <> 'rejected'
    AND d.status = 'indexed'
    AND to_tsvector('simple', c.content) @@ plainto_tsquery('simple', query_text)
    AND (filter_project IS NULL OR COALESCE(d.project_id, c.metadata->>'project_id', '') = filter_project)
  ORDER BY rank DESC
  LIMIT match_count;
$$;
