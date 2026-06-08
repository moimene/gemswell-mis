import { describe, it, expect } from 'vitest'
import { chunkFinancialContent } from '@/lib/rag/embeddings'
import { buildMarkdownArtifact, type MarkdownFrontmatter } from '@/lib/knowledge/markdown-artifact'

// WS2-T4 — page provenance (audit A5). LlamaParse emits one markdown doc with pages joined by a
// bare `---` page_separator (parse.ts: page_separator='\n---\n'). A chunk must carry metadata.page so a
// citation to a 200-page board-pack resolves to the page, not the whole document. The page is stamped
// at chunk time into metadata (NOT via the RPC — that is Fase 5/023), so we assert on chunk.metadata.page.

const HEADER = '| Concepto | Importe |'
const SEP = '| --- | ---: |'
// A table big enough (>MAX_CHUNK_SIZE=2000) to force several fragments, with a page-unique row marker.
const bigTable = (marker: string) =>
  [HEADER, SEP, ...Array.from({ length: 40 }, (_, i) =>
    `| ${marker} partida presupuestaria numero ${i} con una descripcion larga y distintiva | ${1000 + i} |`,
  )].join('\n')

describe('chunkFinancialContent — page provenance from LlamaParse page_separator (audit A5 / WS2-T4)', () => {
  it('stamps metadata.page per page when the doc is split by the `---` page separator', () => {
    // Two pages, each a (large) financial table, joined by the bare `---` page separator.
    const doc = [bigTable('PAGINAUNO'), '', '---', '', bigTable('PAGINADOS')].join('\n')
    const chunks = chunkFinancialContent(doc)

    const pageOf = (marker: string) => {
      const cs = chunks.filter((c) => c.content.includes(marker))
      expect(cs.length, `expected chunks containing ${marker}`).toBeGreaterThan(0)
      return [...new Set(cs.map((c) => c.metadata.page))]
    }
    // every page-1 chunk → page 1; every page-2 chunk → page 2
    expect(pageOf('PAGINAUNO')).toEqual([1])
    expect(pageOf('PAGINADOS')).toEqual([2])
  })

  it('handles a three-page narrative doc, assigning ascending pages to later content', () => {
    const para = (tag: string) =>
      Array.from({ length: 60 }, (_, i) => `${tag} oracion numero ${i} con relleno suficiente para el chunk.`).join(' ')
    const doc = [para('ALPHA'), '', '---', '', para('BRAVO'), '', '---', '', para('CHARLIE')].join('\n')
    const chunks = chunkFinancialContent(doc)
    const firstPageWith = (tag: string) => chunks.find((c) => c.content.includes(tag))?.metadata.page
    const a = firstPageWith('ALPHA')!
    const b = firstPageWith('BRAVO')!
    const c = firstPageWith('CHARLIE')!
    expect(a).toBe(1)
    expect(b).toBe(2)
    expect(c).toBe(3)
  })

  it('does NOT add a page field when there is no page separator (backward compatible)', () => {
    const chunks = chunkFinancialContent('Un parrafo sin separadores de pagina.\n\nOtro parrafo normal.')
    for (const c of chunks) expect(c.metadata.page).toBeUndefined()
  })

  it('does not confuse a markdown table separator row (| --- |) with a page break', () => {
    // The table SEP row contains dashes but is a pipe row, not a bare `---` page separator.
    const chunks = chunkFinancialContent(bigTable('SOLO'))
    for (const c of chunks) expect(c.metadata.page).toBeUndefined() // single page → no page metadata
  })
})

// The PRODUCTION input is the markdown ARTIFACT, not the raw parse: queue-processor chunks
// buildMarkdownArtifact(parsed.content, frontmatter), which wraps content in `---` YAML fences. Those
// fences must NOT be miscounted as page breaks (Ronda 1 adversarial reviewer B — blocker).
describe('chunkFinancialContent — page provenance THROUGH the real markdown artifact (Ronda 1 blocker)', () => {
  const frontmatter = (): MarkdownFrontmatter => ({
    document_id: 'doc-1234abcd', source_channel: 'local_backfill', source_hash: 'deadbeef',
    file_name: 'Board Pack Q3 2026 final version 2 consolidated.pdf', mime_type: 'application/pdf',
    project_id: 'MAD', doc_type: 'capex', lifecycle: 'draft', authority_tier: 'board_pack',
    authority_score: 80, classification_source: 'agent_auto', review_status: 'needs_review',
    parser: 'llamaparse', ocr_used: false, generated_at: '2026-06-08T00:00:00.000Z', version: 1,
  })

  it('a single-page doc through the artifact has NO page (frontmatter --- fences are not page breaks)', () => {
    const artifact = buildMarkdownArtifact(bigTable('SOLO'), frontmatter())
    const chunks = chunkFinancialContent(artifact)
    for (const c of chunks) expect(c.metadata.page, `page should be undefined, got ${c.metadata.page}`).toBeUndefined()
  })

  it('a two-page doc through the artifact stamps page 1 and page 2 (not 3 and 4)', () => {
    const body = [bigTable('PAGINAUNO'), '', '---', '', bigTable('PAGINADOS')].join('\n')
    const artifact = buildMarkdownArtifact(body, frontmatter())
    const chunks = chunkFinancialContent(artifact)
    const pageOf = (m: string) => [...new Set(chunks.filter((c) => c.content.includes(m)).map((c) => c.metadata.page))]
    expect(pageOf('PAGINAUNO')).toEqual([1])
    expect(pageOf('PAGINADOS')).toEqual([2])
  })
})

describe('chunkFinancialContent — page provenance robustness (Ronda 1 nits #2/#3)', () => {
  // pages must exceed MAX_CHUNK_SIZE(2000) so each becomes its own narrative chunk (a short doc collapses
  // into a single chunk, which legitimately carries just its start page).
  const bigPara = (t: string) =>
    Array.from({ length: 60 }, (_, i) => `${t} parrafo relleno numero ${i} con texto distintivo suficiente para el limite.`).join('\n\n')

  it('a longest-line anchor that recurs verbatim on a later page still advances forward (cursor past match)', () => {
    const boiler = 'NOTA LEGAL CONFIDENCIAL: este documento contiene informacion reservada y privilegiada del consejo de administracion del grupo.'
    const doc = [bigPara('UNO'), '', boiler, '', '---', '', bigPara('DOS'), '', boiler].join('\n')
    const chunks = chunkFinancialContent(doc)
    // a chunk DEEP in page 2 (well past the boundary) must map to page 2 — the recurring boiler must not
    // drag the cursor back to the page-1 occurrence.
    const deepDos = chunks.find((c) => c.content.includes('DOS parrafo relleno numero 55'))
    expect(deepDos?.metadata.page).toBe(2)
    expect(chunks.some((c) => c.metadata.page === 2)).toBe(true)
  })

  it('a trailing page separator does not crash and assigns sane pages', () => {
    const doc = [bigPara('ZULU'), '', '---', '', bigPara('YANKEE'), '', '---'].join('\n')
    const chunks = chunkFinancialContent(doc)
    expect(chunks.find((c) => c.content.includes('ZULU parrafo'))?.metadata.page).toBe(1)
    expect(chunks.find((c) => c.content.includes('YANKEE parrafo'))?.metadata.page).toBe(2)
  })
})
