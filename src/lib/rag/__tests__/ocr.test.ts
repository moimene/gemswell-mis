import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  isLowTextQuality,
  isGarbledText,
  isOcrSupportedMime,
  extractWithMistralOcr,
  isOcrTerminalError,
  isMistralRateLimitError,
} from '@/lib/rag/ocr'

describe('isLowTextQuality — OCR trigger heuristic (audit A2; mirrors MDL convert.ts)', () => {
  it('triggers on near-empty text (<500 chars)', () => {
    expect(isLowTextQuality('')).toBe(true)
    expect(isLowTextQuality('solo unas pocas palabras sueltas')).toBe(true)
  })
  it('triggers when >40% of non-empty lines are a single char (broken CMap garbage)', () => {
    const garbage = ['a', 'b', 'c', 'd', 'e', 'f', 'una linea normal con texto', 'g'].join('\n') // 7/8 single-char
    expect(isLowTextQuality(garbage.padEnd(600, ' '))).toBe(true) // pad so it is not caught merely by <500
  })
  it('does NOT trigger on healthy extracted text', () => {
    const good = Array.from({ length: 40 }, (_, i) => `Linea ${i} de un documento financiero con contenido real y suficiente.`).join('\n')
    expect(good.length).toBeGreaterThan(500)
    expect(isLowTextQuality(good)).toBe(false)
  })
  it('respects the exact boundaries (<500 strict, >0.4 strict) — guards against an accidental flip to <=/>=', () => {
    expect(isLowTextQuality('x'.repeat(500))).toBe(false) // exactly 500 chars, one long line → not low quality
    expect(isLowTextQuality('x'.repeat(499))).toBe(true)  // 499 < 500
    // exactly 40% single-char lines (2 of 5) is NOT > 0.4 → not low quality (pad to clear the <500 rule)
    const ratio40 = ['a', 'b', 'linea de contenido normal uno', 'linea de contenido normal dos', 'linea de contenido normal tres'].join('\n')
    expect(isLowTextQuality(ratio40.padEnd(600, ' '))).toBe(false)
  })
})

describe('isGarbledText — success-path garbage signal (Ronda 1 F1: short clean docs must NOT trigger)', () => {
  it('returns false for a short but clean document (no needless OCR of a 1-page cover)', () => {
    expect(isGarbledText('Carta de presentacion breve pero perfectamente legible.')).toBe(false)
  })
  it('returns true only on single-char-line garbage (>0.4), independent of length', () => {
    const garbage = ['a', 'b', 'c', 'd', 'texto', 'e'].join('\n') // 5/6 single-char
    expect(isGarbledText(garbage)).toBe(true)
    expect(isGarbledText('x'.repeat(40))).toBe(false) // short but not garbled
  })
})

describe('isOcrSupportedMime', () => {
  it('accepts PDF and common image mimes, rejects others', () => {
    expect(isOcrSupportedMime('application/pdf')).toBe(true)
    expect(isOcrSupportedMime('image/png')).toBe(true)
    expect(isOcrSupportedMime('image/jpeg')).toBe(true)
    expect(isOcrSupportedMime('application/vnd.ms-excel')).toBe(false)
    expect(isOcrSupportedMime('text/plain')).toBe(false)
  })
})

describe('extractWithMistralOcr', () => {
  const buf = Buffer.from('%PDF-1.7 fake bytes')
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })
  beforeEach(() => {
    vi.stubEnv('MISTRAL_API_KEY', 'test-key')
  })

  it('is default-OFF: throws a terminal error when MISTRAL_API_KEY is absent', async () => {
    vi.stubEnv('MISTRAL_API_KEY', '')
    await expect(extractWithMistralOcr(buf, 'application/pdf')).rejects.toSatisfy(isOcrTerminalError)
  })

  it('returns concatenated markdown + page count on success', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ pages: [{ markdown: 'Pagina uno OCR' }, { markdown: 'Pagina dos OCR' }] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )))
    const res = await extractWithMistralOcr(buf, 'application/pdf')
    expect(res.provider).toBe('mistral-ocr')
    expect(res.pageCount).toBe(2)
    expect(res.markdown).toContain('Pagina uno OCR')
    expect(res.markdown).toContain('Pagina dos OCR')
    expect(res.markdown).toContain('---') // pages joined by the --- separator (feeds WS2-T4 page provenance)
  })

  it('maps a 429 to a retryable rate-limit error (not terminal)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('rate limited', { status: 429, headers: { 'Retry-After': '12' } })))
    await expect(extractWithMistralOcr(buf, 'application/pdf')).rejects.toSatisfy(isMistralRateLimitError)
  })

  it('maps a 4xx to a terminal error (no retry)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('bad request', { status: 400 })))
    await expect(extractWithMistralOcr(buf, 'application/pdf')).rejects.toSatisfy(isOcrTerminalError)
  })

  it('maps a 5xx to a generic (retryable) error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('server error', { status: 503 })))
    const err = await extractWithMistralOcr(buf, 'application/pdf').catch((e) => e)
    expect(isOcrTerminalError(err)).toBe(false)
    expect(isMistralRateLimitError(err)).toBe(false)
    expect(err).toBeInstanceOf(Error)
  })

  it('treats empty OCR markdown as terminal', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ pages: [{ markdown: '' }, { markdown: '   ' }] }), { status: 200 },
    )))
    await expect(extractWithMistralOcr(buf, 'application/pdf')).rejects.toSatisfy(isOcrTerminalError)
  })

  it('rejects an unsupported mime as terminal before any fetch', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    await expect(extractWithMistralOcr(buf, 'application/vnd.ms-excel')).rejects.toSatisfy(isOcrTerminalError)
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
