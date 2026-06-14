import { describe, it, expect } from 'vitest'
import { formatFoundDocuments, docStatusLabel, significantTokens, tokenScore, type FoundDocRow } from '../find-document'

const row = (o: Partial<FoundDocRow>): FoundDocRow => ({
  title: 'X', project_id: 'MAD', doc_type: 'funding', review_status: 'approved',
  lifecycle: 'signed', status: 'indexed', chunk_count: 10, created_at: '2026-05-01T00:00:00Z', ...o,
})

describe('docStatusLabel', () => {
  it('distinguishes failed ingestion (the case the gestor hides by default)', () => {
    expect(docStatusLabel(row({ status: 'error' }))).toMatch(/INGESTA FALL/i)
  })
  it('flags superseded versions', () => {
    expect(docStatusLabel(row({ status: 'indexed', lifecycle: 'superseded' }))).toMatch(/SUPERSEDED/i)
  })
  it('reports indexed+consultable with chunk count', () => {
    expect(docStatusLabel(row({ status: 'indexed', lifecycle: 'signed', chunk_count: 417 }))).toMatch(/indexado y consultable.*417/i)
  })
})

describe('formatFoundDocuments', () => {
  it('says NOT uploaded when there are no matches', () => {
    const r = formatFoundDocuments([], 'Contrato de Financiación X')
    expect(r).toMatch(/NO se ha encontrado/i)
    expect(r).toContain('Contrato de Financiación X')
  })

  it('summarises live vs failed counts and lists each with its status', () => {
    const r = formatFoundDocuments([
      row({ title: 'Contrato de financiación MAD.pdf', status: 'indexed', lifecycle: 'unknown', chunk_count: 417 }),
      row({ title: 'Contrato de financiación viejo.pdf', status: 'error', chunk_count: 0 }),
    ], 'financiación')
    expect(r).toMatch(/2 encontrado\(s\)/)
    expect(r).toMatch(/1 consultable/)
    expect(r).toMatch(/1 con la ingesta FALLIDA/i)
    expect(r).toContain('Contrato de financiación MAD.pdf')
    expect(r).toContain('Contrato de financiación viejo.pdf')
  })

  it('ranks live docs before failed/superseded ones', () => {
    const r = formatFoundDocuments([
      row({ title: 'FAILED.pdf', status: 'error' }),
      row({ title: 'LIVE.pdf', status: 'indexed', lifecycle: 'signed' }),
    ], 'q')
    expect(r.indexOf('LIVE.pdf')).toBeLessThan(r.indexOf('FAILED.pdf'))
  })

  it('marks keyword-fallback results as partial (not exact)', () => {
    const r = formatFoundDocuments([row({ title: 'Contrato de financiación con Santander.pdf' })], 'contrato de financiación de Madrid Playa Surf', { partial: true })
    expect(r).toMatch(/No hay coincidencia exacta/i)
    expect(r).toMatch(/nombre PARECIDO|palabras clave/i)
  })
})

describe('significantTokens + tokenScore (long-phrase / accent robustness)', () => {
  it('drops stopwords/short words and adds deburred variants', () => {
    const t = significantTokens('contrato de financiación de Madrid Playa Surf')
    expect(t).toContain('financiación')
    expect(t).toContain('financiacion') // deburred variant for accent-insensitive matching
    expect(t).toContain('madrid')
    expect(t).not.toContain('de') // stopword
  })
  it('scores a doc by how many keywords its (deburred) title contains', () => {
    // user typed the whole phrase; the real title only contains "Contrato de financiación"
    const kws = Array.from(new Set(significantTokens('contrato de financiación de Madrid Playa Surf').map(s => s.normalize('NFD').replace(/[̀-ͯ]/g, ''))))
    const real = '4140-7692-5542 v 1, Piscina de Olas - Contrato de financiacion'
    const noise = 'Acta Junta Madrid'
    expect(tokenScore(real, kws)).toBeGreaterThan(0)        // matches contrato + financiacion
    expect(tokenScore(real, kws)).toBeGreaterThanOrEqual(tokenScore(noise, kws))
  })
})
