import { describe, it, expect } from 'vitest'
import { scoreToTier, tierToScore } from '@/lib/knowledge/authority'

describe('scoreToTier', () => {
  it('maps the real chunk authority values', () => {
    expect(scoreToTier(95)).toBe('audited')
    expect(scoreToTier(90)).toBe('executed')
    expect(scoreToTier(85)).toBe('controller')
    expect(scoreToTier(80)).toBe('controller')
    expect(scoreToTier(75)).toBe('board_pack')
    expect(scoreToTier(0)).toBe('unverified')
  })
})

describe('tierToScore', () => {
  it('is the canonical AUTHORITY_TIER_SCORE', () => {
    expect(tierToScore('audited')).toBe(100)
    expect(tierToScore('unverified')).toBe(0)
  })
})
