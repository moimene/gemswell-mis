import { describe, it, expect } from 'vitest'
import { chunkFinancialContent } from '@/lib/rag/embeddings'

// A LlamaParse-style markdown PIPE table (the dominant parser output, parse.ts FINANCIAL_PARSING_INSTRUCTIONS).
// 5 columns => every complete row has 6 '|'. Header + separator + N data rows.
const HEADER = '| Concepto | 2024 | 2025 | 2026 | Notas |'
const SEP = '| --- | ---: | ---: | ---: | --- |'
const pipeTable = (rows: number) =>
  [HEADER, SEP, ...Array.from({ length: rows }, (_, i) =>
    `| Partida presupuestaria numero ${i} con descripcion larga | 1,234,567 | 2,345,678 | 3,456,789 | comentario detallado de la partida ${i} |`,
  )].join('\n')

const pipeLines = (content: string) => content.split('\n').filter((l) => l.trim().startsWith('|'))

describe('chunkFinancialContent — markdown pipe-table awareness (audit A1)', () => {
  it('never splits a table row and repeats the header+separator on EVERY fragment', () => {
    const text = pipeTable(60) // ~7KB, forces multiple fragments at MAX_CHUNK_SIZE=2000
    const chunks = chunkFinancialContent(text)
    expect(chunks.length).toBeGreaterThan(1) // it did get split
    for (const c of chunks) {
      // header + separator repeated so a fragment is self-describing
      expect(c.content).toContain(HEADER)
      expect(c.content).toContain('| --- |')
      // NO broken/partial row: every pipe line is a complete 5-col row (6 pipes), ends with '|'
      for (const l of pipeLines(c.content)) {
        expect(l.trim().endsWith('|'), `broken row: ${l}`).toBe(true)
        expect((l.match(/\|/g) || []).length, `wrong col count: ${l}`).toBe(6)
      }
    }
    // every data row survives exactly once across all fragments (minus the repeated header/sep)
    const allData = chunks.flatMap((c) => pipeLines(c.content)).filter((l) => !l.includes('Concepto') && !l.includes('---'))
    expect(allData.length).toBe(60)
  })

  it('keeps a small table as a single intact chunk', () => {
    const chunks = chunkFinancialContent(pipeTable(3))
    expect(chunks.length).toBe(1)
    expect(chunks[0].content).toContain(HEADER)
    expect(chunks[0].metadata.chunk_type).toBe('table_section')
  })

  it('chunks narrative text around a table separately, table-aware', () => {
    const text = `Resumen ejecutivo del presupuesto.\n\n${pipeTable(40)}\n\nNota final: pendiente de aprobacion del consejo.`
    const chunks = chunkFinancialContent(text)
    // the table fragments are table_section; narrative survives
    expect(chunks.some((c) => c.metadata.chunk_type === 'table_section')).toBe(true)
    expect(chunks.some((c) => c.content.includes('Resumen ejecutivo'))).toBe(true)
    for (const c of chunks.filter((c) => c.metadata.chunk_type === 'table_section')) {
      for (const l of pipeLines(c.content)) expect(l.trim().endsWith('|')).toBe(true)
    }
  })

  it('falls through to narrative for non-table text (behavior-preserving)', () => {
    const chunks = chunkFinancialContent('Este es un parrafo narrativo.\n\nOtro parrafo sin tablas.')
    expect(chunks.length).toBeGreaterThanOrEqual(1)
    expect(chunks[0].metadata.chunk_type).toBe('narrative')
  })

  it('handles a caption row above the header (separator at row 2) — still table-aware (review F1)', () => {
    const caption = '| Presupuesto consolidado del grupo 2024-2026 |'
    const text = [caption, HEADER, SEP, ...Array.from({ length: 50 }, (_, i) =>
      `| Partida presupuestaria numero ${i} con descripcion larga | 1,234,567 | 2,345,678 | 3,456,789 | comentario detallado de la partida ${i} |`)].join('\n')
    const chunks = chunkFinancialContent(text)
    expect(chunks.length).toBeGreaterThan(1)
    for (const c of chunks) {
      expect(c.content).toContain(HEADER) // header repeated despite the caption pushing the separator to row 2
      for (const l of pipeLines(c.content)) expect(l.trim().endsWith('|'), `broken row: ${l}`).toBe(true)
    }
    // all 50 data rows conserved exactly once
    const data = chunks.flatMap((c) => pipeLines(c.content)).filter((l) => l.includes('Partida'))
    expect(data.length).toBe(50)
  })

  it('strips CR from CRLF input so no raw \\r leaks into chunk content (review F2)', () => {
    const chunks = chunkFinancialContent(pipeTable(40).replace(/\n/g, '\r\n'))
    expect(chunks.length).toBeGreaterThan(1)
    for (const c of chunks) expect(c.content.includes('\r')).toBe(false)
  })
})
