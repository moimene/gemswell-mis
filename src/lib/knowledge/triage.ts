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
import { AUTHORITY_TIER_SCORE } from '@/lib/knowledge/contracts'
import type { AuthorityTier, Lifecycle, ReviewStatus } from '@/lib/knowledge/contracts'

export type TriageAction = 'approve' | 'keep_needs_review'

export type TriageDecision = {
  action: TriageAction
  newStatus: ReviewStatus
  reason: string
  /** set only by the AGGRESSIVE policy when it promotes a high-value final doc to high authority */
  authority_tier?: AuthorityTier
  authority_score?: number
}

export type Reclassification = {
  doc_type: string | null
  authority_tier: AuthorityTier
  confidence: number
  lifecycle?: Lifecycle
}

// ─── AGGRESSIVE policy (operator-chosen) — high-quality FINAL docs → high authority automatically ──────
// A recognized high-value document that is NOT a draft (a signed contract, escritura pública, audited
// accounts, a final financial model, signed board minutes, …) is promoted to high authority (executed=90,
// or audited=100 when the doc itself is audited) and approved, making it a source_of_record. This
// DELIBERATELY overrides the conservative human-confirm rule — accepted by the operator in exchange for a
// stronger analysis model + the finality signal (draft vs final). Drafts/working papers and low-confidence
// re-classifications fall back to the conservative policy (they are never auto-promoted).
const HIGH_VALUE_TYPES = new Set<string>([
  'legal', 'board', 'annual_accounts', 'financial_statements', 'bp_model', 'funding', 'tax', 'dd', 'kyc',
])
const DRAFT_LIFECYCLES = new Set<Lifecycle>(['draft', 'working_paper'])
const AGGRESSIVE_MIN_CONFIDENCE = 0.6

export function triageAggressive(reclass: Reclassification, current: { authority_tier: AuthorityTier }): TriageDecision {
  const lifecycle = reclass.lifecycle ?? 'unknown'
  // never auto-promote a superseded doc (it is excluded from retrieval regardless)
  const isHighValueFinal =
    HIGH_VALUE_TYPES.has(reclass.doc_type ?? '') &&
    lifecycle !== 'superseded' &&
    !DRAFT_LIFECYCLES.has(lifecycle) &&
    reclass.confidence >= AGGRESSIVE_MIN_CONFIDENCE
  if (isHighValueFinal) {
    const tier: AuthorityTier = lifecycle === 'audited' ? 'audited' : 'executed'
    return {
      action: 'approve',
      newStatus: 'approved',
      authority_tier: tier,
      authority_score: AUTHORITY_TIER_SCORE[tier],
      reason: `high-value final ${reclass.doc_type}/${lifecycle} @${reclass.confidence.toFixed(2)} → ${tier} (${AUTHORITY_TIER_SCORE[tier]})`,
    }
  }
  // not a high-value FINAL doc (draft, low value, or low confidence) → conservative policy
  return triageNeedsReview(reclass, current)
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
