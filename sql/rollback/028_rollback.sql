-- Rollback for sql/028 — drop the content_hash dedup index + column.
-- Safe + reversible: dropping the column loses only the dedup key (recomputable from chunk content by
-- scripts/dedup-legacy-corpus.mjs). Drop the index first (PHASE 2) in case it was created; CONCURRENTLY
-- so it never blocks, and outside a transaction. The column drop (PHASE 1 undo) is transactional.

-- PHASE 2 undo (index) — no-op if PHASE 2 was never applied.
drop index concurrently if exists public.uq_rag_documents_content_hash;

-- PHASE 1 undo (column).
begin;

alter table public.rag_documents
  drop column if exists content_hash;

commit;
