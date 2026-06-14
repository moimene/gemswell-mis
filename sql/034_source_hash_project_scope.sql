-- 034 — make the source_hash dedup key PROJECT-AWARE: (source_hash) -> (source_hash, project_id).
--
-- WHY (Codex adversarial review, 2026-06-13): reserveRagDocument() dedups uploads by a GLOBAL
-- source_hash — sql/004's `idx_rag_documents_source_hash` is UNIQUE on (source_hash) alone. So a
-- byte-identical file uploaded under project B, when an identical file already exists under project A,
-- hit the unique constraint, took the 23505 reuse path, and was REUSED on A's row rather than created
-- under B — meaning it could NEVER become visible under project B. The same bytes are a legitimately
-- separate document per project (different business line, different chat scope). This swaps the dedup
-- key to (source_hash, project_id), so identical bytes coexist across projects but still dedup WITHIN a
-- project. It mirrors the B5 content_hash index `uq_rag_documents_content_hash (content_hash, project_id)`
-- (sql/028 PHASE 2) so BOTH dedup keys are project-scoped and consistent.
--
-- ⚠ COORDINATED DEPLOY — this migration and the code change in
--   src/lib/ingest/queue-processor.ts (reserveRagDocument now writes project_id at the reserve insert
--   and scopes the reuse lookup to (source_hash, project_id)) are ATOMIC. Deploying one without the
--   other breaks ingest:
--     • index swapped but OLD code live (insert leaves project_id NULL): same-project re-uploads insert
--       (hash, NULL), never collide, then trip the index on the final project_id write -> ingest errors.
--     • code live but index NOT swapped (still global): a cross-project upload 23505s globally, the now
--       project-scoped reuse lookup finds nothing, and reserve throws.
--   Apply this migration and ship the code in the SAME deploy window.
--
-- RISK: low. NULLs never collide in a partial unique index, so the composite key is STRICTLY weaker than
-- the global one — any data that satisfies the live global index trivially satisfies (source_hash,
-- project_id). Creation therefore cannot fail on existing data as long as the global index is still
-- present when the composite is built (the order below guarantees that). Verified live 2026-06-13:
--   source_hashes_with_dups = 0, cross_project_collisions = 0  (only 2 rows carry a source_hash; the
--   5,496 legacy rows have NULL source_hash and never participate). No remediation required.

-- ┌─ PHASE 0 — verify BEFORE swapping (run first; expect zero rows / all zeros). Handle like sql/028. ──┐
-- │ A non-empty result means two rows already share a source_hash (impossible under the live global      │
-- │ unique index, but check anyway): resolve/supersede them before swapping, else the new index is fine  │
-- │ to create but the intent is muddied.                                                                 │
-- │                                                                                                       │
-- │   SELECT source_hash, count(*) AS n, count(DISTINCT project_id) AS distinct_projects                  │
-- │   FROM public.rag_documents                                                                           │
-- │   WHERE source_hash IS NOT NULL                                                                       │
-- │   GROUP BY source_hash HAVING count(*) > 1;                                                           │
-- └───────────────────────────────────────────────────────────────────────────────────────────────────┘

-- ┌─ PHASE 1 — the swap. CONCURRENTLY => non-blocking and CANNOT run inside a transaction block, so each  │
-- │ statement is standalone. Order matters: CREATE the project-scoped index FIRST (while the global index │
-- │ still guarantees the data is unique, so the build cannot fail), THEN DROP the global one. There is no │
-- │ window without a unique guard.                                                                        │

create unique index concurrently if not exists uq_rag_documents_source_hash_project
  on public.rag_documents (source_hash, project_id)
  where source_hash is not null;

comment on index public.uq_rag_documents_source_hash_project is
  'Project-aware byte-identical dedup key (sql/034). Replaces the global idx_rag_documents_source_hash so '
  'the same file can exist once per project but still dedups WITHIN a project. NULL source_hash (legacy) '
  'and NULL project_id never collide (best-effort, same as uq_rag_documents_content_hash). reserveRagDocument '
  'writes project_id at the reserve insert so this index fires the 23505 that drives the scoped reuse path.';

drop index concurrently if exists public.idx_rag_documents_source_hash;
