/**
 * Document parsing module — QUALITY-FIRST for one-time ingestion.
 *
 * Primary: LlamaParse API (premium mode) for all document types.
 * Fallback: Local xlsx parsing only if LlamaParse is unavailable.
 *
 * This is a one-time bulk ingestion — we prioritize parsing quality
 * over speed. LlamaParse premium mode gives the best results for
 * complex financial Excel files with merged cells, date serials,
 * multi-header structures, and currency formatting.
 */

const LLAMA_PARSE_API = 'https://api.cloud.llamaindex.ai/api/v1/parsing'

// Generous timeouts — quality over speed for one-time ingestion
const POLL_INTERVAL_MS = 5000          // 5s between status checks
const MAX_POLL_ATTEMPTS = 180          // 15 minutes max per file
const UPLOAD_TIMEOUT_MS = 120_000      // 2 min upload timeout

type ParseResult = {
  content: string      // Markdown text
  sheets?: string[]    // Sheet names (Excel only)
  pageCount?: number   // PDF page count
  parser: 'llamaparse' | 'local-xlsx'  // Track which parser was used
}

/**
 * Financial-specific parsing instructions for LlamaParse.
 * Tuned for Gemswell wave park development documents.
 */
const FINANCIAL_PARSING_INSTRUCTIONS = `
You are parsing financial documents from a wave park development company (Gemswell Ventures).
These are critical investment documents — accuracy is paramount.

EXCEL-SPECIFIC RULES:
- Extract ALL sheets that contain data (skip navigation/separator sheets like "Wave Park-->", "P&L-->", "Retail -->", "OpCo-->", "Hotel -->")
- For each sheet, output a clear markdown heading with the sheet name
- Preserve ALL table headers, including multi-row headers — merge them into a single header row
- Convert Excel date serial numbers to human-readable dates (e.g., 46023 → Feb 2026, 45726 → Apr 2025)
- Preserve full numeric precision — do NOT round numbers
- Output currency values with their symbols (€ for EUR, £ for GBP)
- For percentage values, show with % symbol
- Preserve the account hierarchy in P&L statements (indent sub-items)
- For CapEx tables, preserve category groupings and subtotals
- For Cash Flow tables, preserve the temporal columns (months/quarters)

PDF-SPECIFIC RULES:
- Extract all text maintaining document structure
- Preserve table formatting as markdown tables
- Extract headers, footers, and page numbers as context
- For multi-column layouts, read left-to-right, top-to-bottom
- Preserve any financial figures with full precision

GENERAL RULES:
- Output in clean markdown format
- Use ## for sheet names / section headers
- Use markdown tables (| col1 | col2 |) for tabular data
- Preserve row labels and column headers exactly as shown
- Do NOT summarize or skip any data rows
- Do NOT add commentary — just extract the raw data faithfully
`.trim()

/**
 * Parse a document — always prefer LlamaParse for maximum quality.
 */
export async function parseDocument(
  _filePath: string,
  fileBuffer: Buffer,
  fileName: string,
  _mimeType: string
): Promise<ParseResult> {
  void _mimeType
  const apiKey = process.env.LLAMA_CLOUD_API_KEY

  if (apiKey) {
    console.log(`[parse] 🚀 Using LlamaParse PREMIUM for: ${fileName} (${(fileBuffer.length / 1024).toFixed(0)}KB)`)
    try {
      const result = await parseLlama(fileBuffer, fileName, apiKey)
      console.log(`[parse] ✅ LlamaParse completed: ${fileName} → ${result.content.length} chars`)
      return result
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown parse error'
      console.error(`[parse] ❌ LlamaParse failed for ${fileName}:`, message)
      // For xlsx, fall back to local parser
      if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        console.log(`[parse] 🔄 Falling back to local xlsx parser for ${fileName}`)
        return parseExcelLocal(fileBuffer, fileName)
      }
      throw err
    }
  }

  console.log(`[parse] ⚠️ No LLAMA_CLOUD_API_KEY — using local fallback for ${fileName}`)

  // Fallback for xlsx: use local xlsx library
  if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
    return parseExcelLocal(fileBuffer, fileName)
  }

  throw new Error(`No parser available for ${fileName}. Set LLAMA_CLOUD_API_KEY for full format support.`)
}

async function parseLlama(
  buffer: Buffer,
  fileName: string,
  apiKey: string
): Promise<ParseResult> {
  // Step 1: Upload file and start parsing job
  const formData = new FormData()
  formData.append('file', new Blob([new Uint8Array(buffer)]), fileName)
  formData.append('parsing_instruction', FINANCIAL_PARSING_INSTRUCTIONS)
  formData.append('result_type', 'markdown')
  formData.append('premium_mode', 'true')
  // Extra settings for financial data quality
  formData.append('skip_diagonal_text', 'true')
  formData.append('do_not_unroll_columns', 'false')
  formData.append('page_separator', '\n---\n')

  console.log(`[parse] Uploading ${fileName} to LlamaParse...`)

  const uploadRes = await fetch(`${LLAMA_PARSE_API}/upload`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}` },
    body: formData,
    signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
  })

  if (!uploadRes.ok) {
    const err = await uploadRes.text()
    throw new Error(`LlamaParse upload failed: ${uploadRes.status} ${err}`)
  }

  const { id: jobId } = await uploadRes.json()
  console.log(`[parse] Job created: ${jobId} — polling for completion...`)

  // Step 2: Poll for completion (up to 15 minutes)
  let attempts = 0

  while (attempts < MAX_POLL_ATTEMPTS) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS))

    const statusRes = await fetch(`${LLAMA_PARSE_API}/job/${jobId}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    })

    const status = await statusRes.json()

    if (attempts % 6 === 0) { // Log every 30s
      console.log(`[parse] Job ${jobId}: status=${status.status} (attempt ${attempts + 1}/${MAX_POLL_ATTEMPTS})`)
    }

    if (status.status === 'SUCCESS') {
      // Step 3: Get result
      console.log(`[parse] Job ${jobId} succeeded! Fetching markdown result...`)
      const resultRes = await fetch(`${LLAMA_PARSE_API}/job/${jobId}/result/markdown`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      })

      const result = await resultRes.json()
      const markdown = result.markdown || result.text || ''

      if (markdown.length < 50) {
        throw new Error(`LlamaParse returned near-empty result (${markdown.length} chars) for ${fileName}`)
      }

      return {
        content: markdown,
        pageCount: status.num_pages,
        parser: 'llamaparse',
      }
    }

    if (status.status === 'ERROR') {
      throw new Error(`LlamaParse job failed: ${status.error || status.error_message || 'Unknown error'}`)
    }

    attempts++
  }

  throw new Error(`LlamaParse job timed out after ${MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS / 60000} minutes`)
}

/**
 * Local Excel parsing fallback using xlsx library.
 * Used only when LlamaParse is unavailable or fails.
 * Handles date serial numbers, skips nav sheets, preserves structure.
 */
async function parseExcelLocal(
  buffer: Buffer,
  fileName: string
): Promise<ParseResult> {
  console.log(`[parse-local] Parsing ${fileName} with local xlsx library`)
  // Dynamic import to avoid bundling xlsx when not needed
  const XLSX = await import('xlsx')
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true })

  // Navigation/separator sheets to skip
  const skipPatterns = [
    /^.*-->?\s*$/i,              // "Wave Park-->", "P&L-->", "Retail -->", etc.
    /^(support|output|inputs)\s*->/i,
  ]

  const sections: string[] = []
  const sheetNames: string[] = []

  for (const name of wb.SheetNames) {
    // Skip navigation sheets
    if (skipPatterns.some(re => re.test(name.trim()))) {
      console.log(`[parse-local] Skipping nav sheet: ${name}`)
      continue
    }

    const ws = wb.Sheets[name]
    if (!ws['!ref']) continue

    const range = XLSX.utils.decode_range(ws['!ref'])
    // Skip empty sheets (< 3 rows of data)
    if (range.e.r < 2) continue

    sheetNames.push(name)

    // Convert to array of arrays
    const data: (string | number | Date | null)[][] = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      defval: null,
      raw: false, // format dates as strings
    })

    // Find first non-empty row (skip blank header rows)
    let startRow = 0
    for (let i = 0; i < Math.min(data.length, 10); i++) {
      const row = data[i]
      const nonEmpty = row?.filter(c => c != null && String(c).trim() !== '').length || 0
      if (nonEmpty >= 2) { startRow = i; break }
    }

    // Build markdown table
    let md = `\n## ${name}\n\n`

    const rows = data.slice(startRow).filter(row => {
      const nonEmpty = row?.filter(c => c != null && String(c).trim() !== '').length || 0
      return nonEmpty > 0
    })

    if (rows.length === 0) continue

    // Determine max columns from data (cap at 50 for one-time quality)
    const maxCols = Math.min(
      rows.reduce((max, row) => Math.max(max, row?.length || 0), 0),
      50
    )

    // Format as markdown table (no row limit for one-time ingestion)
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const cells = Array.from({ length: maxCols }, (_, j) => {
        const val = row?.[j]
        if (val == null) return ''
        return formatCell(val)
      })

      md += `| ${cells.join(' | ')} |\n`

      // Add separator after first row (header)
      if (i === 0) {
        md += `| ${cells.map(() => '---').join(' | ')} |\n`
      }
    }

    sections.push(md)
  }

  const content = `# ${fileName}\n${sections.join('\n')}`
  console.log(`[parse-local] Parsed ${fileName}: ${sheetNames.length} sheets, ${content.length} chars`)

  return {
    content,
    sheets: sheetNames,
    parser: 'local-xlsx',
  }
}

function formatCell(val: unknown): string {
  if (val == null) return ''
  if (val instanceof Date) {
    return val.toISOString().slice(0, 10)
  }
  const s = String(val).trim()
  // Clean up pipe characters that would break markdown tables
  return s.replace(/\|/g, '\\|').substring(0, 120) // 120 chars for quality
}

export { parseExcelLocal }
