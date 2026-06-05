-- 012_dual_language_fts.sql — Spec C (applied as `dual_language_fts`, 2026-06-05).
--
-- Problem: keyword_search_chunks recomputed to_tsvector('simple', content) inline (no stemming,
-- no unaccent) and NEVER used the rag_chunks.fts column / GIN index → seqscan + no ES/EN stemming.
-- Also only ~32% of rows had fts populated (the column was unused so it never mattered).
--
-- Fix: dual-language, accent-insensitive fts (spanish || english, unaccent), and rewrite
-- keyword_search_chunks to USE c.fts (GIN-indexed). Governance filters (parent-first, status='indexed',
-- exclude rejected/agent_rejected) unchanged.
--
-- A full backfill of rag_chunks.fts (156,898 rows) follows this migration (scripts/backfill-fts.ts via a
-- temporary backfill_fts_batch() RPC; the GIN index idx_rag_chunks_fts is dropped during the backfill
-- and recreated after). Required: with the new RPC using c.fts, rows with NULL fts are invisible to
-- keyword search until backfilled.

create extension if not exists unaccent;

create or replace function rag_chunks_fts_update() returns trigger language plpgsql as $$
begin
  new.fts := to_tsvector('spanish', unaccent(coalesce(new.content, '')))
          || to_tsvector('english', unaccent(coalesce(new.content, '')));
  return new;
end;
$$;

create or replace function keyword_search_chunks(
  query_text text, filter_project text default null, match_count integer default 15, filter_doc_type text default null
) returns table(id uuid, document_id uuid, content text, metadata jsonb, rank real)
language sql stable as $$
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
$$;

-- Post-migration backfill (run once, then drop scaffolding):
--   alter table rag_chunks add column if not exists fts_done boolean not null default false;
--   drop index if exists idx_rag_chunks_fts;
--   -- loop scripts/backfill-fts.ts (calls backfill_fts_batch) until 0 remaining
--   create index idx_rag_chunks_fts on rag_chunks using gin(fts);
--   alter table rag_chunks drop column fts_done;
--   drop function backfill_fts_batch(integer);
