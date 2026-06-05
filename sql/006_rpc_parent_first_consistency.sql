-- 006_rpc_parent_first_consistency.sql — idempotent. Supersedes the RPC bodies in 005.
-- Adversarial-review fixes (F1, F3 + consistency):
--   F1: BOTH RPCs resolve doc_type/project_id/period PARENT-first, so reclassifying a
--       document at the rag_documents level propagates to chat retrieval (Plan B contract).
--       Previously match_chunks was chunk-first → parent reclassification was a no-op for
--       vector search (the dominant path) on the 44k+ chunks whose frozen metadata diverges.
--   F3: Trust the PARENT authority (d.authority_score / d.authority_tier) as the governance
--       source of truth. Drop the NULLIF→chunk-authority fallback, which resurrected stale
--       pre-governance chunk authority and made unscored docs look authoritative.
--   + keyword_search_chunks gains jsonb_strip_nulls (was emitting explicit nulls that armed a
--     fail-open default in the chat) and a filter_doc_type parameter (filtering moves into SQL,
--     on the same canonical value as match_chunks, instead of a divergent app-side post-filter).
--   + both exclude classification_source='agent_rejected' at the SQL boundary (defense in depth).

-- match_chunks: parent-first, trust-parent-authority.
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
      'project_id', COALESCE(d.project_id, c.metadata->>'project_id'),
      'doc_type', COALESCE(d.doc_type, c.metadata->>'doc_type'),
      'period', COALESCE(d.period, c.metadata->>'period'),
      'review_status', d.review_status,
      'classification_source', d.classification_source,
      'authority_tier', d.authority_tier,
      'authority_score', d.authority_score,
      'lifecycle', d.lifecycle,
      'source_channel', d.source_channel,
      'md_path', d.md_path,
      'document_source_hash', d.source_hash
    )) AS metadata,
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

-- keyword_search_chunks: replace the 3-arg with a 4-arg (adds filter_doc_type), parent-first,
-- jsonb_strip_nulls, trust-parent-authority, agent_rejected exclusion.
DROP FUNCTION IF EXISTS public.keyword_search_chunks(text, text, integer);

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
    COALESCE(c.metadata, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
      'project_id', COALESCE(d.project_id, c.metadata->>'project_id'),
      'doc_type', COALESCE(d.doc_type, c.metadata->>'doc_type'),
      'period', COALESCE(d.period, c.metadata->>'period'),
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
    AND d.classification_source IS DISTINCT FROM 'agent_rejected'
    AND d.status = 'indexed'
    AND to_tsvector('simple', c.content) @@ plainto_tsquery('simple', query_text)
    AND (filter_project IS NULL OR COALESCE(d.project_id, c.metadata->>'project_id', '') = filter_project)
    AND (filter_doc_type IS NULL OR COALESCE(d.doc_type, c.metadata->>'doc_type', '') = filter_doc_type)
  ORDER BY rank DESC
  LIMIT match_count;
$$;
