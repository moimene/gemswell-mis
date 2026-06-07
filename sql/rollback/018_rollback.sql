-- Rollback for sql/018 — restores the sql/016 keyword_search_chunks (df<=3000, uncapped OR, OR-rarest-4
-- fallback). WARNING: this reintroduces the all-common-term keyword timeout that 018 fixes. Prefer
-- fix-forward. (To remove the whole feature, use sql/rollback/016_rollback.sql.)

begin;

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
  df_ceiling constant integer := 3000;
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
  selective as (
    select lexeme from scored where df <= df_ceiling
  ),
  chosen as (
    select lexeme from selective
    union all
    select lexeme from (select lexeme from scored order by df asc limit 4) r
    where not exists (select 1 from selective)
  )
  select nullif(string_agg(distinct lexeme, ' | '), '')::tsquery into tsq from chosen;

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
           'document_source_hash',  d.source_hash) as metadata,
    ts_rank_cd(c.fts, tsq) as rank
  from public.rag_chunks c
  join public.rag_documents d on d.id = c.document_id
  where d.review_status <> 'rejected'
    and d.classification_source is distinct from 'agent_rejected'
    and d.status = 'indexed'
    and c.fts @@ tsq
    and (filter_project is null or coalesce(d.project_id, c.metadata->>'project_id', '') = filter_project)
    and (filter_doc_type is null or coalesce(d.doc_type, c.metadata->>'doc_type', '') = filter_doc_type)
  order by ts_rank_cd(c.fts, tsq) desc
  limit match_count;
end;
$function$;

grant execute on function public.keyword_search_chunks(text, text, integer, text) to authenticated, service_role;

commit;
