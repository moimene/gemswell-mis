-- 015 — match_chunks recall fix (Codex CX-3), supersedes the two-stage post-filter from 014.
--
-- WHY: 014 took a GLOBAL bare-table HNSW top-N and applied project_id/doc_type filters OUTSIDE it.
-- For a narrow project/doc_type query, relevant chunks ranked outside the global top-N were invisible
-- — measured: KLP returned only 2 chunks under 014, vs 10 with iterative scan. pgvector 0.8 supports
-- HNSW ITERATIVE SCAN, which keeps walking the graph until enough rows pass the WHERE filter, so the
-- filters can live INSIDE the index-ordered scan and recall is correct for small projects too.
--
-- This managed Postgres denies `SET hnsw.iterative_scan` in a function's SET clause (restricted GUC),
-- but `set_config('hnsw.iterative_scan', …, true)` IS permitted at runtime (verified for both postgres
-- and service_role). So the function is plpgsql and sets the GUC transaction-locally before the query.
-- Validated read-only under force_generic_plan + all-bind-params (PostgREST's exact condition):
-- index-served, MAD ~35ms, KLP recall restored.
--
-- Inner query is pure-distance ordered (the only form the HNSW index serves); trust ordering
-- (authority, recency) is applied in the OUTER query over the filtered candidate set.
-- Rollback: re-apply sql/014 for the post-filter version, or sql/rollback/014_rollback_pre.sql for pre-014.

begin;

create or replace function public.match_chunks(
  query_embedding vector,
  match_count integer default 25,
  filter_project text default null,
  filter_doc_type text default null,
  match_threshold double precision default 0.18
) returns table(id uuid, document_id uuid, content text, metadata jsonb, similarity double precision)
language plpgsql
stable
as $function$
begin
  -- transaction-local: keep the HNSW graph walking until match_count filtered rows are found
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
           'document_source_hash', v.source_hash) as metadata,
    1 - v.dist as similarity
  from (
    select c.id, c.document_id, c.content, c.metadata, c.embedding <=> query_embedding as dist,
           d.project_id, d.doc_type, d.period, d.review_status, d.classification_source,
           d.authority_tier, d.authority_score, d.lifecycle, d.source_channel, d.md_path, d.source_hash,
           d.created_at
    from public.rag_chunks c
    join public.rag_documents d on d.id = c.document_id
    where d.review_status <> 'rejected'
      and d.classification_source is distinct from 'agent_rejected'
      and d.status = 'indexed'
      and 1 - (c.embedding <=> query_embedding) >= match_threshold
      and (filter_project is null or coalesce(d.project_id, c.metadata->>'project_id', '') = filter_project)
      and (filter_doc_type is null or coalesce(d.doc_type, c.metadata->>'doc_type', '') = filter_doc_type)
    order by c.embedding <=> query_embedding
    limit match_count
  ) v
  order by v.dist asc, v.authority_score desc nulls last, v.created_at desc
  limit match_count;
end;
$function$;

grant execute on function public.match_chunks(vector, integer, text, text, double precision) to authenticated, service_role;

commit;
