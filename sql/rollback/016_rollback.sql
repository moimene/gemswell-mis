-- Rollback for sql/016 — restores the sql/014 OR-semantics keyword_search_chunks and drops rag_term_df.
-- WARNING: this re-introduces the keyword-lane timeout (the reason 016 exists). Prefer fix-forward.

begin;

create or replace function public.keyword_search_chunks(
  query_text text,
  filter_project text default null,
  match_count integer default 15,
  filter_doc_type text default null
) returns table(id uuid, document_id uuid, content text, metadata jsonb, rank real)
language sql
stable
as $function$
  with q as (
    select (
      replace(plainto_tsquery('spanish', unaccent(query_text))::text, '&', '|')::tsquery
      || replace(plainto_tsquery('english', unaccent(query_text))::text, '&', '|')::tsquery
    ) as tsq
  )
  select
    c.id,
    c.document_id,
    c.content,
    coalesce(c.metadata, '{}'::jsonb)
      || jsonb_strip_nulls(jsonb_build_object(
           'project_id', coalesce(d.project_id, c.metadata->>'project_id'),
           'doc_type',   coalesce(d.doc_type,   c.metadata->>'doc_type'),
           'period',     coalesce(d.period,     c.metadata->>'period')))
      || jsonb_build_object(
           'review_status',        d.review_status,
           'classification_source', d.classification_source,
           'authority_tier',       d.authority_tier,
           'authority_score',      d.authority_score,
           'lifecycle',            d.lifecycle,
           'source_channel',       d.source_channel,
           'md_path',              d.md_path,
           'document_source_hash', d.source_hash) as metadata,
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
$function$;

grant execute on function public.keyword_search_chunks(text, text, integer, text) to authenticated, service_role;

drop table if exists public.rag_term_df;

commit;
