import { GoogleGenAI } from '@google/genai'

// ─── Gemini Embedding ───────────────────────────────────────────────
const MODEL = 'gemini-embedding-exp-03-07'
const DIMENSIONS = 768

let genai: GoogleGenAI | null = null
function getGenAI() {
  if (!genai) {
    const key = process.env.GOOGLE_AI_API_KEY
    if (!key) throw new Error('GOOGLE_AI_API_KEY not set')
    genai = new GoogleGenAI({ apiKey: key })
  }
  return genai
}

export async function embedText(text: string): Promise<number[]> {
  const ai = getGenAI()
  const result = await ai.models.embedContent({
    model: MODEL,
    contents: text,
    config: { outputDimensionality: DIMENSIONS },
  })
  return result.embeddings?.[0]?.values || []
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  // Gemini supports batch embedding — process in groups of 100
  const results: number[][] = []
  for (let i = 0; i < texts.length; i += 100) {
    const batch = texts.slice(i, i + 100)
    const promises = batch.map(t => embedText(t))
    const batchResults = await Promise.all(promises)
    results.push(...batchResults)
  }
  return results
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
  // Try structured chunking first
  const structured = tryStructuredChunk(text, baseMetadata)
  if (structured.length > 0) return structured

  // Fallback: paragraph-aware narrative chunking
  return chunkNarrative(text, baseMetadata)
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
