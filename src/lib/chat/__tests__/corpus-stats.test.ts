import { describe, it, expect } from 'vitest'
import { formatCorpusStats } from '../corpus-stats'

const health = {
  total: 5498,
  governance: { approved: 4022, needs_review: 1476, rejected: 0, pending: 0 },
  source_of_record: 1040,
}

describe('formatCorpusStats', () => {
  it('maps health → 3 localized stats (docs / approved / source_of_record)', () => {
    const s = formatCorpusStats(health)
    expect(s).toHaveLength(3)
    expect(s[0]).toEqual({ label: 'documentos', value: '5.498' })
    expect(s[1]).toEqual({ label: 'aprobados', value: '4.022' })
    expect(s[2]).toEqual({ label: 'fuente oficial', value: '1.040' })
  })

  it('returns [] for missing/malformed health (graceful fallback, no undefined figures)', () => {
    expect(formatCorpusStats(null)).toEqual([])
    expect(formatCorpusStats(undefined)).toEqual([])
    // @ts-expect-error — intentionally malformed
    expect(formatCorpusStats({ governance: {} })).toEqual([])
  })

  it('defaults missing sub-counts to 0 rather than throwing', () => {
    // @ts-expect-error — partial governance
    const s = formatCorpusStats({ total: 10, governance: {}, source_of_record: undefined })
    expect(s[1]).toEqual({ label: 'aprobados', value: '0' })
    expect(s[2]).toEqual({ label: 'fuente oficial', value: '0' })
  })
})
