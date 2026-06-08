/**
 * Fase 4 / WS3-T5 (automated) — triage the `needs_review` backlog without human hours. Given a FRESH
 * re-classification of a document's content, decide whether it can be auto-resolved. SSOT + pure, so the
 * batch script (scripts/triage-needs-review.mjs) and any future UI share one auditable decision.
 *
 * Principle: this is NOT "auto-approve everything" — it re-runs the SAME governance rule (decideReviewStatus)
 * the ingest uses, just with a stronger signal (a real content re-classification). It therefore:
 *  - NEVER auto-resolves a sticky high-authority claim (audited/executed/controller) — those genuinely need
 *    a human to confirm the authority (the C1 trust invariant); they stay needs_review.
 *  - Auto-APPROVES only when the re-classification is confident, has a real doc_type, and a non-unverified
 *    tier (exactly decideReviewStatus's bar).
 *  - NEVER auto-rejects (rejection is destructive / loses recall) — uncertain docs simply stay needs_review.
 */
import { decideReviewStatus, HUMAN_CONFIRM_TIERS } from '@/lib/knowledge/classify'
import type { AuthorityTier, ReviewStatus } from '@/lib/knowledge/contracts'

export type TriageAction = 'approve' | 'keep_needs_review'

export type TriageDecision = {
  action: TriageAction
  newStatus: ReviewStatus
  reason: string
}

export type Reclassification = {
  doc_type: string | null
  authority_tier: AuthorityTier
  confidence: number
}

export function triageNeedsReview(
  reclass: Reclassification,
  current: { authority_tier: AuthorityTier },
): TriageDecision {
  // A high-authority claim — by the current tier OR the fresh re-classification — must be confirmed by a
  // human. Auto-approving it would be exactly the C1 trust hole. Keep it for review.
  if (HUMAN_CONFIRM_TIERS.has(current.authority_tier) || HUMAN_CONFIRM_TIERS.has(reclass.authority_tier)) {
    return { action: 'keep_needs_review', newStatus: 'needs_review', reason: `high-authority tier (${reclass.authority_tier}) requires human confirmation` }
  }
  const decided = decideReviewStatus({
    doc_type: reclass.doc_type,
    authority_tier: reclass.authority_tier,
    confidence: reclass.confidence,
  })
  if (decided === 'approved') {
    return { action: 'approve', newStatus: 'approved', reason: `confident re-classification (${reclass.doc_type}/${reclass.authority_tier} @${reclass.confidence.toFixed(2)})` }
  }
  return { action: 'keep_needs_review', newStatus: 'needs_review', reason: `re-classification still uncertain (${reclass.doc_type ?? 'none'}/${reclass.authority_tier} @${reclass.confidence.toFixed(2)})` }
}
