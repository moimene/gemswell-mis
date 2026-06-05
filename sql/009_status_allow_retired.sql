-- 009_status_allow_retired.sql — Spec B (gestor documental)
-- Applied to nqxhsjkcvfxygiajdxki as migration `allow_retired_document_status` (2026-06-05).
--
-- The gestor's retire/restore/supersede actions set rag_documents.status = 'retired'.
-- The original check constraint (from create_dms_rag_governance) only permitted
-- pending|processing|indexed|error, which blocked the retire action.
-- A's RPCs (match_chunks / keyword_search_chunks) already filter status='indexed',
-- so a 'retired' document is automatically excluded from chat retrieval — no RPC change needed.
-- Widening is safe: every existing row is 'indexed', so no row violates the new constraint.

ALTER TABLE rag_documents DROP CONSTRAINT IF EXISTS rag_documents_status_check;
ALTER TABLE rag_documents ADD CONSTRAINT rag_documents_status_check
  CHECK (status = ANY (ARRAY['pending'::text, 'processing'::text, 'indexed'::text, 'error'::text, 'retired'::text]));
