-- 029 — rag_documents.reingest_attempts (Fase 6 reaper retry ceiling).
--
-- WHY: the F6 cron reaper (src/lib/ingest/reaper.ts) re-ingests docs stuck in status='error' that still
-- have their original bytes in Storage. Without a ceiling, a permanently-failing doc (corrupt bytes,
-- scanned-no-text) would be re-downloaded + re-parsed + re-embedded every 30 min forever — wasted spend
-- and head-of-line starvation of newer recoverable docs. This column counts failures; the reaper
-- excludes docs at/over REAPER_MAX_ATTEMPTS (default 5) and processes least-attempted first.
--
-- FAIL-SAFE: the reaper's re-ingest lane is fail-closed until this column exists (listRecoverable returns
-- null on 42703 undefined_column → no re-ingest, no loop). So apply this BEFORE setting CRON_SECRET to
-- activate the re-ingest lane. The stranded-sweep (job 1) does not need this column.
--
-- RISK: low — additive column, NOT NULL with a default 0 (instant in modern Postgres: stored default, no
-- table rewrite). No RPC touched. Fully reversible: drop the column.
--
-- APPLY (with the charter net): additive + constant default, no query-plan change → no branch-probe
-- needed (same class as sql/025/028 PHASE 1). Verify AFTER: column present, all rows 0.
-- Rollback: sql/rollback/029_rollback.sql.

begin;

alter table public.rag_documents
  add column if not exists reingest_attempts smallint not null default 0;

comment on column public.rag_documents.reingest_attempts is
  'F6 reaper retry ceiling: count of failed re-ingest attempts. Reaper excludes docs at/over '
  'REAPER_MAX_ATTEMPTS (default 5). Reset implicitly when a doc reaches status=indexed.';

commit;
