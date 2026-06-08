-- 028 — content_hash + partial unique index (legacy dedup, Fase 6).
--
-- WHY (chat quality): a read-only scan (scripts/analyze-corpus-duplicates.mjs) found ~1,116 redundant
-- documents — same title+project+doc_type+chunk_count re-uploaded (BHX drawings ×3-4, "Memo Phase 2
-- Birmingham v2.docx" ×3 @ 27 chunks, plus macOS `._*` AppleDouble junk). Every redundant doc adds
-- redundant chunks that compete with themselves in retrieval and crowd out diversity. `source_hash`
-- (F14) only covers NEW uploads (5,496/5,498 legacy rows have NULL source_hash), so it cannot dedup the
-- legacy corpus. `content_hash` is a parser-output hash (sha256 of the normalized chunk content), so it
-- catches re-ingests even when the raw bytes differ (different export, same content) and works for legacy
-- docs whose original bytes are not in Storage.
--
-- RISK: low — additive column. The UNIQUE INDEX is the only sharp edge and is intentionally split out:
-- it CANNOT be created while live duplicates still share a content_hash (creation errors). That failure
-- is a SAFETY FEATURE, not a bug — it forces dedup remediation first. So apply in two phases.
--
-- ┌─ PHASE 1 (safe, additive, apply now with the charter net) ──────────────────────────────────────┐
-- │ add the column. Instant, nullable, no rewrite, no RPC touched (NOT the único-dueño migration).    │
-- └──────────────────────────────────────────────────────────────────────────────────────────────────┘

begin;

alter table public.rag_documents
  add column if not exists content_hash text;

comment on column public.rag_documents.content_hash is
  'sha256 of normalized parsed content (sorted chunk text). Legacy dedup key (Fase 6 / sql/028): '
  'catches re-ingested duplicates that source_hash misses (NULL for legacy). Backfilled by '
  'scripts/dedup-legacy-corpus.mjs; enforced by the partial unique index in PHASE 2 once dupes resolved.';

commit;

-- ┌─ PHASE 2 (apply ONLY AFTER dedup remediation — see scripts/dedup-legacy-corpus.mjs) ──────────────┐
-- │ The partial unique index prevents FUTURE byte-identical re-ingestion. It excludes superseded docs  │
-- │ (so re-ingesting after an intentional supersede is allowed) and NULLs (legacy not yet backfilled). │
-- │ Run AFTER remediation has superseded all redundant copies, else creation errors on the collision.  │
-- │ CONCURRENTLY → non-blocking; CANNOT run inside a transaction block, so it is a standalone step.     │
-- │                                                                                                     │
-- │   create unique index concurrently if not exists uq_rag_documents_content_hash                      │
-- │     on public.rag_documents (content_hash, project_id)                                              │
-- │     where content_hash is not null and lifecycle <> 'superseded';                                   │
-- │                                                                                                     │
-- │ Scoped to (content_hash, project_id): identical content in different projects stays allowed; the    │
-- │ duplicates found are all within-project. Verify after: the index exists and is valid (indisvalid).  │
-- └──────────────────────────────────────────────────────────────────────────────────────────────────┘
