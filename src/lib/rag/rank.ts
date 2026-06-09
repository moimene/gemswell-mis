// Gemswell trust-tier ranking — the universal sorting algorithm lives in @teras/rag-core (Fase 8
// WS7-T4); this file injects Gemswell's GOVERNANCE MAPPING (how metadata → trust tier) into it. The
// exported surface (`trustTier`, `rankBySourceTrust`) is unchanged, so every call site is untouched and
// behaviour is byte-identical (proven by the unchanged rank.test.ts). MDL injects its own mapping.
import { verificationFromGovernance } from '@/lib/knowledge/source-reference'
import type { ClassificationSource, ReviewStatus } from '@/lib/knowledge/contracts'
import { rankBySourceTrust as coreRankBySourceTrust, num, str, type RankableChunk } from '@/lib/rag-core/rank'

export type { RankableChunk }

const TIER_ORDER: Record<string, number> = { source_of_record: 3, supporting: 2, context: 1, unverified: 0 }
const REVIEW_VALUES = new Set(['pending', 'approved', 'rejected', 'needs_review'])
const SOURCE_VALUES = new Set(['human', 'rule', 'agent_auto', 'agent_reviewed', 'agent_corrected', 'agent_rejected'])

/** Gemswell governance mapping: metadata → trust tier (source_of_record=3 … unverified=0). */
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
 * Human review rank, secondary key below trust tier. The `context` tier lumps approved-low-authority
 * and needs_review chunks together; this ensures human-reviewed (approved) evidence leads unreviewed
 * evidence within the same tier, so trust dominates relevance as the spec intends.
 */
function approvedRank(metadata: Record<string, unknown> | undefined): number {
  return str(metadata?.review_status) === 'approved' ? 1 : 0
}

/** Order by trust tier (desc), then approved-ness (desc), then Cohere relevance (desc); stable for ties. */
export function rankBySourceTrust<T extends RankableChunk>(chunks: T[]): T[] {
  return coreRankBySourceTrust(chunks, trustTier, approvedRank)
}
