-- Optimize provider-aware vector retrieval.
--
-- The previous migration used coalesce(c.embedding_model, c.metadata->>'embedding_model', ...)
-- in the WHERE clause. On the live corpus that caused scoped vector searches to hit statement
-- timeouts when combined with project filters. sql/025 backfilled rag_chunks.embedding_model
-- to 0 nulls, so the RPC can safely filter on the column directly.

create or replace function public.match_chunks(
  query_embedding vector,
  match_count integer default 25,
  filter_project text default null,
  filter_doc_type text default null,
  match_threshold double precision default 0.18,
  filter_embedding_model text default null
) returns table(id uuid, document_id uuid, content text, metadata jsonb, similarity double precision)
language plpgsql
stable
as $function$
begin
  perform set_config('hnsw.iterative_scan', 'relaxed_order', true);
  perform set_config('hnsw.ef_search', '100', true);

  return query
  select
    v.id,
    v.document_id,
    v.content,
    coalesce(v.metadata, '{}'::jsonb)
      || jsonb_strip_nulls(jsonb_build_object(
           'project_id', coalesce(v.project_id, v.metadata->>'project_id'),
           'doc_type',   coalesce(v.doc_type,   v.metadata->>'doc_type'),
           'period',     coalesce(v.period,     v.metadata->>'period')))
      || jsonb_build_object(
           'review_status',        v.review_status,
           'classification_source', v.classification_source,
           'authority_tier',       v.authority_tier,
           'authority_score',      v.authority_score,
           'lifecycle',            v.lifecycle,
           'source_channel',       v.source_channel,
           'md_path',              v.md_path,
           'document_source_hash', v.source_hash,
           'chunk_index',          v.chunk_index,
           'storage_path',         v.storage_path,
           'embedding_model',      v.embedding_model) as metadata,
    1 - v.dist as similarity
  from (
    select c.id, c.document_id, c.content, c.metadata, c.chunk_index, c.embedding_model,
           c.embedding <=> query_embedding as dist,
           d.project_id, d.doc_type, d.period, d.review_status, d.classification_source,
           d.authority_tier, d.authority_score, d.lifecycle, d.source_channel, d.md_path, d.source_hash,
           d.storage_path, d.created_at
    from public.rag_chunks c
    join public.rag_documents d on d.id = c.document_id
    where d.review_status <> 'rejected'
      and d.classification_source is distinct from 'agent_rejected'
      and d.status = 'indexed'
      and d.lifecycle is distinct from 'superseded'
      and 1 - (c.embedding <=> query_embedding) >= match_threshold
      and (filter_project is null or coalesce(d.project_id, c.metadata->>'project_id', '') = filter_project)
      and (filter_doc_type is null or coalesce(d.doc_type, c.metadata->>'doc_type', '') = filter_doc_type)
      and (filter_embedding_model is null or c.embedding_model = filter_embedding_model)
    order by c.embedding <=> query_embedding
    limit match_count
  ) v
  order by v.dist asc, v.authority_score desc nulls last, v.created_at desc
  limit match_count;
end;
$function$;

grant execute on function public.match_chunks(vector, integer, text, text, double precision, text) to authenticated, service_role;
