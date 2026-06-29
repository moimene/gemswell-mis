/**
 * Mistral OCR fallback adapter (Fase 3 / WS2-T7/T8/T10 — audit A2).
 *
 * Ported from mdl-patrimonio `src/lib/agent/ocr.ts` (D-OCR-01). Standalone: depends only on
 * `MISTRAL_API_KEY` (or legacy/local `MISTRAL_APIKEY_OCR`) + `fetch`. Gemswell wiring: when LlamaParse extracts little/garbage text from a
 * scanned PDF/image (low-text-quality trigger, see `isLowTextQuality`), the ingest calls
 * `extractWithMistralOcr(buffer, mime)` and uses its markdown instead of throwing the "scanned document"
 * error. Default-OFF: with no Mistral OCR key the adapter throws `OcrTerminalError('mistral_api_key_missing')`
 * which the caller swallows, so behavior is identical to today until a key + RAG_OCR_ENABLED are set.
 *
 * Mistral OCR API: POST https://api.mistral.ai/v1/ocr
 *   body { model, document: { type:'document_url'|'image_url', document_url|image_url: <data-uri> } }
 *  - 429 + Retry-After → MistralRateLimitError (caller may retry)
 *  - 4xx non-429        → OcrTerminalError (terminal — do not retry)
 *  - 5xx / timeout      → generic Error (caller may retry)
 *  - empty markdown / too many pages / oversized buffer → OcrTerminalError
 *
 * EU-sovereign (French provider, DPA, data not trained on) — appropriate for financial/legal corpus.
 */

const MISTRAL_OCR_URL = 'https://api.mistral.ai/v1/ocr'
const MISTRAL_OCR_MAX_BYTES = 50_000_000 // 50 MB hard limit (Mistral)
const DEFAULT_MODEL = 'mistral-ocr-latest'
const DEFAULT_MAX_PAGES = 100
const FETCH_TIMEOUT_MS = 60_000

const SUPPORTED_PDF_MIMES = new Set(['application/pdf'])
const SUPPORTED_IMAGE_MIMES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/tiff', 'image/heic'])

// ─── Low-text-quality trigger (audit A2; ports MDL convert.ts single_char_line_ratio) ───────────────
const LOW_QUALITY_MIN_CHARS = 500
const SINGLE_CHAR_LINE_RATIO_MAX = 0.4

/**
 * True when a parser's text output is so poor it is almost certainly a scanned/image-only document:
 *   - fewer than 500 visible chars, OR
 *   - >40% of non-empty lines are a single visible char (classic broken-CMap / encoding garbage).
 * Mirrors the MDL convert.ts heuristic so both apps trigger OCR identically.
 */
export function isLowTextQuality(text: string): boolean {
  const chars = text.length
  if (chars === 0) return true
  if (chars < LOW_QUALITY_MIN_CHARS) return true
  return singleCharLineRatio(text) > SINGLE_CHAR_LINE_RATIO_MAX
}

/**
 * Garbage-only signal: text whose non-empty lines are mostly a single char (broken-CMap garbage), used on
 * the LlamaParse SUCCESS path where a legitimately SHORT but clean document must NOT trigger OCR. Unlike
 * isLowTextQuality it deliberately omits the `< 500 chars` rule — a 300-char clean cover page is not scanned.
 */
export function isGarbledText(text: string): boolean {
  return text.length > 0 && singleCharLineRatio(text) > SINGLE_CHAR_LINE_RATIO_MAX
}

function singleCharLineRatio(text: string): number {
  let nonEmpty = 0
  let singleChar = 0
  for (const raw of text.split('\n')) {
    const trimmed = raw.trim()
    if (trimmed.length === 0) continue
    nonEmpty++
    if (trimmed.length === 1) singleChar++
  }
  return nonEmpty > 0 ? singleChar / nonEmpty : 0
}

/** True if Mistral OCR could handle this mime (PDF or supported image). */
export function isOcrSupportedMime(mimeType: string): boolean {
  return SUPPORTED_PDF_MIMES.has(mimeType) || SUPPORTED_IMAGE_MIMES.has(mimeType)
}

// ─── Public types ────────────────────────────────────────────────────────────
export type OcrProvider = 'mistral-ocr'

export interface OcrResult {
  markdown: string
  pageCount: number
  confidence?: number
  latencyMs: number
  provider: OcrProvider
}

export function mistralOcrApiKey(): string | undefined {
  return process.env.MISTRAL_API_KEY || process.env.MISTRAL_APIKEY_OCR || process.env.MISTRAL_API_KEY_OCR || undefined
}

// ─── Typed errors ─────────────────────────────────────────────────────────────
export class MistralRateLimitError extends Error {
  readonly retryAfterMs: number
  constructor(message: string, retryAfterMs: number) {
    super(message)
    this.name = 'MistralRateLimitError'
    this.retryAfterMs = retryAfterMs
  }
}
export function isMistralRateLimitError(err: unknown): err is MistralRateLimitError {
  return err instanceof Error && err.name === 'MistralRateLimitError'
}

export class OcrTerminalError extends Error {
  readonly terminal = true as const
  readonly reason: string
  readonly detail: unknown
  constructor(reason: string, message: string, detail?: unknown) {
    super(message)
    this.name = 'OcrTerminalError'
    this.reason = reason
    this.detail = detail ?? null
  }
}
export function isOcrTerminalError(err: unknown): err is OcrTerminalError {
  return err instanceof Error && err.name === 'OcrTerminalError'
}

// ─── Internal helpers ──────────────────────────────────────────────────────────
const DEFAULT_RETRY_AFTER_MS = 30_000
const MAX_RETRY_WAIT_MS = 300_000

function parseRetryAfter(headerValue: string | null): number {
  if (!headerValue) return DEFAULT_RETRY_AFTER_MS
  const trimmed = headerValue.trim()
  if (/^\d+$/.test(trimmed)) return Math.min(parseInt(trimmed, 10) * 1000, MAX_RETRY_WAIT_MS)
  const parsedDate = Date.parse(trimmed)
  if (!Number.isNaN(parsedDate)) {
    const diff = parsedDate - Date.now()
    return diff > 0 ? Math.min(diff, MAX_RETRY_WAIT_MS) : DEFAULT_RETRY_AFTER_MS
  }
  return DEFAULT_RETRY_AFTER_MS
}

function getEnvInt(key: string, fallback: number): number {
  const raw = process.env[key]
  if (!raw) return fallback
  const n = parseInt(raw, 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

interface MistralOcrPage {
  index?: number
  markdown?: string
  confidence?: number
}
interface MistralOcrResponse {
  pages?: MistralOcrPage[]
  usage_info?: { pages_processed?: number }
  model?: string
}

/** Build the `data:<mime>;base64,<b64>` URI Mistral expects. */
function toDataUri(buf: Buffer, mimeType: string): string {
  const normalizedMime = mimeType === 'image/jpg' ? 'image/jpeg' : mimeType
  return `data:${normalizedMime};base64,${buf.toString('base64')}`
}

// ─── Public API ────────────────────────────────────────────────────────────────
/**
 * Run a document through Mistral OCR and return markdown + metrics.
 * Throws OcrTerminalError (no retry), MistralRateLimitError (retryable), or generic Error (retryable).
 */
export async function extractWithMistralOcr(buf: Buffer, mimeType: string): Promise<OcrResult> {
  const apiKey = mistralOcrApiKey()
  if (!apiKey) throw new OcrTerminalError('mistral_api_key_missing', 'MISTRAL_API_KEY or MISTRAL_APIKEY_OCR env var not set')
  if (buf.byteLength === 0) throw new OcrTerminalError('empty_buffer', 'Empty buffer, nothing to OCR')
  if (buf.byteLength > MISTRAL_OCR_MAX_BYTES) {
    throw new OcrTerminalError('file_too_large', `Buffer ${buf.byteLength}B exceeds Mistral OCR hard limit ${MISTRAL_OCR_MAX_BYTES}B`)
  }

  const isPdf = SUPPORTED_PDF_MIMES.has(mimeType)
  const isImage = SUPPORTED_IMAGE_MIMES.has(mimeType)
  if (!isPdf && !isImage) {
    throw new OcrTerminalError('unsupported_mime', `MIME not supported by Mistral OCR fallback: ${mimeType}`)
  }

  const model = process.env.MISTRAL_OCR_MODEL || DEFAULT_MODEL
  const maxPages = getEnvInt('MISTRAL_OCR_MAX_PAGES', DEFAULT_MAX_PAGES)
  const dataUri = toDataUri(buf, mimeType)
  const document = isPdf
    ? { type: 'document_url' as const, document_url: dataUri }
    : { type: 'image_url' as const, image_url: dataUri }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  const startedAt = Date.now()
  let resp: Response
  try {
    resp = await fetch(MISTRAL_OCR_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ model, document, include_image_base64: false }),
      signal: controller.signal,
    })
  } catch (err) {
    clearTimeout(timeoutId)
    if (err instanceof Error && err.name === 'AbortError') throw new Error(`Mistral OCR timeout after ${FETCH_TIMEOUT_MS}ms`)
    throw err
  }
  clearTimeout(timeoutId)
  const latencyMs = Date.now() - startedAt

  if (resp.status === 429) {
    const retryAfter = parseRetryAfter(resp.headers.get('Retry-After'))
    const errBody = await resp.text().catch(() => '')
    throw new MistralRateLimitError(`Mistral OCR 429 rate limited (Retry-After=${retryAfter}ms) ${errBody}`.trim(), retryAfter)
  }
  if (!resp.ok) {
    const errBody = await resp.text().catch(() => '')
    if (resp.status >= 400 && resp.status < 500) {
      throw new OcrTerminalError(`mistral_http_${resp.status}`, `Mistral OCR ${resp.status}: ${errBody}`, { status: resp.status, body: errBody })
    }
    throw new Error(`Mistral OCR ${resp.status}: ${errBody}`)
  }

  let json: MistralOcrResponse
  try {
    json = (await resp.json()) as MistralOcrResponse
  } catch (err) {
    throw new OcrTerminalError('invalid_json', `Mistral OCR returned invalid JSON: ${err instanceof Error ? err.message : String(err)}`)
  }

  const pages = json.pages ?? []
  if (pages.length === 0) throw new OcrTerminalError('ocr_empty_result', 'Mistral OCR returned no pages', { usage: json.usage_info ?? null })
  if (pages.length > maxPages) {
    throw new OcrTerminalError('too_many_pages', `Mistral OCR returned ${pages.length} pages (max ${maxPages})`, { pageCount: pages.length, max: maxPages })
  }

  // Concatenate page markdown with the SAME `---` page separator LlamaParse uses, so the WS2-T4 page
  // provenance post-pass stamps OCR'd documents page-by-page too.
  const markdown = pages.map((p) => (p.markdown ?? '').trim()).filter((s) => s.length > 0).join('\n\n---\n\n')
  if (markdown.length === 0) throw new OcrTerminalError('ocr_empty_result', 'Mistral OCR returned empty markdown on every page')

  const confidences = pages.map((p) => p.confidence).filter((c): c is number => typeof c === 'number')
  const confidence = confidences.length > 0 ? confidences.reduce((a, b) => a + b, 0) / confidences.length : undefined

  return { markdown, pageCount: pages.length, confidence, latencyMs, provider: 'mistral-ocr' }
}
