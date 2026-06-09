import { describe, it, expect } from 'vitest'
import { rankBySourceTrust, num, str, type RankableChunk } from '../rank'

// The core ranking algorithm is provider-agnostic: it takes injected trustTier/approvedRank mappers.
// These tests pin the universal policy (tier desc → approved desc → relevance desc → stable) with
// trivial mappers, independent of any app's governance model.
type C = RankableChunk & { id: string }
const tier = (m: Record<string, unknown> | undefined) => Number(m?.tier ?? 0)
const appr = (m: Record<string, unknown> | undefined) => Number(m?.appr ?? 0)
const chunk = (id: string, t: number, a: number, rel: number): C => ({ id, metadata: { tier: t, appr: a }, relevanceScore: rel })

describe('rag-core rankBySourceTrust (parametrized)', () => {
  it('orders by trust tier desc first', () => {
    const out = rankBySourceTrust([chunk('lo', 0, 0, 0.9), chunk('hi', 3, 0, 0.1)], tier, appr)
    expect(out.map(c => c.id)).toEqual(['hi', 'lo'])
  })

  it('within a tier, approved leads, then relevance', () => {
    const out = rankBySourceTrust([
      chunk('a', 1, 0, 0.9), // same tier, not approved, high rel
      chunk('b', 1, 1, 0.2), // same tier, approved, low rel
    ], tier, appr)
    expect(out.map(c => c.id)).toEqual(['b', 'a']) // approved beats higher relevance within tier
  })

  it('breaks full ties by original order (stable)', () => {
    const out = rankBySourceTrust([chunk('x', 1, 0, 0.5), chunk('y', 1, 0, 0.5)], tier, appr)
    expect(out.map(c => c.id)).toEqual(['x', 'y'])
  })

  it('does not mutate the input array', () => {
    const input = [chunk('a', 0, 0, 0.1), chunk('b', 3, 0, 0.1)]
    const snapshot = input.map(c => c.id)
    rankBySourceTrust(input, tier, appr)
    expect(input.map(c => c.id)).toEqual(snapshot)
  })
})

describe('rag-core coercion helpers', () => {
  it('num parses finite numbers and numeric strings, else undefined', () => {
    expect(num(42)).toBe(42)
    expect(num('3.5')).toBe(3.5)
    expect(num('abc')).toBeUndefined()
    expect(num(NaN)).toBeUndefined()
    expect(num(undefined)).toBeUndefined()
  })
  it('str trims non-empty strings, else undefined', () => {
    expect(str('  x ')).toBe('x')
    expect(str('   ')).toBeUndefined()
    expect(str(5)).toBeUndefined()
  })
})
