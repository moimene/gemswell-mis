-- ROLLBACK snapshot captured domingo,  7 de junio de 2026, 08:29:58 CEST before sql/014 (match_chunks + keyword_search_chunks retrieval fix)
CREATE OR REPLACE FUNCTION public.match_chunks(query_embedding vector, match_count integer DEFAULT 25, filter_project text DEFAULT NULL::text, filter_doc_type text DEFAULT NULL::text, match_threshold double precision DEFAULT 0.18)
 RETURNS TABLE(id uuid, document_id uuid, content text, metadata jsonb, similarity double precision)
 LANGUAGE sql
 STABLE
AS $function$
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
$function$
;
CREATE OR REPLACE FUNCTION public.keyword_search_chunks(query_text text, filter_project text DEFAULT NULL::text, match_count integer DEFAULT 15, filter_doc_type text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, document_id uuid, content text, metadata jsonb, rank real)
 LANGUAGE sql
 STABLE
AS $function$
  with q as (
    select (plainto_tsquery('spanish', unaccent(query_text))
         || plainto_tsquery('english', unaccent(query_text))) as tsq
  )
  select c.id, c.document_id, c.content,
    coalesce(c.metadata, '{}'::jsonb)
      || jsonb_strip_nulls(jsonb_build_object(
           'project_id', coalesce(d.project_id, c.metadata->>'project_id'),
           'doc_type',   coalesce(d.doc_type,   c.metadata->>'doc_type'),
           'period',     coalesce(d.period,     c.metadata->>'period')))
      || jsonb_build_object(
           'review_status', d.review_status, 'classification_source', d.classification_source,
           'authority_tier', d.authority_tier, 'authority_score', d.authority_score,
           'lifecycle', d.lifecycle, 'source_channel', d.source_channel,
           'md_path', d.md_path, 'document_source_hash', d.source_hash) as metadata,
    ts_rank_cd(c.fts, q.tsq) as rank
  from public.rag_chunks c
  join public.rag_documents d on d.id = c.document_id
  cross join q
  where d.review_status <> 'rejected'
    and d.classification_source is distinct from 'agent_rejected'
    and d.status = 'indexed'
    and c.fts @@ q.tsq
    and (filter_project is null or coalesce(d.project_id, c.metadata->>'project_id', '') = filter_project)
    and (filter_doc_type is null or coalesce(d.doc_type, c.metadata->>'doc_type', '') = filter_doc_type)
  order by rank desc
  limit match_count;
$function$
;
