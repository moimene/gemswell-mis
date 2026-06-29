import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { parseDocument } from '@/lib/rag/parse'

// Integration of the OCR fallback into parseDocument (Ronda 1 reviewer B must-add). We drive the
// no-LLAMA_CLOUD_API_KEY branch so the OCR fallback is reached WITHOUT mocking LlamaParse's network.
const pdf = Buffer.from('%PDF-1.7 scanned image only, no text layer')

describe('parseDocument — OCR wiring is strictly opt-in (default-OFF)', () => {
  beforeEach(() => {
    vi.stubEnv('LLAMA_CLOUD_API_KEY', '')
    vi.stubEnv('MISTRAL_API_KEY', '')
    vi.stubEnv('MISTRAL_APIKEY_OCR', '')
    vi.stubEnv('MISTRAL_API_KEY_OCR', '')
    vi.stubEnv('RAG_OCR_ENABLED', '')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('default-OFF: no LlamaParse key + no MISTRAL key → original "No parser available" error, OCR never called', async () => {
    vi.stubEnv('LLAMA_CLOUD_API_KEY', '')
    vi.stubEnv('MISTRAL_API_KEY', '')
    vi.stubEnv('MISTRAL_APIKEY_OCR', '')
    vi.stubEnv('MISTRAL_API_KEY_OCR', '')
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    await expect(parseDocument('f.pdf', pdf, 'f.pdf', 'application/pdf')).rejects.toThrow(/No parser available/)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('opt-in gate: MISTRAL key present but RAG_OCR_ENABLED unset → OCR suppressed, original error thrown', async () => {
    vi.stubEnv('LLAMA_CLOUD_API_KEY', '')
    vi.stubEnv('MISTRAL_API_KEY', 'test-key')
    vi.stubEnv('MISTRAL_APIKEY_OCR', '')
    vi.stubEnv('MISTRAL_API_KEY_OCR', '')
    // RAG_OCR_ENABLED intentionally not 'true'
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    await expect(parseDocument('f.pdf', pdf, 'f.pdf', 'application/pdf')).rejects.toThrow(/No parser available/)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('opt-in ON: MISTRAL key + RAG_OCR_ENABLED=true → OCR ingests the scanned PDF (parser=mistral-ocr, ocr_used)', async () => {
    vi.stubEnv('LLAMA_CLOUD_API_KEY', '')
    vi.stubEnv('MISTRAL_API_KEY', 'test-key')
    vi.stubEnv('MISTRAL_APIKEY_OCR', '')
    vi.stubEnv('MISTRAL_API_KEY_OCR', '')
    vi.stubEnv('RAG_OCR_ENABLED', 'true')
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ pages: [{ markdown: 'Escritura OCR pagina uno con texto recuperado.' }] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )))
    const res = await parseDocument('scan.pdf', pdf, 'scan.pdf', 'application/pdf')
    expect(res.parser).toBe('mistral-ocr')
    expect(res.ocr_used).toBe(true)
    expect(res.content).toContain('Escritura OCR')
  })

  it('opt-in ON: local legacy MISTRAL_APIKEY_OCR alias also enables OCR', async () => {
    vi.stubEnv('LLAMA_CLOUD_API_KEY', '')
    vi.stubEnv('MISTRAL_API_KEY', '')
    vi.stubEnv('MISTRAL_APIKEY_OCR', 'test-key')
    vi.stubEnv('MISTRAL_API_KEY_OCR', '')
    vi.stubEnv('RAG_OCR_ENABLED', 'true')
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ pages: [{ markdown: 'Contrato OCR recuperado con alias local.' }] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )))
    const res = await parseDocument('scan.pdf', pdf, 'scan.pdf', 'application/pdf')
    expect(res.parser).toBe('mistral-ocr')
    expect(res.ocr_used).toBe(true)
    expect(res.content).toContain('alias local')
  })

  it('opt-in ON but OCR fails → original "No parser available" error (OCR error never escapes)', async () => {
    vi.stubEnv('LLAMA_CLOUD_API_KEY', '')
    vi.stubEnv('MISTRAL_API_KEY', 'test-key')
    vi.stubEnv('MISTRAL_APIKEY_OCR', '')
    vi.stubEnv('MISTRAL_API_KEY_OCR', '')
    vi.stubEnv('RAG_OCR_ENABLED', 'true')
    vi.stubGlobal('fetch', vi.fn(async () => new Response('boom', { status: 500 })))
    await expect(parseDocument('scan.pdf', pdf, 'scan.pdf', 'application/pdf')).rejects.toThrow(/No parser available/)
  })
})
