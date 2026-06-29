import { describe, expect, it } from 'vitest'
import { buildSmartSearchSummary, type SmartSearchEvalRow } from '../smart-search-summary'

function row(overrides: Partial<SmartSearchEvalRow> = {}): SmartSearchEvalRow {
  return {
    id: 'smart-mad-santander-bbva-cost',
    ms: 100,
    rank: 1,
    snippetOk: true,
    entityOk: true,
    pass: true,
    top: [],
    ...overrides,
  }
}

describe('buildSmartSearchSummary', () => {
  it('passes only when all rows pass and critical docs are rank #1', () => {
    const summary = buildSmartSearchSummary([
      row(),
      row({ id: 'smart-mad-buenavista-conditions', ms: 200 }),
      row({ id: 'smart-klp-pacto-socios', rank: 2, ms: 300 }),
    ])

    expect(summary.ok).toBe(true)
    expect(summary.failures).toEqual([])
    expect(summary.total).toBe(3)
    expect(summary.pass).toBe(3)
    expect(summary.docAt1).toBe(2)
    expect(summary.docAt3).toBe(3)
    expect(summary.avgMs).toBe(200)
    expect(summary.criticalAt1).toEqual({
      'smart-mad-santander-bbva-cost': true,
      'smart-mad-buenavista-conditions': true,
    })
  })

  it('fails when a row fails or a critical document is not first', () => {
    const summary = buildSmartSearchSummary([
      row({ rank: 2 }),
      row({ id: 'smart-mad-buenavista-conditions', rank: 3, pass: false, snippetOk: false }),
    ])

    expect(summary.ok).toBe(false)
    expect(summary.failures).toEqual(expect.arrayContaining([
      'smart-mad-buenavista-conditions did not pass smart-search checks.',
      'smart-mad-santander-bbva-cost was not retrieved at rank #1.',
      'smart-mad-buenavista-conditions was not retrieved at rank #1.',
    ]))
  })

  it('fails empty evidence', () => {
    const summary = buildSmartSearchSummary([])

    expect(summary.ok).toBe(false)
    expect(summary.failures).toContain('No smart-search rows were evaluated.')
  })
})
