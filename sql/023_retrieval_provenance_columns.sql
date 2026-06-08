-- 023 — UNIFIED retrieval-RPC recreation (ÚNICO DUEÑO DE RPC — the ONLY migration after 019 that
-- recreates match_chunks / keyword_search_chunks). Charter guardrail #1: body is VERBATIM from sql/019
-- (HNSW iterative scan + df-aware keyword + lifecycle<>'superseded' filter) — the ONLY change is that the
-- returned `metadata` jsonb now also carries chunk_index + storage_path, so the original file can be opened
-- and a citation ordered (Fase 5 WS5-T5/T6). `page` is NOT re-emitted here: it already flows through
-- coalesce(metadata,…) (WS2-T4 stamps it into the chunk's own metadata jsonb), and a (metadata->>'page')::int
-- cast would THROW at query time on a non-numeric value — so it was deliberately removed.
--
-- DESIGN CHOICE (conservative): we surface the 3 fields INSIDE the existing `metadata` jsonb instead of
-- adding return COLUMNS. This keeps the function SIGNATURE / RETURNS TABLE shape IDENTICAL to 019, so:
--   * `create or replace` works (adding OUT columns would force a DROP+CREATE — higher risk, brief
--     dependency churn, and "cannot change return type" foot-guns);
--   * PostgREST/clients are fully backward-compatible (extra jsonb keys are ignored by old code);
--   * the plan §2 already says "page viaja en metadata jsonb (no necesita columna)" — we extend that to
--     chunk_index + storage_path. `page` already flowed through coalesce(v.metadata,…) once WS2-T4 stamped
--     it; here it is surfaced explicitly+typed so retrieve.ts reads it uniformly across both lanes.
--
-- VERBATIM-FROM-019 INVARIANT (do not drift): the WHERE clauses, the HNSW set_config, the df_ceiling/or_cap/
-- and_n keyword logic, ordering, limits, grants and signatures are copied char-for-char from sql/019. Only
-- the jsonb_build_object override gains 'chunk_index','storage_path'. If 019 ever changes, re-copy.
--
-- RISK: high (it recreates the retrieval RPCs). NET (charter §"Mutación autónoma de prod" step 1): apply
-- first in a Supabase BRANCH, EXPLAIN ANALYZE via the real supabase-js client (index-served <100ms on MAD
-- and KLP for match_chunks; keyword <1s), confirm 7 superseded docs / 369 chunks still return 0 rows, THEN
-- Ronda 2, THEN prod, THEN re-verify live with AUTO-ROLLBACK on regression (seq-scan / timeout / wrong rows).
-- Rollback: sql/rollback/023_rollback.sql (restores the exact 019 bodies).

begin;

-- ── match_chunks (vector) — sql/019 body + chunk_index/page/storage_path in metadata ─────────────────
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
           'document_source_hash', v.source_hash,
           'chunk_index',          v.chunk_index,
           'storage_path',         v.storage_path) as metadata,
    -- NOTE: `page` is NOT re-emitted here — it already flows through coalesce(v.metadata,…) (WS2-T4 stamps
    -- it into the chunk's own metadata jsonb). Re-casting (metadata->>'page')::int would THROW at query
    -- time on any non-numeric page value and break retrieval; chunk_index/storage_path are added because
    -- they are real columns NOT present in the chunk metadata jsonb.
    1 - v.dist as similarity
  from (
    select c.id, c.document_id, c.content, c.metadata, c.chunk_index, c.embedding <=> query_embedding as dist,
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
    order by c.embedding <=> query_embedding
    limit match_count
  ) v
  order by v.dist asc, v.authority_score desc nulls last, v.created_at desc
  limit match_count;
end;
$function$;

grant execute on function public.match_chunks(vector, integer, text, text, double precision) to authenticated, service_role;

-- ── keyword_search_chunks (FTS) — sql/019 body + chunk_index/page/storage_path in metadata ───────────
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
           'document_source_hash',  d.source_hash,
           'chunk_index',           c.chunk_index,
           'storage_path',          d.storage_path) as metadata,  -- page already flows via coalesce(c.metadata,…); no ::int cast (would throw on non-numeric)
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
