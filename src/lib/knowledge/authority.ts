import { AUTHORITY_TIER_SCORE, type AuthorityTier } from '@/lib/knowledge/contracts'

export function tierToScore(tier: AuthorityTier): number {
  return AUTHORITY_TIER_SCORE[tier]
}

export function scoreToTier(score: number): AuthorityTier {
  if (score >= 95) return 'audited'
  if (score >= 90) return 'executed'
  if (score >= 80) return 'controller'
  if (score >= 70) return 'board_pack'
  if (score >= 60) return 'dd_memo'
  if (score >= 40) return 'internal'
  if (score >= 10) return 'narrative'
  return 'unverified'
}
