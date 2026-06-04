-- ============================================================================
-- Knowledge Convergence Governance — Gemswell MIS
--
-- Purpose:
--   Adds canonical document governance fields to rag_documents and updates
--   document search RPCs so chunk retrieval receives live parent-document
--   review and authority metadata.
--
-- Notes:
--   - This file is idempotent and intended for Supabase SQL review before use.
--   - It does not remove the existing chunk metadata contract.
--   - Rejected parent documents are excluded at RPC level.
-- ============================================================================

DO $$
BEGIN
  CREATE TYPE classification_source_enum AS ENUM (
    'human',
    'rule',
    'agent_auto',
    'agent_reviewed',
    'agent_corrected',
    'agent_rejected'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE review_status_enum AS ENUM (
    'pending',
    'approved',
    'rejected',
    'needs_review'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE lifecycle_enum AS ENUM (
    'draft',
    'signed',
    'executed',
    'filed',
    'audited',
    'working_paper',
    'superseded',
    'unknown'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE authority_tier_enum AS ENUM (
    'audited',
    'executed',
    'controller',
    'board_pack',
    'dd_memo',
    'internal',
    'narrative',
    'unverified'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.rag_documents
  ADD COLUMN IF NOT EXISTS source_hash text,
  ADD COLUMN IF NOT EXISTS source_channel text DEFAULT 'manual_admin',
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS external_thread_id text,
  ADD COLUMN IF NOT EXISTS storage_path text,
  ADD COLUMN IF NOT EXISTS md_path text,
  ADD COLUMN IF NOT EXISTS classification_source classification_source_enum DEFAULT 'human',
  ADD COLUMN IF NOT EXISTS review_status review_status_enum DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS lifecycle lifecycle_enum DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS authority_tier authority_tier_enum DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS authority_score integer DEFAULT 0 CHECK (authority_score BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS classification_confidence numeric(4,3) DEFAULT 1.0 CHECK (classification_confidence BETWEEN 0 AND 1),
  ADD COLUMN IF NOT EXISTS review_reason text,
  ADD COLUMN IF NOT EXISTS md_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS current_version integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS supersedes_document_id uuid REFERENCES public.rag_documents(id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_rag_documents_source_hash
  ON public.rag_documents(source_hash)
  WHERE source_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rag_documents_review_status
  ON public.rag_documents(review_status);

CREATE INDEX IF NOT EXISTS idx_rag_documents_source_channel
  ON public.rag_documents(source_channel);

CREATE INDEX IF NOT EXISTS idx_rag_documents_supersedes
  ON public.rag_documents(supersedes_document_id)
  WHERE supersedes_document_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rag_chunks_fts_simple
  ON public.rag_chunks
  USING gin (to_tsvector('simple', content));

CREATE INDEX IF NOT EXISTS idx_rag_chunks_metadata_project_id
  ON public.rag_chunks ((metadata->>'project_id'));

CREATE INDEX IF NOT EXISTS idx_rag_chunks_metadata_doc_type
  ON public.rag_chunks ((metadata->>'doc_type'));

CREATE OR REPLACE FUNCTION public.match_chunks(
  query_embedding vector,
  match_count integer DEFAULT 25,
  filter_project text DEFAULT NULL,
  filter_doc_type text DEFAULT NULL
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
  SELECT
    c.id,
    c.document_id,
    c.content,
    COALESCE(c.metadata, '{}'::jsonb) || jsonb_build_object(
      'review_status', d.review_status,
      'classification_source', d.classification_source,
      'authority_tier', d.authority_tier,
      'authority_score', d.authority_score,
      'lifecycle', d.lifecycle,
      'source_channel', d.source_channel,
      'md_path', d.md_path,
      'document_source_hash', d.source_hash
    ) AS metadata,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM public.rag_chunks c
  JOIN public.rag_documents d ON d.id = c.document_id
  WHERE d.review_status <> 'rejected'
    AND (filter_project IS NULL OR COALESCE(c.metadata->>'project_id', '') = filter_project)
    AND (filter_doc_type IS NULL OR COALESCE(c.metadata->>'doc_type', '') = filter_doc_type)
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Keep the keyword RPC aligned with vector search governance.
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
    COALESCE(c.metadata, '{}'::jsonb) || jsonb_build_object(
      'review_status', d.review_status,
      'classification_source', d.classification_source,
      'authority_tier', d.authority_tier,
      'authority_score', d.authority_score,
      'lifecycle', d.lifecycle,
      'source_channel', d.source_channel,
      'md_path', d.md_path,
      'document_source_hash', d.source_hash
    ) AS metadata,
    ts_rank_cd(to_tsvector('simple', c.content), plainto_tsquery('simple', query_text)) AS rank
  FROM public.rag_chunks c
  JOIN public.rag_documents d ON d.id = c.document_id
  WHERE d.review_status <> 'rejected'
    AND to_tsvector('simple', c.content) @@ plainto_tsquery('simple', query_text)
    AND (filter_project IS NULL OR COALESCE(c.metadata->>'project_id', '') = filter_project)
  ORDER BY rank DESC
  LIMIT match_count;
$$;

-- ============================================================================
-- END
-- ============================================================================
