import { describe, expect, it } from 'vitest'
import {
  buildExactIdentifierRecoveryAnswer,
  extractExactIdentifierTokens,
  promoteExactIdentifierSources,
} from '../source-precision'

describe('exact identifier source precision', () => {
  it('extracts long mixed alphanumeric control identifiers without short project noise', () => {
    expect(extractExactIdentifierTokens('documento temporal CODX08E8BA1C79 para MAD Q1')).toEqual(['CODX08E8BA1C79'])
  })

  it('promotes sources containing the exact identifier ahead of unrelated retrieved sources', () => {
    const sources = [
      { id: 'other', label: 'Covenant certificate', metadata: {}, preview: 'LTC 80%' },
      { id: 'exact', label: 'codex-e2e-ingest-CODX08E8BA1C79.txt', metadata: {}, preview: 'control CODX08E8BA1C79' },
    ]

    expect(promoteExactIdentifierSources(sources, ['CODX08E8BA1C79']).map((source) => source.id)).toEqual(['exact', 'other'])
  })

  it('builds a grounded recovery answer from exact-token evidence beyond source preview', () => {
    const answer = buildExactIdentifierRecoveryAnswer(
      'Que condicion indica CODX08E8BA1C79?',
      ['CODX08E8BA1C79'],
      [{ id: 'exact', label: 'codex-e2e-ingest-CODX08E8BA1C79.txt', metadata: {}, preview: 'control CODX08E8BA1C79' }],
      'El identificador unico de control es CODX08E8BA1C79 y la condicion de prueba indica margen documental 7.31 por ciento.',
    )

    expect(answer).toContain('CODX08E8BA1C79')
    expect(answer).toContain('7.31 por ciento')
    expect(answer).toContain('La condicion de prueba indica margen documental 7.31 por ciento.')
    expect(answer).toContain('codex-e2e-ingest-CODX08E8BA1C79.txt')
  })
})
