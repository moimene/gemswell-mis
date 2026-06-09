// Trust-tier ranking — provider-agnostic core (@teras/rag-core, Fase 8 WS7-T4).
//
// The SORTING POLICY is universal across apps: order by trust tier (desc), then human-reviewed-ness
// (desc), then retrieval relevance (desc), with a stable tiebreak. What differs per app is HOW a
// chunk's governance metadata maps to a trust tier and an "approved" bit — Gemswell and MDL have
// different governance models (enums, authority scales, review semantics). So the mapping functions
// are INJECTED; this module owns only the pure, shared ranking algorithm.

export type RankableChunk = { metadata?: Record<string, unknown>; relevanceScore: number }

/** Maps a chunk's (untrusted-body-excluded) governance metadata to a trust tier; higher = more trusted. */
export type TrustTierFn = (metadata: Record<string, unknown> | undefined) => number
/** Secondary key within a tier (e.g. human-approved leads unreviewed); higher = preferred. */
export type ApprovedRankFn = (metadata: Record<string, unknown> | undefined) => number

/**
 * Order chunks by trust tier (desc), then approved-rank (desc), then relevanceScore (desc); stable for
 * ties (original index). Pure: no DB, no governance assumptions — the two mappers carry all app context.
 */
export function rankBySourceTrust<T extends RankableChunk>(
  chunks: T[],
  trustTier: TrustTierFn,
  approvedRank: ApprovedRankFn
): T[] {
  return chunks
    .map((c, i) => ({ c, i, tier: trustTier(c.metadata), appr: approvedRank(c.metadata) }))
    .sort((a, b) => (b.tier - a.tier) || (b.appr - a.appr) || (b.c.relevanceScore - a.c.relevanceScore) || (a.i - b.i))
    .map(x => x.c)
}

// ── small shared coercion helpers (pure) ────────────────────────────────────
export function num(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim()) { const n = Number(v); if (Number.isFinite(n)) return n }
  return undefined
}
export function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined
}
