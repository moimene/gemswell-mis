-- Rollback for sql/034 — restore the GLOBAL source_hash unique index, drop the project-scoped one.
-- CONCURRENTLY => non-blocking, outside a transaction, each statement standalone.
--
-- Order: recreate the global index FIRST (keeps a unique guard), THEN drop the composite one.
--
-- ⚠ SHARP EDGE: recreating the GLOBAL unique index can FAIL if, since sql/034 was applied, the same bytes
-- were legitimately ingested under more than one project (exactly what 034 allows). That is not data
-- corruption — it is the project-aware behavior. If the CREATE below errors on a duplicate, the rollback
-- requires first superseding/removing the cross-project copies:
--
--   SELECT source_hash, array_agg(id), array_agg(project_id)
--   FROM public.rag_documents
--   WHERE source_hash IS NOT NULL
--   GROUP BY source_hash HAVING count(*) > 1;
--
-- Roll back promptly (before cross-project dups accumulate), or remediate first. Also revert the code in
-- src/lib/ingest/queue-processor.ts in the SAME window (it must not run project-scoped against a global index).

create unique index concurrently if not exists idx_rag_documents_source_hash
  on public.rag_documents (source_hash)
  where source_hash is not null;

drop index concurrently if exists public.uq_rag_documents_source_hash_project;
