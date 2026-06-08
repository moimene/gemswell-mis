-- Rollback for sql/025 — drop the embedding_model provenance column.
-- Safe: the value is also mirrored in rag_chunks.metadata->>'embedding_model' for new ingests, so no
-- provenance is permanently lost by dropping the column.

begin;

alter table public.rag_chunks
  drop column if exists embedding_model;

commit;
