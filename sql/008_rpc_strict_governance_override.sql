-- 008_rpc_strict_governance_override.sql — idempotent. Supersedes the RPC bodies in 006.
-- Codex pass-2 finding CX-1: jsonb_strip_nulls(...) was removing null governance overrides from
-- the right-hand side of the `||`, leaving stale chunk-side governance (review_status,
-- authority_score, classification_source...) frozen in c.metadata visible to the chat. Fix:
-- two-stage merge — strip_nulls only for the reconcilable fields (project_id/doc_type/period
-- where chunk-fallback is desired); governance fields are always parent-only, even when null,
-- so they overwrite any stale chunk metadata. NULL → fail-closed (source-reference defaults
-- review_status to 'needs_review', authority null → 'unverified').

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
    COALESCE(c.metadata, '{}'::jsonb)
      || jsonb_strip_nulls(jsonb_build_object(
           'project_id', COALESCE(d.project_id, c.metadata->>'project_id'),
           'doc_type',   COALESCE(d.doc_type,   c.metadata->>'doc_type'),
           'period',     COALESCE(d.period,     c.metadata->>'period')
         ))
      || jsonb_build_object(
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
    AND d.classification_source IS DISTINCT FROM 'agent_rejected'
    AND d.status = 'indexed'
    AND 1 - (c.embedding <=> query_embedding) >= match_threshold
    AND (filter_project IS NULL OR COALESCE(d.project_id, c.metadata->>'project_id', '') = filter_project)
    AND (filter_doc_type IS NULL OR COALESCE(d.doc_type, c.metadata->>'doc_type', '') = filter_doc_type)
  ORDER BY (c.embedding <=> query_embedding) ASC, d.authority_score DESC, d.created_at DESC
  LIMIT match_count;
$$;

CREATE OR REPLACE FUNCTION public.keyword_search_chunks(
  query_text text,
  filter_project text DEFAULT NULL,
  match_count integer DEFAULT 15,
  filter_doc_type text DEFAULT NULL
)
RETURNS TABLE (id uuid, document_id uuid, content text, metadata jsonb, rank real)
LANGUAGE sql STABLE AS $$
  SELECT
    c.id, c.document_id, c.content,
    COALESCE(c.metadata, '{}'::jsonb)
      || jsonb_strip_nulls(jsonb_build_object(
           'project_id', COALESCE(d.project_id, c.metadata->>'project_id'),
           'doc_type',   COALESCE(d.doc_type,   c.metadata->>'doc_type'),
           'period',     COALESCE(d.period,     c.metadata->>'period')
         ))
      || jsonb_build_object(
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
    AND d.classification_source IS DISTINCT FROM 'agent_rejected'
    AND d.status = 'indexed'
    AND to_tsvector('simple', c.content) @@ plainto_tsquery('simple', query_text)
    AND (filter_project IS NULL OR COALESCE(d.project_id, c.metadata->>'project_id', '') = filter_project)
    AND (filter_doc_type IS NULL OR COALESCE(d.doc_type, c.metadata->>'doc_type', '') = filter_doc_type)
  ORDER BY rank DESC
  LIMIT match_count;
$$;
