-- 014 — Retrieval RPC fix: make match_chunks index-served via PostgREST, broaden keyword recall.
--
-- WHY (found by live verification, 2026-06-07):
--   The chat calls these RPCs through supabase-js → PostgREST, which passes EVERY argument as a
--   bind parameter (including `LIMIT $2`) and reuses prepared statements → PostgreSQL switches to a
--   GENERIC plan. The old match_chunks ordered by `(embedding <=> q) ASC, authority DESC, created DESC`
--   across the rag_documents JOIN; under a generic plan with a bind-param LIMIT the planner abandons
--   the HNSW index and SEQ-SCANS all 156,898 vectors (~47s), which PostgREST's ~8s statement_timeout
--   kills → the documentary chat silently retrieved NOTHING via vector. (Proven: identical call is
--   1–440ms in psql with a literal/constant, but times out via supabase-js.)
--   keyword_search_chunks used plainto_tsquery, which ANDs every term → a 4-word natural-language
--   query required all 4 lemmas in one chunk → 0 results.
--
-- FIX:
--   1) match_chunks → two-stage. The inner query is a BARE-TABLE `ORDER BY embedding <=> q LIMIT n`
--      (no join, no secondary keys) which the HNSW index ALWAYS serves — verified to stay index-served
--      even under force_generic_plan + all-bind-params (483ms). Document-level filters + the secondary
--      trust ordering are applied in the OUTER query over the small candidate set. `SET hnsw.ef_search`
--      widens the candidate pool so post-filtering keeps good recall, and also makes the function
--      non-inlinable (further isolating it from PostgREST's generic plan).
--   2) keyword_search_chunks → OR semantics: AND-combine of plainto is turned into OR by rewriting the
--      sanitised tsquery's `&` to `|` (lexemes already sanitised by plainto, so this is safe). Precision
--      is restored downstream by the Cohere reranker + trust-tier ordering (the pool is meant to be
--      reranked). Rollback snapshot: sql/rollback/014_rollback_pre.sql.

begin;

create or replace function public.match_chunks(
  query_embedding vector,
  match_count integer default 25,
  filter_project text default null,
  filter_doc_type text default null,
  match_threshold double precision default 0.18
) returns table(id uuid, document_id uuid, content text, metadata jsonb, similarity double precision)
language sql
stable
set hnsw.ef_search = 250
as $function$
  select
    v.id,
    v.document_id,
    v.content,
    coalesce(v.metadata, '{}'::jsonb)
      || jsonb_strip_nulls(jsonb_build_object(
           'project_id', coalesce(d.project_id, v.metadata->>'project_id'),
           'doc_type',   coalesce(d.doc_type,   v.metadata->>'doc_type'),
           'period',     coalesce(d.period,     v.metadata->>'period')))
      || jsonb_build_object(
           'review_status',        d.review_status,
           'classification_source', d.classification_source,
           'authority_tier',       d.authority_tier,
           'authority_score',      d.authority_score,
           'lifecycle',            d.lifecycle,
           'source_channel',       d.source_channel,
           'md_path',              d.md_path,
           'document_source_hash', d.source_hash) as metadata,
    1 - v.dist as similarity
  from (
    -- bare-table HNSW top-N (always index-served, even under PostgREST generic plans)
    select c.id, c.document_id, c.content, c.metadata, c.embedding <=> query_embedding as dist
    from public.rag_chunks c
    order by c.embedding <=> query_embedding
    limit least(greatest(match_count * 10, 150), 250)
  ) v
  join public.rag_documents d on d.id = v.document_id
  where d.review_status <> 'rejected'
    and d.classification_source is distinct from 'agent_rejected'
    and d.status = 'indexed'
    and 1 - v.dist >= match_threshold
    and (filter_project is null or coalesce(d.project_id, v.metadata->>'project_id', '') = filter_project)
    and (filter_doc_type is null or coalesce(d.doc_type, v.metadata->>'doc_type', '') = filter_doc_type)
  order by v.dist asc, d.authority_score desc, d.created_at desc
  limit match_count;
$function$;

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
    -- OR-combine terms (broad recall; precision handled by the downstream Cohere reranker).
    -- plainto_tsquery already sanitises lexemes, so rewriting its '&' to '|' is safe.
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

-- Preserve the post-013 grants (CREATE OR REPLACE keeps them, but be explicit).
grant execute on function public.match_chunks(vector, integer, text, text, double precision) to authenticated, service_role;
grant execute on function public.keyword_search_chunks(text, text, integer, text) to authenticated, service_role;

commit;
