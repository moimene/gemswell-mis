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

-- NOTE ON APPLICATION: the backfill is a 156,898-row UPDATE. Applying the whole thing inside one HTTP
-- request to the Supabase Management API times out the socket (the transaction then rolls back cleanly).
-- So apply in fast steps: (1) add column, (2) set default, then (3) backfill in batches until 0 nulls.
-- The steps below are written as one transcript; run the backfill batched (see run log) if via the API.

-- (1) + (2): instant DDL — add the column and a default so NEW rows are labelled too (one model today;
-- a future model change is a deliberate Fase 8 migration that updates the default + the insert together).
alter table public.rag_chunks
  add column if not exists embedding_model text;

alter table public.rag_chunks
  alter column embedding_model set default 'gemini-embedding-001';

comment on column public.rag_chunks.embedding_model is
  'Embedding model that produced this chunk vector (e.g. gemini-embedding-001). Never mix incompatible models in one retrieval corpus — Fase 8 convergence pin.';

-- (3) Backfill: every existing vector was produced by gemini-embedding-001. Prefer the value already
-- stamped in metadata when present, else the constant. BATCH this over the API (30k/iteration) to stay
-- within the HTTP window; a single statement is fine over a direct psql connection.
update public.rag_chunks
  set embedding_model = coalesce(nullif(metadata->>'embedding_model', ''), 'gemini-embedding-001')
  where embedding_model is null;

-- Optional follow-up once 0 nulls confirmed: alter column embedding_model set not null;
