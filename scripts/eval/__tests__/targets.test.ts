import { describe, it, expect } from 'vitest'
import { TARGETS, REGRESSION_BAND, HARD_GATES, SOFT_GATES, targetFor } from '../targets'

describe('eval targets SSOT', () => {
  it('every target is well-formed', () => {
    for (const t of TARGETS) {
      expect(t.metric, t.metric).toMatch(/^[a-z_]+\.[a-z0-9_]+$/)
      expect(['hard', 'soft']).toContain(t.gate)
      expect(['documentary', 'structured', 'abstain', 'ambiguous', 'governance']).toContain(t.bucket)
      expect(t.metric.startsWith(t.bucket + '.'), t.metric).toBe(true)
      expect(t.target).toBeGreaterThan(0)
      expect(['rate', 'score_1_5', 'ratio', 'bool']).toContain(t.unit)
    }
  })

  it('metric ids are unique', () => {
    expect(new Set(TARGETS.map((t) => t.metric)).size).toBe(TARGETS.length)
  })

  it('documentary headline targets strictly exceed their measured baseline', () => {
    for (const m of ['documentary.judge_pass_rate', 'documentary.recall_at_5', 'documentary.recall_at_10', 'documentary.mrr']) {
      const t = targetFor(m)!
      expect(t, m).toBeDefined()
      expect(t.current, m).not.toBeNull()
      expect(t.target, m).toBeGreaterThan(t.current!)
    }
  })

  it('governance invariants are hard gates targeting 1.0', () => {
    const gov = TARGETS.filter((t) => t.bucket === 'governance')
    expect(gov.length).toBeGreaterThanOrEqual(3)
    for (const t of gov) {
      expect(t.gate).toBe('hard')
      expect(t.target).toBe(1.0)
    }
  })

  it('hard + soft partition the target set', () => {
    expect(HARD_GATES.length + SOFT_GATES.length).toBe(TARGETS.length)
  })

  it('regression band is a sane fraction', () => {
    expect(REGRESSION_BAND).toBeGreaterThan(0)
    expect(REGRESSION_BAND).toBeLessThan(0.5)
  })
})
