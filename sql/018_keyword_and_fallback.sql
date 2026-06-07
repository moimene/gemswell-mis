-- 018 — keyword_search_chunks: bound aggregate cost (fixes a timeout the sql/016 fallback missed).
--
-- WHY (adversarial review of 016, verified live): 016 kept only content lexemes with df <= 3000 and,
-- when NONE were selective, OR-combined the "rarest 4". But in this topically-homogeneous corpus the
-- rarest-of-an-all-common query are STILL ubiquitous, so that OR matched 40-62% of the corpus and
-- ts_rank_cd breached the 8s PostgREST timeout — reintroducing the silent-empty keyword lane for
-- all-common-term queries (e.g. "resumen general del proyecto de Madrid y Birmingham"). Even the
-- selective path had thin margin: OR of terms with df just under 3000 (soci 2253, publico 2460) ran
-- ~5s. Both verified live.
--
-- FIX (verified live; OR=union is slow, AND=intersection is fast):
--   * Tighten the df ceiling to 1500 (drops the mid-frequency terms that bloated the union).
--   * Cap the selective OR to the 6 RAREST survivors (bounds worst-case union cost).
--   * When NO term is selective, AND-combine the 3 rarest lexemes (a small intersection) instead of
--     OR — `birmingham & resumen & resum` ran in ~220ms vs ~6.3s for the OR form.
-- Measured after this change: every representative query (selective, mixed, all-common) ranks in
-- 0.2-1.0s (was up to an 8s timeout); the Pacto de Socios doc still ranks #1 on keyword. Same RPC
-- signature/return shape; no app change. Rollback: sql/rollback/018_rollback.sql (restores the 016 RPC).

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
  df_ceiling constant integer := 1500; -- term matching > this many chunks is treated as a corpus stopword
  or_cap     constant integer := 6;    -- max selective lexemes OR'd together (bounds union cost)
  and_n      constant integer := 3;    -- when nothing is selective, AND this many rarest lexemes
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
  sel as (  -- selective terms (OR these — precise + bounded), rarest first, capped
    select lexeme from scored where df <= df_ceiling order by df asc limit or_cap
  ),
  fb as (   -- fallback when nothing is selective (AND the rarest few — small intersection, fast)
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
    and c.fts @@ tsq
    and (filter_project is null or coalesce(d.project_id, c.metadata->>'project_id', '') = filter_project)
    and (filter_doc_type is null or coalesce(d.doc_type, c.metadata->>'doc_type', '') = filter_doc_type)
  order by ts_rank_cd(c.fts, tsq) desc
  limit match_count;
end;
$function$;

grant execute on function public.keyword_search_chunks(text, text, integer, text) to authenticated, service_role;

commit;
