import { describe, it, expect } from 'vitest'
import { createHash } from 'node:crypto'
import { computeContentHash } from '../queue-processor'

// The legacy backfill (scripts/dedup-legacy-corpus.mjs `contentHash()`) computes sha256 over each chunk's
// `content.replace(/\s+/g,' ').trim() + '\n'` in chunk_index order. computeContentHash MUST match it byte
// for byte, else the partial unique index can't catch a re-ingest of legacy content (B5).
function legacyHash(chunks: string[]): string {
  const h = createHash('sha256')
  for (const c of chunks) h.update((c ?? '').replace(/\s+/g, ' ').trim() + '\n')
  return h.digest('hex')
}

describe('computeContentHash (B5)', () => {
  it('matches the legacy dedup normalization exactly', () => {
    const chunks = ['  CLÁUSULA 1\tPrimera   línea ', 'Segunda\n\nlínea con  espacios', 'Tercera']
    expect(computeContentHash(chunks)).toBe(legacyHash(chunks))
  })

  it('is order-sensitive (chunk_index order matters)', () => {
    expect(computeContentHash(['a b c', 'd e f'])).not.toBe(computeContentHash(['d e f', 'a b c']))
  })

  it('collapses whitespace and trims (a reformatted re-export of identical content collides)', () => {
    expect(computeContentHash(['hello   world'])).toBe(computeContentHash([' hello\tworld\n']))
  })

  it('tolerates null/empty chunk content', () => {
    expect(() => computeContentHash([null as unknown as string, ''])).not.toThrow()
    expect(computeContentHash([''])).toBe(legacyHash(['']))
  })

  it('is deterministic', () => {
    const c = ['Loan Agreement', '£130,000', 'Kelpa → WPH']
    expect(computeContentHash(c)).toBe(computeContentHash(c))
  })
})
