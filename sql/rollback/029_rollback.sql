-- Rollback for sql/029 — drop the reaper retry-ceiling column.
-- Safe: the reaper's re-ingest lane fails closed without it (listRecoverable returns null on the missing
-- column), so dropping it disables re-ingest cleanly rather than breaking anything.

begin;

alter table public.rag_documents
  drop column if exists reingest_attempts;

commit;
