-- 007_governance_backfilled_at.sql — idempotent.
-- Adversarial-review fix F6: the backfill used `summary != null` as its resume sentinel, which
-- never marks rule-resolved docs (they get no summary) → every re-run reprocessed them, inserting
-- duplicate rag_document_events and re-charging Haiku for empty-summary docs. This column is a
-- proper "governance has been computed" sentinel: the backfill drains rows WHERE it IS NULL and
-- sets it on every processed doc, so re-runs converge (process only genuinely-new docs).
ALTER TABLE public.rag_documents ADD COLUMN IF NOT EXISTS governance_backfilled_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_rag_documents_governance_backfilled_at
  ON public.rag_documents(governance_backfilled_at) WHERE governance_backfilled_at IS NULL;
