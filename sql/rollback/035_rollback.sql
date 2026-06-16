-- Rollback for sql/035 — remove chat message provider provenance columns.
-- Safe for current app only if code no longer writes/selects these columns.

alter table public.rag_messages
  drop constraint if exists rag_messages_provider_check,
  drop column if exists fallback,
  drop column if exists model,
  drop column if exists provider;

