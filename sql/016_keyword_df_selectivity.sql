-- 016 — keyword_search_chunks selectivity fix (df-aware term selection).
--
-- WHY (found by the live Tier-A retrieval eval, 2026-06-07 — only live measurement caught it):
--   sql/014 OR-combined plainto_tsquery('spanish',q) with plainto_tsquery('english',q) over the SAME
--   text. plainto_tsquery('english', <Spanish text>) keeps Spanish stopwords ('de','el','que','en','se')
--   as lexemes, so the OR tsquery became e.g. 'pact'|'soci'|...|'de'|'el'|'que' and matched
--   96,835 / 156,898 chunks (62% of the corpus). ts_rank_cd over ~97k rows took 6–15s; on the PostgREST
--   path the `authenticator` role's statement_timeout=8s KILLED it (service_role inherits it because
--   SET ROLE does not re-apply role config) → supabase-js errored → retrieve.ts swallowed it → the
--   keyword lane silently returned [] for EVERY multi-word question. The chat had been VECTOR-ONLY for
--   real queries, at ~8.8s latency. (Same class as the sql/014/015 vector-timeout bug.)
--
-- FIX — build the tsquery from CONTENT lexemes only and drop UBIQUITOUS terms by document frequency:
--   1) tokenise the query; keep tokens that are content words in BOTH languages (drops cross-language
--      stopwords de/el/que/the/of and <3-char tokens), stem in both ('spanish' || 'english').
--   2) look up each lexeme's corpus document-frequency in rag_term_df and keep only SELECTIVE lexemes
--      (df <= ceiling). This corpus is topically homogeneous, so the project terms are effectively
--      stopwords (surf 39,616 · madr 27,649 · park · play · wave · gemswell · birmingham) while the
--      discriminating terms are rare (pact 715 · apoder 495 · covenant 36 · headroom 13 · balance 8).
--      Numbers / IDs (e.g. a company number) survive as rare lexemes — good for exact-cite questions.
--   3) if NOTHING is selective enough, fall back to the rarest few lexemes so a meaningful query never
--      returns empty purely because all its words happen to be common.
--   4) OR-combine survivors, rank by ts_rank_cd. Final precision is finished downstream by the Cohere
--      reranker + trust-tier ordering (the pool is meant to be reranked).
--
-- VALIDATED on live data via pg_temp before this migration: candidate sets dropped from ~97k to a few k;
-- latency 0.3–3.1s (was an 8s timeout); recall restored (the Pacto de Socios doc ranks #1 on keyword).
-- SAME signature + return shape as sql/014 → no application change required.
-- Rollback: sql/rollback/016_rollback.sql (restores the sql/014 OR RPC and drops rag_term_df).

begin;

-- ── Corpus term document-frequency (selectivity oracle) ──────────────
-- Snapshot via ts_stat. Refresh after a bulk ingest (stale df only mildly shifts term selection; an
-- unknown/new lexeme defaults to df=0 = treated as rare = kept, which is the correct bias).
create table if not exists public.rag_term_df (
  lexeme text primary key,
  df integer not null
);

-- Locked down like the rest of the corpus (post-013): no anon access; the chat reads it via the
-- SECURITY INVOKER RPC as service_role (which bypasses RLS). Non-sensitive, but kept consistent.
alter table public.rag_term_df enable row level security;
revoke all on public.rag_term_df from anon;
grant select on public.rag_term_df to service_role;

-- (Re)populate from the current corpus.
truncate public.rag_term_df;
insert into public.rag_term_df (lexeme, df)
  select word, ndoc from ts_stat('select fts from public.rag_chunks');

-- ── keyword_search_chunks (df-selective) ─────────────────────────────
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
  -- df ceiling: a term matching more than this many chunks is treated as a corpus stopword and dropped.
  -- ~1.9% of 156,898 chunks. Tune up if recall feels too tight after a much larger ingest.
  df_ceiling constant integer := 3000;
begin
  with toks as (
    select distinct tok
    from unnest(regexp_split_to_array(lower(unaccent(coalesce(query_text, ''))), '[^a-z0-9]+')) tok
    where length(tok) >= 3
  ),
  content as (
    -- content word in BOTH languages → drops cross-language stopwords (de/el/que/the/of/is...)
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
    -- fallback: nothing selective → keep the 4 rarest content lexemes so we never go empty needlessly
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
