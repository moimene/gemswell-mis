import { verificationFromGovernance } from '@/lib/knowledge/source-reference'
import type { ClassificationSource, ReviewStatus } from '@/lib/knowledge/contracts'

const TIER_ORDER: Record<string, number> = { source_of_record: 3, supporting: 2, context: 1, unverified: 0 }
const REVIEW_VALUES = new Set(['pending', 'approved', 'rejected', 'needs_review'])
const SOURCE_VALUES = new Set(['human', 'rule', 'agent_auto', 'agent_reviewed', 'agent_corrected', 'agent_rejected'])

export type RankableChunk = { metadata?: Record<string, unknown>; relevanceScore: number }

function num(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim()) { const n = Number(v); if (Number.isFinite(n)) return n }
  return undefined
}
function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined
}

export function trustTier(metadata: Record<string, unknown> | undefined): number {
  const authority = num(metadata?.authority_score) ?? num(metadata?.authority)
  const rsRaw = str(metadata?.review_status)
  const csRaw = str(metadata?.classification_source)
  const reviewStatus = (rsRaw && REVIEW_VALUES.has(rsRaw) ? rsRaw : 'needs_review') as ReviewStatus
  const classificationSource = (csRaw && SOURCE_VALUES.has(csRaw) ? csRaw : 'unknown') as ClassificationSource | 'unknown'
  const verification = verificationFromGovernance(authority, reviewStatus, classificationSource)
  return TIER_ORDER[verification] ?? 0
}

/**
 * Human review rank, used as a secondary key below trust tier. The `context` tier
 * (verificationFromGovernance) lumps `approved`-low-authority and `needs_review`
 * chunks together; this ensures human-reviewed (approved) evidence leads unreviewed
 * evidence within the same tier, so trust dominates relevance as the spec intends.
 */
function approvedRank(metadata: Record<string, unknown> | undefined): number {
  return str(metadata?.review_status) === 'approved' ? 1 : 0
}

/** Order by trust tier (desc), then approved-ness (desc), then Cohere relevance (desc); stable for ties. */
export function rankBySourceTrust<T extends RankableChunk>(chunks: T[]): T[] {
  return chunks
    .map((c, i) => ({ c, i, tier: trustTier(c.metadata), appr: approvedRank(c.metadata) }))
    .sort((a, b) => (b.tier - a.tier) || (b.appr - a.appr) || (b.c.relevanceScore - a.c.relevanceScore) || (a.i - b.i))
    .map(x => x.c)
}
