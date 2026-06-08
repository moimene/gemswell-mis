-- Rollback for sql/023 — restores the EXACT sql/019 bodies of match_chunks + keyword_search_chunks
-- (verbatim, without the chunk_index/page/storage_path additions to the metadata jsonb). Same signatures,
-- so `create or replace` reverts cleanly. Superseded filter and HNSW/df-aware behavior are preserved.

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
      and d.lifecycle is distinct from 'superseded'
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

create or replace function public.keyword_search_chunks(
  query_text text,
  filter_project text default null,
  match_count integer default 15,
  filter_doc_type text default null
) returns table(id uuid, document_id uuid, content text, metadata jsonb, rank real)
language plpgsql
stable
as $function$
declare
  tsq tsquery;
  df_ceiling constant integer := 1500;
  or_cap     constant integer := 6;
  and_n      constant integer := 3;
begin
  with toks as (
    select distinct tok
    from unnest(regexp_split_to_array(lower(unaccent(coalesce(query_text, ''))), '[^a-z0-9]+')) tok
    where length(tok) >= 3
  ),
  content as (
    select tok from toks
    where to_tsvector('spanish', tok) <> '' and to_tsvector('english', tok) <> ''
  ),
  lex as (
    select distinct l as lexeme
    from content,
      lateral unnest(tsvector_to_array(to_tsvector('spanish', tok)) || tsvector_to_array(to_tsvector('english', tok))) l
  ),
  scored as (
    select lex.lexeme, coalesce(d.df, 0) as df
    from lex left join public.rag_term_df d using (lexeme)
  ),
  sel as (
    select lexeme from scored where df <= df_ceiling order by df asc limit or_cap
  ),
  fb as (
    select lexeme from scored order by df asc limit and_n
  )
  select (
    case when exists (select 1 from sel)
      then (select string_agg(lexeme, ' | ') from sel)
      else (select string_agg(lexeme, ' & ') from fb)
    end
  )::tsquery into tsq;

  if tsq is null then
    return;
  end if;

  return query
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
           'review_status',         d.review_status,
           'classification_source', d.classification_source,
           'authority_tier',        d.authority_tier,
           'authority_score',       d.authority_score,
           'lifecycle',             d.lifecycle,
           'source_channel',        d.source_channel,
           'md_path',               d.md_path,
           'document_source_hash',  d.source_hash) as metadata,
    ts_rank_cd(c.fts, tsq) as rank
  from public.rag_chunks c
  join public.rag_documents d on d.id = c.document_id
  where d.review_status <> 'rejected'
    and d.classification_source is distinct from 'agent_rejected'
    and d.status = 'indexed'
    and d.lifecycle is distinct from 'superseded'
    and c.fts @@ tsq
    and (filter_project is null or coalesce(d.project_id, c.metadata->>'project_id', '') = filter_project)
    and (filter_doc_type is null or coalesce(d.doc_type, c.metadata->>'doc_type', '') = filter_doc_type)
  order by ts_rank_cd(c.fts, tsq) desc
  limit match_count;
end;
$function$;

grant execute on function public.keyword_search_chunks(text, text, integer, text) to authenticated, service_role;

commit;
