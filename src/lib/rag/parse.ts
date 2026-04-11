/**
 * Document parsing module.
 * Uses LlamaParse API for complex documents (Excel, PDF).
 * Falls back to local xlsx parsing if LlamaParse is unavailable.
 */

const LLAMA_PARSE_API = 'https://api.cloud.llamaindex.ai/api/v1/parsing'

type ParseResult = {
  content: string      // Markdown text
  sheets?: string[]    // Sheet names (Excel only)
  pageCount?: number   // PDF page count
}

/**
 * Parse a document via LlamaParse API.
 * Handles: xlsx, pdf, docx, pptx
 * Returns markdown representation optimized for financial data.
 */
export async function parseDocument(
  filePath: string,
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<ParseResult> {
  const apiKey = process.env.LLAMA_CLOUD_API_KEY

  if (apiKey) {
    return parseLlama(fileBuffer, fileName, apiKey)
  }

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
  // Parsing instructions for financial documents
  formData.append('parsing_instruction',
    'This is a financial document from a wave park development company. ' +
    'Extract all tables with full numeric precision. ' +
    'Convert Excel date serial numbers to human-readable dates (e.g., 46023 → Feb 2026). ' +
    'Preserve column headers and row labels. ' +
    'Skip navigation/empty sheets. ' +
    'For P&L statements, preserve the account hierarchy. ' +
    'Output currency values with their symbols (€/£).'
  )
  formData.append('result_type', 'markdown')
  formData.append('premium_mode', 'true')

  const uploadRes = await fetch(`${LLAMA_PARSE_API}/upload`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}` },
    body: formData,
  })

  if (!uploadRes.ok) {
    const err = await uploadRes.text()
    throw new Error(`LlamaParse upload failed: ${uploadRes.status} ${err}`)
  }

  const { id: jobId } = await uploadRes.json()

  // Step 2: Poll for completion
  let attempts = 0
  const maxAttempts = 60 // 5 minutes max

  while (attempts < maxAttempts) {
    await new Promise(r => setTimeout(r, 5000)) // 5s polling

    const statusRes = await fetch(`${LLAMA_PARSE_API}/job/${jobId}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    })

    const status = await statusRes.json()

    if (status.status === 'SUCCESS') {
      // Step 3: Get result
      const resultRes = await fetch(`${LLAMA_PARSE_API}/job/${jobId}/result/markdown`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      })

      const result = await resultRes.json()
      return {
        content: result.markdown || result.text || '',
        pageCount: status.num_pages,
      }
    }

    if (status.status === 'ERROR') {
      throw new Error(`LlamaParse job failed: ${status.error || 'Unknown error'}`)
    }

    attempts++
  }

  throw new Error('LlamaParse job timed out after 5 minutes')
}

/**
 * Local Excel parsing fallback using xlsx library.
 * Handles date serial numbers, skips nav sheets, preserves structure.
 */
async function parseExcelLocal(
  buffer: Buffer,
  fileName: string
): Promise<ParseResult> {
  // Dynamic import to avoid bundling xlsx when not needed
  const XLSX = await import('xlsx')
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true })

  const skipSheets = new Set(['support ->', 'output ->', 'inputs ->'])
  const sections: string[] = []
  const sheetNames: string[] = []

  for (const name of wb.SheetNames) {
    if (skipSheets.has(name.toLowerCase().trim())) continue

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

    // Determine max columns from data
    const maxCols = Math.min(
      rows.reduce((max, row) => Math.max(max, row?.length || 0), 0),
      30 // cap at 30 columns for readability
    )

    // Format as markdown table
    for (let i = 0; i < rows.length && i < 200; i++) {
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

    if (rows.length > 200) {
      md += `\n*... ${rows.length - 200} more rows truncated*\n`
    }

    sections.push(md)
  }

  return {
    content: `# ${fileName}\n${sections.join('\n')}`,
    sheets: sheetNames,
  }
}

function formatCell(val: unknown): string {
  if (val == null) return ''
  if (val instanceof Date) {
    return val.toISOString().slice(0, 10)
  }
  const s = String(val).trim()
  // Clean up pipe characters that would break markdown tables
  return s.replace(/\|/g, '\\|').substring(0, 80)
}

export { parseExcelLocal }
