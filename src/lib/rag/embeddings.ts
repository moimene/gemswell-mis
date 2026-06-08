import { GoogleGenAI } from '@google/genai'

// ─── Gemini Embedding ───────────────────────────────────────────────
const MODEL = 'gemini-embedding-001'
const DIMENSIONS = 768
const REST_EMBEDDING_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:embedContent`

let genai: GoogleGenAI | null = null

function numberEnv(name: string, fallback: number): number {
  const value = Number(process.env[name])
  return Number.isFinite(value) && value >= 0 ? value : fallback
}

// ─── Two-lane rate limiter ──────────────────────────────────────────
// The bulk lane (ingest) and the interactive lane (chat query embed) hold
// independent tail/nextAt state, so an interactive query is never queued
// behind a long-running bulk ingest run.
type EmbedLane = 'bulk' | 'interactive'
type Limiter = { tail: Promise<void>; nextAt: number }
const limiters: Record<EmbedLane, Limiter> = {
  bulk: { tail: Promise.resolve(), nextAt: 0 },
  interactive: { tail: Promise.resolve(), nextAt: 0 },
}
export function laneIntervalMs(lane: EmbedLane): number {
  // Interactive is a small spacing only to avoid 429 bursts; Gemini's per-key RPM is far
  // higher, so keep it low (the lane serializes, so N concurrent queries wait ~N×interval).
  return lane === 'interactive'
    ? numberEnv('GEMINI_EMBEDDING_INTERACTIVE_MIN_INTERVAL_MS', 50)
    : numberEnv('GEMINI_EMBEDDING_MIN_INTERVAL_MS', 4000)
}
export type EmbedOpts = { lane?: EmbedLane }

function getApiKey(): string {
  const key = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY
  if (!key) throw new Error('GOOGLE_AI_API_KEY not set')
  return key
}

function getGenAI(): GoogleGenAI {
  if (!genai) genai = new GoogleGenAI({ apiKey: getApiKey() })
  return genai
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function waitForEmbeddingSlot(lane: EmbedLane): Promise<void> {
  const lim = limiters[lane]
  const minIntervalMs = laneIntervalMs(lane)
  const run = lim.tail.then(async () => {
    const waitMs = lim.nextAt - Date.now()
    if (waitMs > 0) await sleep(waitMs)
    lim.nextAt = Date.now() + minIntervalMs
  })
  lim.tail = run.catch(() => undefined)
  return run
}

/** test-only: reset lane state so timing tests are deterministic */
export function __resetEmbeddingLimiters(): void {
  limiters.bulk = { tail: Promise.resolve(), nextAt: 0 }
  limiters.interactive = { tail: Promise.resolve(), nextAt: 0 }
}

function isRateLimitError(err: unknown): boolean {
  const maybe = err as { status?: number; message?: string }
  const message = maybe.message ?? ''
  return maybe.status === 429 || message.includes('429') || message.includes('RESOURCE_EXHAUSTED')
}

async function withEmbeddingRetry<T>(operation: () => Promise<T>, lane: EmbedLane): Promise<T> {
  const maxRetries = numberEnv('GEMINI_EMBEDDING_MAX_RETRIES', 5)
  const baseDelayMs = numberEnv('GEMINI_EMBEDDING_BASE_DELAY_MS', 2000)

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    await waitForEmbeddingSlot(lane)
    try {
      return await operation()
    } catch (err: unknown) {
      if (!isRateLimitError(err) || attempt >= maxRetries) throw err
      const maxDelay = baseDelayMs * 2 ** attempt
      await sleep(Math.floor(Math.random() * maxDelay))
    }
  }

  throw new Error('Gemini embedding retry loop exited unexpectedly')
}

function assertEmbeddingDimensions(embeddings: number[][]): number[][] {
  const invalid = embeddings.find(embedding => embedding.length !== DIMENSIONS)
  if (invalid) {
    throw new Error(`Invalid Gemini embedding dimensions: ${embeddings.map(embedding => embedding.length).join(', ')}`)
  }
  return embeddings
}

async function embedTextsWithSdkBatch(texts: string[], lane: EmbedLane): Promise<number[][]> {
  const ai = getGenAI()
  const result = await withEmbeddingRetry(() => ai.models.embedContent({
    model: MODEL,
    contents: texts,
    config: { outputDimensionality: DIMENSIONS },
  }), lane)
  return (result.embeddings ?? []).map(embedding => embedding.values ?? [])
}

async function embedTextWithRest(text: string, lane: EmbedLane): Promise<number[]> {
  const response = await withEmbeddingRetry(async () => {
    const res = await fetch(REST_EMBEDDING_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': getApiKey(),
      },
      body: JSON.stringify({
        model: `models/${MODEL}`,
        content: { parts: [{ text }] },
        outputDimensionality: DIMENSIONS,
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      const error = new Error(`Gemini embedding REST failed: ${res.status} ${body.slice(0, 500)}`) as Error & { status?: number }
      error.status = res.status
      throw error
    }

    return res.json() as Promise<{ embedding?: { values?: number[] } }>
  }, lane)

  return response.embedding?.values ?? []
}

export async function embedText(text: string, opts: EmbedOpts = {}): Promise<number[]> {
  return (await embedBatch([text], opts))[0] ?? []
}

export async function embedBatch(texts: string[], opts: EmbedOpts = {}): Promise<number[][]> {
  if (!texts.length) return []
  for (const text of texts) {
    if (!text.trim()) throw new Error('Cannot embed empty text')
  }

  const lane: EmbedLane = opts.lane ?? 'bulk'
  const transport = process.env.GEMINI_EMBEDDING_TRANSPORT
  const useRest = transport === 'rest' || texts.length === 1
  const embeddings = useRest
    ? await texts.reduce<Promise<number[][]>>(async (promise, text) => {
      const results = await promise
      results.push(await embedTextWithRest(text, lane))
      return results
    }, Promise.resolve([]))
    : await embedTextsWithSdkBatch(texts, lane)

  if (embeddings.length !== texts.length) {
    throw new Error(`Gemini embedding count mismatch: expected ${texts.length}, got ${embeddings.length}`)
  }

  return assertEmbeddingDimensions(embeddings)
}

// ─── Financial-Aware Chunking ───────────────────────────────────────
export type ChunkMetadata = {
  project_id?: string
  doc_type?: string        // 'capex' | 'cash_flow' | 'funding' | 'bp_model' | 'general'
  period?: string          // 'Q3 2026', '2025-W13', 'FY2027'
  currency?: string        // 'EUR' | 'GBP'
  category?: string        // CapEx category name
  section?: string         // 'summary' | 'detail' | 'assumptions'
  source_file?: string
  document_id?: string
  source_hash?: string
  source_channel?: string
  review_status?: string
  classification_source?: string
  lifecycle?: string
  authority_tier?: string
  authority_score?: number
  parser_used?: string
  ocr_used?: boolean
  md_path?: string
  chunk_type?: string      // 'table_row' | 'table_section' | 'narrative' | 'kpi_summary'
}

export type Chunk = {
  content: string
  metadata: ChunkMetadata
  tokenEstimate: number
}

const MAX_CHUNK_SIZE = 2000    // chars
const CHUNK_OVERLAP = 200      // chars overlap between narrative chunks

/**
 * Financial-aware chunking: detects structure in financial data and chunks
 * accordingly. For tabular data, each logical section (CapEx category, CF quarter,
 * funding instrument) becomes its own chunk with rich metadata. For narrative
 * text, falls back to paragraph-aware splitting.
 */
export function chunkFinancialContent(
  text: string,
  baseMetadata: ChunkMetadata = {}
): Chunk[] {
  // Markdown pipe-tables FIRST (audit A1, the worst-engineered component). LlamaParse emits financial
  // data as `| col | col |` markdown tables whose numbers carry commas (1,234,567), so the legacy
  // comma/tab heuristics either mangle them (tryStructuredChunk) or, when they don't fire, split a table
  // mid-row in chunkNarrative — severing a value from its header. Chunk pipe-tables table-aware (a data
  // row is atomic, the header+separator repeat on every fragment) before anything else.
  const tableAware = tryMarkdownTableChunk(text, baseMetadata)
  if (tableAware.length > 0) return tableAware

  // Try structured chunking next (TSV/CSV)
  const structured = tryStructuredChunk(text, baseMetadata)
  if (structured.length > 0) return structured

  // Fallback: paragraph-aware narrative chunking
  return chunkNarrative(text, baseMetadata)
}

function isPipeRow(l: string): boolean {
  return /^\s*\|.*\|\s*$/.test(l)
}
function isSepRow(l: string): boolean {
  return /^\s*\|[\s:|-]+\|\s*$/.test(l) && l.includes('-')
}

/**
 * Split text into ordered table / non-table segments and chunk each: markdown pipe-table blocks via
 * chunkTableBlock (row-atomic, header repeated), the prose between them via chunkNarrative. Returns []
 * if no genuine table (>=3 rows with a separator second row) is present, so the caller falls through.
 */
function tryMarkdownTableChunk(text: string, base: ChunkMetadata): Chunk[] {
  const lines = text.split(/\r?\n/) // tolerate CRLF — don't leak \r into chunk content (review F2)
  type Seg = { type: 'table' | 'text'; lines: string[] }
  const segs: Seg[] = []
  let i = 0
  let sawTable = false
  while (i < lines.length) {
    if (isPipeRow(lines[i])) {
      const run: string[] = []
      while (i < lines.length && isPipeRow(lines[i])) { run.push(lines[i]); i++ }
      // The separator may sit at row 1 OR row 2 (a caption/title row, or a 2-row header above it — both
      // common LlamaParse shapes). Treat as a table when a separator is in the first 3 rows with ≥1 data
      // row after it; else hand the run to the prose path (review F1). (sepIdx<0 fails the >=1 test.)
      const sepIdx = run.findIndex((r, k) => k >= 1 && k <= 2 && isSepRow(r))
      if (sepIdx >= 1 && run.length >= sepIdx + 2) { segs.push({ type: 'table', lines: run }); sawTable = true }
      else segs.push({ type: 'text', lines: run })
    } else {
      const run: string[] = []
      while (i < lines.length && !isPipeRow(lines[i])) { run.push(lines[i]); i++ }
      segs.push({ type: 'text', lines: run })
    }
  }
  if (!sawTable) return []

  const out: Chunk[] = []
  for (const seg of segs) {
    if (seg.type === 'table') {
      out.push(...chunkTableBlock(seg.lines, base))
    } else {
      const t = seg.lines.join('\n').trim()
      if (t) out.push(...chunkNarrative(t, base))
    }
  }
  return out
}

/** Chunk one markdown table block: header + separator repeat on EVERY fragment; a data row is atomic
 *  (never split, even if a single oversized row exceeds MAX_CHUNK_SIZE). */
function chunkTableBlock(rows: string[], base: ChunkMetadata): Chunk[] {
  // Everything up to AND INCLUDING the separator row is the repeated "prefix" (caption + header(s) + sep),
  // so caption-row / multi-row-header tables keep their header on every fragment (review F1). A run with
  // no separator in the first 3 rows falls back to just rows[0] as the header.
  const sepIdx = rows.findIndex((r, k) => k >= 1 && k <= 2 && isSepRow(r))
  const prefixEnd = sepIdx >= 1 ? sepIdx : 0
  const prefix = rows.slice(0, prefixEnd + 1).join('\n')
  const dataRows = rows.slice(prefixEnd + 1)
  const chunks: Chunk[] = []
  let cur: string[] = []
  let curLen = prefix.length
  const flush = () => {
    if (cur.length === 0) return
    const content = [prefix, ...cur].join('\n')
    chunks.push({
      content,
      metadata: { ...base, ...detectFinancialMetadata(content), chunk_type: 'table_section' },
      tokenEstimate: Math.ceil(content.length / 4),
    })
    cur = []
    curLen = prefix.length
  }
  for (const row of dataRows) {
    if (cur.length > 0 && curLen + row.length + 1 > MAX_CHUNK_SIZE) flush()
    cur.push(row)
    curLen += row.length + 1
  }
  flush()
  if (chunks.length === 0) {
    chunks.push({ content: prefix, metadata: { ...base, chunk_type: 'table_section' }, tokenEstimate: Math.ceil(prefix.length / 4) })
  }
  return chunks
}

/**
 * Detect and chunk structured financial tables.
 * Looks for patterns like:
 *  - CapEx sections with category headers
 *  - Cash flow tables with quarterly columns
 *  - Funding instrument breakdowns
 */
function tryStructuredChunk(text: string, base: ChunkMetadata): Chunk[] {
  const chunks: Chunk[] = []
  const lines = text.split('\n')

  // Detect tabular data (TSV or CSV with numeric columns)
  const tabularLines = lines.filter(l =>
    /\t/.test(l) || (l.split(',').length > 3 && /\d/.test(l))
  )

  if (tabularLines.length < 3) return [] // not tabular enough

  // Group by section headers (lines that are all-caps or bold-like)
  let currentSection = ''
  let currentRows: string[] = []
  let headerRow = ''

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    // Detect header rows (first row with multiple tab/comma separators)
    if (!headerRow && (trimmed.split('\t').length > 2 || trimmed.split(',').length > 3)) {
      const hasNumbers = /\d{3,}/.test(trimmed.replace(/,/g, ''))
      if (!hasNumbers) {
        headerRow = trimmed
        continue
      }
    }

    // Detect section headers
    const isSectionHeader =
      /^[A-Z][A-Z\s&]+$/.test(trimmed) ||
      /^#+\s/.test(trimmed) ||
      (/^[A-Z]/.test(trimmed) && !trimmed.includes('\t') && trimmed.length < 60)

    if (isSectionHeader && currentRows.length > 0) {
      // Flush previous section
      chunks.push(buildTableChunk(headerRow, currentSection, currentRows, base))
      currentRows = []
    }

    if (isSectionHeader) {
      currentSection = trimmed.replace(/^#+\s*/, '')
    } else {
      currentRows.push(trimmed)
    }
  }

  // Flush last section
  if (currentRows.length > 0) {
    chunks.push(buildTableChunk(headerRow, currentSection, currentRows, base))
  }

  // If we produced very few chunks from tabular data, split large ones
  return chunks.flatMap(chunk =>
    chunk.content.length > MAX_CHUNK_SIZE * 1.5
      ? splitLargeChunk(chunk)
      : [chunk]
  )
}

function buildTableChunk(
  header: string,
  section: string,
  rows: string[],
  base: ChunkMetadata
): Chunk {
  const content = [
    section ? `## ${section}` : '',
    header || '',
    ...rows
  ].filter(Boolean).join('\n')

  // Detect metadata from content
  const detectedMeta = detectFinancialMetadata(content)

  return {
    content,
    metadata: {
      ...base,
      ...detectedMeta,
      section: section || base.section,
      chunk_type: 'table_section',
    },
    tokenEstimate: Math.ceil(content.length / 4),
  }
}

function splitLargeChunk(chunk: Chunk): Chunk[] {
  const lines = chunk.content.split('\n')
  const header = lines[0]?.startsWith('##') ? lines.shift()! : ''
  const subChunks: Chunk[] = []
  let current: string[] = header ? [header] : []
  let currentLen = header.length

  for (const line of lines) {
    if (currentLen + line.length > MAX_CHUNK_SIZE && current.length > 1) {
      subChunks.push({
        content: current.join('\n'),
        metadata: { ...chunk.metadata },
        tokenEstimate: Math.ceil(current.join('\n').length / 4),
      })
      current = header ? [header] : []
      currentLen = header.length
    }
    current.push(line)
    currentLen += line.length
  }

  if (current.length > (header ? 1 : 0)) {
    subChunks.push({
      content: current.join('\n'),
      metadata: { ...chunk.metadata },
      tokenEstimate: Math.ceil(current.join('\n').length / 4),
    })
  }

  return subChunks
}

/**
 * Paragraph-aware narrative chunking with overlap.
 */
function chunkNarrative(text: string, base: ChunkMetadata): Chunk[] {
  const paragraphs = text.split(/\n{2,}/)
  const chunks: Chunk[] = []
  let current = ''

  for (const para of paragraphs) {
    const trimmed = para.trim()
    if (!trimmed) continue

    if (current.length + trimmed.length > MAX_CHUNK_SIZE && current.length > 0) {
      const detectedMeta = detectFinancialMetadata(current)
      chunks.push({
        content: current.trim(),
        metadata: { ...base, ...detectedMeta, chunk_type: 'narrative' },
        tokenEstimate: Math.ceil(current.length / 4),
      })
      // Keep overlap from end of current chunk
      const words = current.split(/\s+/)
      const overlapWords = words.slice(-Math.ceil(CHUNK_OVERLAP / 5))
      current = overlapWords.join(' ') + '\n\n'
    }

    current += trimmed + '\n\n'
  }

  if (current.trim()) {
    const detectedMeta = detectFinancialMetadata(current)
    chunks.push({
      content: current.trim(),
      metadata: { ...base, ...detectedMeta, chunk_type: 'narrative' },
      tokenEstimate: Math.ceil(current.length / 4),
    })
  }

  return chunks
}

// ─── Financial Metadata Detection ───────────────────────────────────
const PROJECT_PATTERNS: Record<string, RegExp> = {
  MAD: /\b(madrid|mad|playa\s*surf|spain)\b/i,
  BHX: /\b(birmingham|bhx|uk|england|coventry)\b/i,
}

const PERIOD_PATTERNS = [
  /\b(Q[1-4])\s*(20\d{2})\b/,                    // Q3 2026
  /\b(FY)\s*(20\d{2})\b/,                         // FY2027
  /\b(H[12])\s*(20\d{2})\b/,                      // H1 2025
  /\b(20\d{2})\s*[-–]\s*(W\d{1,2})\b/,           // 2025-W13
  /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*(20\d{2})\b/i,
]

const DOC_TYPE_PATTERNS: Record<string, RegExp> = {
  capex: /\b(capex|capital\s*expenditure|budget\s*baseline|eac|committed\s*amount)\b/i,
  cash_flow: /\b(cash\s*flow|inflow|outflow|13[\s-]*week|liquidity)\b/i,
  funding: /\b(funding|loan|facility|drawn|undrawn|cesce|debt|equity)\b/i,
  bp_model: /\b(business\s*plan|bp\s*model|irr|npv|revenue\s*model)\b/i,
}

const CURRENCY_PATTERNS: Record<string, RegExp> = {
  EUR: /[€]|EUR/i,
  GBP: /[£]|GBP/i,
}

function detectFinancialMetadata(text: string): Partial<ChunkMetadata> {
  const meta: Partial<ChunkMetadata> = {}

  // Detect project
  for (const [pid, re] of Object.entries(PROJECT_PATTERNS)) {
    if (re.test(text)) {
      meta.project_id = pid
      break
    }
  }

  // Detect period
  for (const re of PERIOD_PATTERNS) {
    const match = text.match(re)
    if (match) {
      meta.period = match[0]
      break
    }
  }

  // Detect doc type
  for (const [dtype, re] of Object.entries(DOC_TYPE_PATTERNS)) {
    if (re.test(text)) {
      meta.doc_type = dtype
      break
    }
  }

  // Detect currency
  for (const [ccy, re] of Object.entries(CURRENCY_PATTERNS)) {
    if (re.test(text)) {
      meta.currency = ccy
      break
    }
  }

  return meta
}

export { detectFinancialMetadata, DIMENSIONS }
