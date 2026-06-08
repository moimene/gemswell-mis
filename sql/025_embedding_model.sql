-- 025 — embedding provenance: rag_chunks.embedding_model (audit A8 / Fase 3/8 convergence pin).
--
-- WHY: the MDL/Teras convergence (Fase 8 WS7-T1) hinges on never mixing vectors from incompatible
-- embedding models in one corpus. Today every Gemswell vector is `gemini-embedding-001` (768d) but that
-- is implicit. This column makes it explicit + queryable so a future model change (or a shared corpus)
-- can be gated on it. New ingests already stamp `embedding_model` into rag_chunks.metadata jsonb
-- (queue-processor baseMetadata); this column is the canonical, indexable copy.
--
-- RISK: medium — it is an additive column, but the backfill is an UPDATE over 156,898 rows. The column
-- add is instant (no rewrite, nullable). The backfill is a single constant UPDATE; run it in one shot
-- off-peak, or batch by id range if lock duration is a concern. No RPC is touched (this is NOT the
-- único-dueño-de-RPC migration). Fully reversible: drop the column.
--
-- APPLY (with the charter net): branch-probe not required (additive + constant backfill, no query-plan
-- change). Verify live AFTER: `select embedding_model, count(*) from rag_chunks group by 1` → all
-- 'gemini-embedding-001'. Rollback: sql/rollback/025_rollback.sql.

begin;

alter table public.rag_chunks
  add column if not exists embedding_model text;

-- Backfill: every existing vector was produced by gemini-embedding-001 (the only model this app has used;
-- legacy 156,898 + new). Prefer the value already stamped in metadata when present, else the constant.
update public.rag_chunks
  set embedding_model = coalesce(nullif(metadata->>'embedding_model', ''), 'gemini-embedding-001')
  where embedding_model is null;

comment on column public.rag_chunks.embedding_model is
  'Embedding model that produced this chunk vector (e.g. gemini-embedding-001). Never mix incompatible models in one retrieval corpus — Fase 8 convergence pin.';

commit;

-- Optional follow-up (run separately once values are confirmed) — enforce going forward:
--   alter table public.rag_chunks alter column embedding_model set default 'gemini-embedding-001';
--   alter table public.rag_chunks alter column embedding_model set not null;  -- only after 0 nulls
