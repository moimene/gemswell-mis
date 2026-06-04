#!/usr/bin/env node
/**
 * DMS Ingestion — Gemswell MIS
 *
 * Scans the selected DMS folders (extracted from the OneDrive ZIPs), skips
 * noise, and ingests each file with explicit project_id + doc_type metadata.
 * Idempotent: already-indexed files (matched by source_file name) are skipped.
 *
 * Usage:
 *   node scripts/ingest-dms.mjs                        # full run
 *   node scripts/ingest-dms.mjs --dry-run              # list files only, no write
 *   node scripts/ingest-dms.mjs --folder="Financing"   # partial match on folder path
 *   node scripts/ingest-dms.mjs --project=MAD          # only MAD entries
 *   node scripts/ingest-dms.mjs --limit=20             # stop after N files
 */

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { createClient }  from '@supabase/supabase-js'
import { GoogleGenAI }   from '@google/genai'
import { readFile, readdir, stat, writeFile, unlink } from 'fs/promises'
import { join, extname } from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { tmpdir } from 'os'
import * as XLSX from 'xlsx'
import mammoth from 'mammoth'

const execFileAsync = promisify(execFile)

// ─── Config ───────────────────────────────────────────────────────────────────
const DMS1 = '/Users/moisesmenendez/Dropbox/DESARROLLO/GEMSWELL_MIS/DMS_GEMSWELL/extracted_1'
const DMS2 = '/Users/moisesmenendez/Dropbox/DESARROLLO/GEMSWELL_MIS/DMS_GEMSWELL/extracted_2'

const DRY_RUN      = process.argv.includes('--dry-run')
const FOLDER_FILTER = process.argv.find(a => a.startsWith('--folder='))?.split('=')[1] || null
const PROJECT_FILTER = process.argv.find(a => a.startsWith('--project='))?.split('=')[1] || null
const LIMIT        = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || '0', 10)

const EMBED_MODEL  = 'gemini-embedding-001'
const EMBED_DIMS   = 768
const MAX_CHUNK    = 2000
const OVERLAP      = 200
const LLAMA_API    = 'https://api.cloud.llamaindex.ai/api/v1/parsing'
const LLAMA_KEY    = process.env.LLAMA_CLOUD_API_KEY

// ─── Noise filters ────────────────────────────────────────────────────────────
// Extensions that are never useful for RAG
const SKIP_EXTENSIONS = new Set([
  '.dwg', '.dwl', '.dwl2',           // CAD
  '.jpg', '.jpeg', '.png', '.svg',   // images
  '.ai', '.psd',                     // design
  '.mp4', '.mov', '.avi',            // video
  '.msg', '.eml',                    // email (require attachment extraction)
  '.lnk', '.ds_store',              // system
  '.zip', '.rar', '.7z',            // nested archives
  '.bc3', '.presto', '.pzh',        // cost estimation formats
  '.pc3', '.ctb', '.bak',           // AutoCAD config
  '.xlsb',                           // binary Excel (not parsed well)
])

// Folder name fragments that are always noise — matched anywhere in path
const SKIP_PATH_FRAGMENTS = [
  '/Old/',
  '/old/',
  '/Facturas MPS',
  '/10. Facturas MPS',
  '/11. Revision Facturas MPS',
  '/5. INVOICES',
  '/Facturas/',
  '/facturas/',
  '/FACTURAS/',
  '/01. Planos/',
  '/06. Fotos/',
  '/11. Renders/',
  '/04. Surf Academy Material/',
  '/07. Interiorismo/',
  '/wetransfer_',
  '/07. P&O/',
  '/08. AESA/',
  '/10. Sponsor/',
  '/12. F&B/',
  '/__12. F&B/',
  '/__13. LOGO',
  '/__14. SURF ACADEMY/',
  '/__15. RETAIL/',
  '/__19. Eventos/',
  '/17.Cumplimiento',
  '/__17.Cumplimiento',
  '/5. Marketing/',
  '/7. Diseño/',
  '/4. ESG/',
  '/12. Videos/',
  '/23. Recursos de imagen',
  '/1. Branding/',
  '/18. Logo MPS/',
  '/21.Logos',
  '/22. Comunicación/',
  '/9. Gastos/',
  '/GASTOS/',
  '/Remesas de pagos/',
  '/P&O/',
  '/CV/',
  '/5 CV/',
  '/Fotos/',
  '/Renders',
  '/Música',
  '/LOGO',
  '/Palco/Cocina',
  '/Palco/Diseño interior',
  '/SGPD_',
  '/HACCP/',
  '/Teasers/',
  '/_Error.txt',
]

// ─── Folder map ───────────────────────────────────────────────────────────────
// Each entry: { base, folder, project_id, doc_type, authority, recursive }
// authority: 95 = executed legal/financial contract
//            90 = official report / signed document
//            85 = working model / monitoring
//            80 = board pack / investor material
//            75 = DD / analysis
//            70 = other
const FOLDER_MAP = [
  // ── MAD — Controlling ───────────────────────────────────────────────────
  { base: DMS1, folder: '01. Controlling/01. Cash Flow',       project_id: 'MAD', doc_type: 'cash_flow',          authority: 85 },
  { base: DMS1, folder: '01. Controlling/3. Extracto bancario', project_id: 'MAD', doc_type: 'bank_statement',     authority: 90 },
  { base: DMS1, folder: '01. Controlling/8. P&L',              project_id: 'MAD', doc_type: 'financial_statements', authority: 85 },
  { base: DMS1, folder: '01. Controlling/9. FINANCIACION',     project_id: 'MAD', doc_type: 'funding',             authority: 90 },
  { base: DMS1, folder: '01. Controlling/2. UW BP',            project_id: 'MAD', doc_type: 'bp_model',            authority: 85 },
  { base: DMS1, folder: '01. Controlling/4. BP Reporting Model', project_id: 'MAD', doc_type: 'bp_model',          authority: 85 },
  { base: DMS1, folder: '01. Controlling/11. Balances',        project_id: 'MAD', doc_type: 'financial_statements', authority: 90 },
  { base: DMS1, folder: '01. Controlling/6. Seguros',          project_id: 'MAD', doc_type: 'other',               authority: 75 },
  { base: DMS1, folder: '01. Controlling/7. Membresias',       project_id: 'MAD', doc_type: 'other',               authority: 80 },

  // ── MAD — SL (corporate + accounts) ────────────────────────────────────
  { base: DMS1, folder: '02. SL/Accounts. Administration',     project_id: 'MAD', doc_type: 'financial_statements', authority: 90 },
  { base: DMS1, folder: '02. SL/Auditorias',                   project_id: 'MAD', doc_type: 'financial_statements', authority: 95 },
  { base: DMS1, folder: '02. SL/DD',                           project_id: 'MAD', doc_type: 'other',               authority: 75 },
  { base: DMS1, folder: '02. SL/Estados contables',            project_id: 'MAD', doc_type: 'financial_statements', authority: 90 },
  { base: DMS1, folder: '02. SL/Impuestos',                    project_id: 'MAD', doc_type: 'other',               authority: 80 },

  // ── KLP — Structure memos ───────────────────────────────────────────────
  { base: DMS1, folder: '02. SL/Memo estructura',              project_id: 'KLP', doc_type: 'legal',               authority: 80 },

  // ── MAD — Legal ────────────────────────────────────────────────────────
  { base: DMS1, folder: '03. Legal/1. Acuerdo Marco',          project_id: 'MAD', doc_type: 'legal',               authority: 95 },
  { base: DMS1, folder: '03. Legal/3. AMA',                    project_id: 'MAD', doc_type: 'asset_management',    authority: 95 },
  { base: DMS1, folder: '03. Legal/10. Pacto de Socios',       project_id: 'KLP', doc_type: 'legal',               authority: 95 },
  { base: DMS1, folder: '03. Legal/12. Capital Call',          project_id: 'KLP', doc_type: 'legal',               authority: 90 },
  { base: DMS1, folder: '03. Legal/13. Seguros',               project_id: 'MAD', doc_type: 'other',               authority: 80 },
  { base: DMS1, folder: '03. Legal/8. Informes varios',        project_id: 'MAD', doc_type: 'other',               authority: 75 },
  { base: DMS1, folder: '03. Legal/9. Consejo de Administración', project_id: 'MAD', doc_type: 'board',            authority: 90 },
  // Key contractor contracts only
  { base: DMS1, folder: '03. Legal/7. Contratos/08. Wavegarden', project_id: 'GVF', doc_type: 'legal',            authority: 95 },
  { base: DMS1, folder: '03. Legal/7. Contratos/09. Acciona',  project_id: 'MAD', doc_type: 'legal',               authority: 95 },
  { base: DMS1, folder: '03. Legal/7. Contratos/28. Constructora San José', project_id: 'MAD', doc_type: 'legal',  authority: 95 },
  { base: DMS1, folder: '03. Legal/7. Contratos/05. Hill',     project_id: 'MAD', doc_type: 'legal',               authority: 90 },
  { base: DMS1, folder: '03. Legal/7. Contratos/06. Typsa',    project_id: 'MAD', doc_type: 'legal',               authority: 90 },
  { base: DMS1, folder: '03. Legal/7. Contratos/16. KPMG',     project_id: 'MAD', doc_type: 'legal',               authority: 90 },
  { base: DMS1, folder: '03. Legal/7. Contratos/23. EY',       project_id: 'MAD', doc_type: 'legal',               authority: 90 },
  { base: DMS1, folder: '03. Legal/7. Contratos/0. Contratos sponsorships', project_id: 'MAD', doc_type: 'legal',  authority: 85 },

  // ── MAD — Asset Information (no drawings, no photos) ───────────────────
  { base: DMS1, folder: '04. Asset Information/03. Cost Allocation', project_id: 'MAD', doc_type: 'capex',         authority: 85 },
  { base: DMS1, folder: '04. Asset Information/09. Reuniones quincenales', project_id: 'MAD', doc_type: 'monitoring', authority: 80 },
  { base: DMS1, folder: '04. Asset Information/10. Órdenes de cambio', project_id: 'MAD', doc_type: 'capex',       authority: 85 },
  { base: DMS1, folder: '04. Asset Information/02. Informe geotécnico', project_id: 'MAD', doc_type: 'other',      authority: 75 },
  { base: DMS1, folder: '04. Asset Information/15. PRE OPENING PLAN', project_id: 'MAD', doc_type: 'monitoring',  authority: 80 },

  // ── MAD — Monitoring (full Due Diligence + Monitoring) ─────────────────
  { base: DMS1, folder: '06.Monitoring',                        project_id: 'MAD', doc_type: 'monitoring',         authority: 85 },

  // ── MAD — Board (Consejo Administración) ────────────────────────────────
  { base: DMS1, folder: '09. Consejo Administración',           project_id: 'MAD', doc_type: 'board',              authority: 90 },

  // ── KLP — Capital call ──────────────────────────────────────────────────
  { base: DMS1, folder: '11. Capital call 6 sept',              project_id: 'KLP', doc_type: 'legal',              authority: 90 },

  // ── MAD — Membership (financial / legal only) ───────────────────────────
  { base: DMS1, folder: '__16. Membership/0. Forecast & Cash Flow', project_id: 'MAD', doc_type: 'cash_flow',     authority: 80 },
  { base: DMS1, folder: '__16. Membership/3. LEGAL',            project_id: 'MAD', doc_type: 'legal',             authority: 90 },

  // ── MAD — Financing (full DD package) ──────────────────────────────────
  { base: DMS1, folder: '__18. Financing',                      project_id: 'MAD', doc_type: 'funding',            authority: 90 },
  { base: DMS1, folder: '18. Financing',                        project_id: 'MAD', doc_type: 'funding',            authority: 85 },

  // ── KLP / GVF — extracted_2 ─────────────────────────────────────────────
  { base: DMS2, folder: '0. GEMSWELL VENTURES SL/Due Diligence Final', project_id: 'KLP', doc_type: 'other',      authority: 75 },
  { base: DMS2, folder: '0. GEMSWELL VENTURES SL/Financing  Debt',     project_id: 'KLP', doc_type: 'funding',    authority: 90 },
  { base: DMS2, folder: '0. GEMSWELL VENTURES SL/Memo Estructura',     project_id: 'KLP', doc_type: 'legal',      authority: 80 },
  { base: DMS2, folder: '0. GEMSWELL VENTURES SL/SL',                  project_id: 'KLP', doc_type: 'legal',      authority: 85 },
  { base: DMS2, folder: '1. GEMSWELL VENTURES/03. Ventures/1. BP',     project_id: 'GVF', doc_type: 'bp_model',   authority: 85 },
  { base: DMS2, folder: '1. GEMSWELL VENTURES/03. Ventures/3. INVESTORS', project_id: 'PHILAE', doc_type: 'other', authority: 80 },
  { base: DMS2, folder: '1. GEMSWELL VENTURES/03. Ventures/10. LEGAL', project_id: 'GVF', doc_type: 'legal',      authority: 90 },
  { base: DMS2, folder: '1. GEMSWELL VENTURES/03. Ventures/12. SL',    project_id: 'GVF', doc_type: 'legal',      authority: 85 },
  { base: DMS2, folder: '1. GEMSWELL VENTURES/03. Ventures/14. M&A',   project_id: 'GVF', doc_type: 'other',      authority: 75 },
  { base: DMS2, folder: '1. GEMSWELL VENTURES/03. Ventures/15. Controlling', project_id: 'GVF', doc_type: 'financial_statements', authority: 85 },
  { base: DMS2, folder: '1. GEMSWELL VENTURES/6. Wavegarden/1. Legal', project_id: 'GVF', doc_type: 'legal',      authority: 95 },
  { base: DMS2, folder: '1. GEMSWELL VENTURES/6. Wavegarden/6. Surf Park Case Studies', project_id: 'GVF', doc_type: 'other', authority: 70 },
  { base: DMS2, folder: '1. GEMSWELL VENTURES/6. Wavegarden/7. Revisión de temas pendientes', project_id: 'GVF', doc_type: 'monitoring', authority: 75 },
  { base: DMS2, folder: '1. GEMSWELL VENTURES/6. Wavegarden/8. Operaciones', project_id: 'GVF', doc_type: 'other', authority: 75 },
  { base: DMS2, folder: '1. GEMSWELL VENTURES/10. KELPA/1. SL',        project_id: 'KLP', doc_type: 'legal',      authority: 90 },
  { base: DMS2, folder: '1. GEMSWELL VENTURES/8. SWI/1. LEGAL',        project_id: 'GVF', doc_type: 'legal',      authority: 90 },
  { base: DMS2, folder: '1. GEMSWELL VENTURES/9. VDR',                 project_id: 'GVF', doc_type: 'other',      authority: 75 },
]

// ─── Clients ──────────────────────────────────────────────────────────────────
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)
const genai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY })

function log(msg) {
  const ts = new Date().toISOString().slice(11, 19)
  console.log(`${ts} ${msg}`)
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

// ─── Noise checks ─────────────────────────────────────────────────────────────
function isNoiseExtension(filePath) {
  return SKIP_EXTENSIONS.has(extname(filePath).toLowerCase())
}

function isNoisePath(filePath) {
  return SKIP_PATH_FRAGMENTS.some(frag => filePath.includes(frag))
}

function isEmptyOrTiny(sizeBytes) {
  return sizeBytes < 512  // skip empty files and near-empty stubs
}

// ─── Collect files from a folder entry ────────────────────────────────────────
async function collectFiles(entry) {
  const root = join(entry.base, entry.folder)
  const results = []

  async function walk(dir) {
    let entries
    try { entries = await readdir(dir) } catch { return }
    for (const name of entries) {
      const full = join(dir, name)
      let s
      try { s = await stat(full) } catch { continue }
      if (s.isDirectory()) {
        await walk(full)
      } else if (s.isFile()) {
        if (isNoiseExtension(full)) continue
        if (isNoisePath(full)) continue
        if (isEmptyOrTiny(s.size)) continue
        if (name.startsWith('~$')) continue           // Office temp files
        if (name.startsWith('.')) continue             // hidden files
        if (name.endsWith('_Error.txt')) continue
        results.push({ filePath: full, fileName: name, sizeBytes: s.size, entry })
      }
    }
  }

  await walk(root)
  return results
}

// ─── Already indexed check ────────────────────────────────────────────────────
async function isAlreadyIndexed(fileName) {
  const { count } = await supabase
    .from('rag_chunks')
    .select('id', { count: 'exact', head: true })
    .eq('metadata->>source_file', fileName)
  return (count || 0) > 0
}

// ─── LlamaParse ───────────────────────────────────────────────────────────────
const PARSE_INSTRUCTIONS = `
You are parsing financial and legal documents from a wave park development company (Gemswell Ventures / Madrid Playa Surf).
These are critical investment, legal, and operational documents — accuracy is paramount.

EXCEL-SPECIFIC RULES:
- Extract ALL sheets that contain data (skip navigation/separator sheets)
- For each sheet, output a clear markdown heading with the sheet name
- Preserve ALL table headers including multi-row headers
- Convert Excel date serial numbers to human-readable dates
- Preserve full numeric precision — do NOT round numbers
- Output currency values with their symbols (€/£)
- For CapEx and cash flow tables, preserve category groupings and subtotals
- For financial models, preserve all period columns (monthly/quarterly)

PDF-SPECIFIC RULES:
- Extract all text maintaining document structure
- Preserve table formatting as markdown tables
- For contracts: preserve clause numbers, amounts, dates, and party names exactly
- For financing contracts: extract covenant thresholds, drawdown conditions, repayment schedules
- For board minutes: preserve resolutions, votes, and key decisions

GENERAL: Output in clean markdown. Use ## for section headers. Do NOT summarize or skip data.
`.trim()

async function parseLlama(buffer, fileName) {
  const formData = new FormData()
  formData.append('file', new Blob([new Uint8Array(buffer)]), fileName)
  formData.append('parsing_instruction', PARSE_INSTRUCTIONS)
  formData.append('result_type', 'markdown')
  formData.append('premium_mode', 'true')

  const uploadRes = await fetch(`${LLAMA_API}/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${LLAMA_KEY}` },
    body: formData,
  })
  if (!uploadRes.ok) throw new Error(`LlamaParse upload: ${uploadRes.status} ${await uploadRes.text()}`)

  const { id: jobId } = await uploadRes.json()
  log(`    ⏳ Job ${jobId.slice(0, 8)}...`)

  for (let i = 0; i < 180; i++) {
    await sleep(5000)
    const s = await (await fetch(`${LLAMA_API}/job/${jobId}`, { headers: { Authorization: `Bearer ${LLAMA_KEY}` } })).json()
    if (i % 12 === 0 && i > 0) log(`    ⏳ ${i * 5}s...`)
    if (s.status === 'SUCCESS') {
      const r = await (await fetch(`${LLAMA_API}/job/${jobId}/result/markdown`, { headers: { Authorization: `Bearer ${LLAMA_KEY}` } })).json()
      const md = r.markdown || r.text || ''
      return { content: md, parser: 'llamaparse' }
    }
    if (s.status === 'ERROR') throw new Error(`LlamaParse error: ${s.error}`)
  }
  throw new Error('LlamaParse timeout')
}

async function parseExcelLocal(buffer, fileName) {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  const skipRe = [/^.*-->?\s*$/i, /^(support|output|inputs)\s*->/i]
  const sections = []
  for (const name of wb.SheetNames) {
    if (skipRe.some(re => re.test(name.trim()))) continue
    const ws = wb.Sheets[name]
    if (!ws['!ref']) continue
    const range = XLSX.utils.decode_range(ws['!ref'])
    if (range.e.r < 2) continue
    const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false })
    const rows = data.filter(r => r?.filter(c => c != null && String(c).trim() !== '').length > 0)
    if (!rows.length) continue
    const maxCols = Math.min(rows.reduce((m, r) => Math.max(m, r?.length || 0), 0), 50)
    let md = `\n## ${name}\n\n`
    for (let i = 0; i < rows.length; i++) {
      const cells = Array.from({ length: maxCols }, (_, j) => {
        const v = rows[i]?.[j]
        if (v == null) return ''
        if (v instanceof Date) return v.toISOString().slice(0, 10)
        return String(v).trim().replace(/\|/g, '\\|').substring(0, 120)
      })
      md += `| ${cells.join(' | ')} |\n`
      if (i === 0) md += `| ${cells.map(() => '---').join(' | ')} |\n`
    }
    sections.push(md)
  }
  const content = `# ${fileName}\n${sections.join('\n')}`
  return { content, parser: 'local-xlsx' }
}

async function parsePdfLocal(buffer, fileName) {
  // Write buffer to a temp file, run pdftotext, read result
  const tmp = join(tmpdir(), `mis_pdf_${Date.now()}_${Math.random().toString(36).slice(2)}.pdf`)
  await writeFile(tmp, buffer)
  try {
    const { stdout } = await execFileAsync('pdftotext', ['-layout', '-enc', 'UTF-8', tmp, '-'], { maxBuffer: 50 * 1024 * 1024 })
    const text = stdout.trim()
    if (!text || text.length < 50) throw new Error('pdftotext: empty output')
    return { content: `# ${fileName}\n\n${text}`, parser: 'pdftotext' }
  } finally {
    await unlink(tmp).catch(() => null)
  }
}

async function parseDocxLocal(buffer, fileName) {
  const result = await mammoth.convertToMarkdown({ buffer })
  const md = result.value.trim()
  if (!md || md.length < 50) throw new Error('mammoth: empty output')
  return { content: `# ${fileName}\n\n${md}`, parser: 'mammoth' }
}

async function parseDocument(buffer, fileName) {
  const ext = extname(fileName).toLowerCase()
  // Try LlamaParse first if we have a key and credits
  if (LLAMA_KEY) {
    try { return await parseLlama(buffer, fileName) }
    catch (err) {
      const msg = err.message || ''
      const creditsExhausted = msg.includes('402') || msg.includes('credits') || msg.includes('exceeded')
      log(`    ⚠️ LlamaParse failed: ${msg.slice(0, 80)}`)
      // Fall through to local parsers
      if (creditsExhausted) log('    💡 Credits exhausted — using local parser')
    }
  }
  // Local fallbacks by type
  if (ext === '.xlsx' || ext === '.xls') return await parseExcelLocal(buffer, fileName)
  if (ext === '.pdf')                    return await parsePdfLocal(buffer, fileName)
  if (ext === '.docx' || ext === '.doc') return await parseDocxLocal(buffer, fileName)
  throw new Error(`No local parser for ${ext}`)
}

// ─── Chunking ─────────────────────────────────────────────────────────────────
function chunkContent(text, baseMeta) {
  const lines = text.split('\n')
  const tabular = lines.filter(l => /\t/.test(l) || (l.split('|').length > 3 && /\d/.test(l)))
  return tabular.length >= 3
    ? chunkTabular(lines, baseMeta)
    : chunkNarrative(text, baseMeta)
}

function chunkTabular(lines, base) {
  const chunks = []
  let section = '', rows = [], header = ''
  for (const line of lines) {
    const t = line.trim()
    if (!t) continue
    if (!header && (t.split('|').length > 3) && !/\d{3,}/.test(t.replace(/,/g, ''))) { header = t; continue }
    const isHeader = /^#+\s/.test(t) || (/^[A-Z]/.test(t) && !t.includes('|') && t.length < 80)
    if (isHeader && rows.length > 0) { chunks.push(makeChunk(header, section, rows, base)); rows = [] }
    if (isHeader) section = t.replace(/^#+\s*/, '')
    else rows.push(t)
  }
  if (rows.length) chunks.push(makeChunk(header, section, rows, base))
  return chunks.flatMap(c => c.content.length > MAX_CHUNK * 1.5 ? splitChunk(c) : [c])
}

function makeChunk(header, section, rows, base) {
  const content = [section ? `## ${section}` : '', header, ...rows].filter(Boolean).join('\n')
  return { content, metadata: { ...base, section, chunk_type: 'table_section' }, tokenEstimate: Math.ceil(content.length / 4) }
}

function splitChunk(chunk) {
  const lines = chunk.content.split('\n')
  const hdr = lines[0]?.startsWith('##') ? lines.shift() : ''
  const sub = []
  let cur = hdr ? [hdr] : [], len = hdr.length
  for (const l of lines) {
    if (len + l.length > MAX_CHUNK && cur.length > 1) {
      sub.push({ content: cur.join('\n'), metadata: { ...chunk.metadata }, tokenEstimate: Math.ceil(cur.join('\n').length / 4) })
      cur = hdr ? [hdr] : []; len = hdr.length
    }
    cur.push(l); len += l.length
  }
  if (cur.length > (hdr ? 1 : 0)) sub.push({ content: cur.join('\n'), metadata: { ...chunk.metadata }, tokenEstimate: Math.ceil(cur.join('\n').length / 4) })
  return sub
}

function chunkNarrative(text, base) {
  const paras = text.split(/\n{2,}/)
  const chunks = []
  let cur = ''
  for (const p of paras) {
    const t = p.trim()
    if (!t) continue
    if (cur.length + t.length > MAX_CHUNK && cur.length > 0) {
      chunks.push({ content: cur.trim(), metadata: { ...base, chunk_type: 'narrative' }, tokenEstimate: Math.ceil(cur.length / 4) })
      const words = cur.split(/\s+/)
      cur = words.slice(-Math.ceil(OVERLAP / 5)).join(' ') + '\n\n'
    }
    cur += t + '\n\n'
  }
  if (cur.trim()) chunks.push({ content: cur.trim(), metadata: { ...base, chunk_type: 'narrative' }, tokenEstimate: Math.ceil(cur.length / 4) })
  return chunks
}

// ─── Embed ────────────────────────────────────────────────────────────────────
async function embedText(text) {
  const result = await genai.models.embedContent({
    model: EMBED_MODEL,
    contents: text,
    config: { outputDimensionality: EMBED_DIMS },
  })
  return result.embeddings?.[0]?.values || []
}

// ─── Process one file ─────────────────────────────────────────────────────────
async function processFile({ filePath, fileName, sizeBytes, entry }) {
  const baseMeta = {
    source_file: fileName,
    project_id:  entry.project_id,
    doc_type:    entry.doc_type,
    authority:   entry.authority,
    dms_folder:  entry.folder,
  }

  log(`  📄 ${fileName}`)
  log(`     ${entry.project_id} | ${entry.doc_type} | authority=${entry.authority} | ${(sizeBytes / 1024).toFixed(0)}KB`)

  if (DRY_RUN) { log(`     🔶 DRY RUN`); return 0 }

  const buffer = await readFile(filePath)
  const parsed = await parseDocument(buffer, fileName)
  if (!parsed.content || parsed.content.trim().length < 50)
    throw new Error(`Empty parse (${parsed.content?.length ?? 0} chars)`)

  const chunks = chunkContent(parsed.content, baseMeta)
  log(`     🔪 ${chunks.length} chunks (${parsed.parser})`)
  if (!chunks.length) throw new Error('No chunks produced')

  const { data: ragDoc, error: docErr } = await supabase
    .from('rag_documents')
    .insert({ title: fileName, source_type: extname(fileName).replace('.', ''), chunk_count: chunks.length, status: 'processing' })
    .select('id').single()
  if (docErr) throw new Error(`rag_documents: ${docErr.message}`)

  let inserted = 0
  for (let i = 0; i < chunks.length; i += 5) {
    const batch = chunks.slice(i, i + 5)
    try {
      const embeddings = await Promise.all(batch.map(c => embedText(c.content)))
      if (!embeddings.every(e => Array.isArray(e) && e.length === EMBED_DIMS)) continue
      const rows = batch.map((c, j) => ({
        document_id: ragDoc.id,
        chunk_index: i + j,
        content:     c.content,
        embedding:   JSON.stringify(embeddings[j]),
        metadata:    c.metadata,
        token_count: c.tokenEstimate,
      }))
      const { error } = await supabase.from('rag_chunks').insert(rows)
      if (error) { log(`     ⚠️ Insert: ${error.message}`); continue }
      inserted += batch.length
    } catch (err) {
      log(`     ⚠️ Embed: ${err.message}`)
      if (err.message?.includes('429')) { log(`     🕐 Rate limit — 10s`); await sleep(10000) }
    }
  }

  await supabase.from('rag_documents').update({ status: 'indexed', chunk_count: inserted }).eq('id', ragDoc.id)
  log(`     ✅ ${inserted}/${chunks.length} chunks`)
  return inserted
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  log('')
  log('════════════════════════════════════════════════════════════')
  log('DMS INGESTION — Gemswell MIS')
  log(`Dry run:  ${DRY_RUN}`)
  log(`Filter:   folder=${FOLDER_FILTER || 'all'} project=${PROJECT_FILTER || 'all'} limit=${LIMIT || '∞'}`)
  log('════════════════════════════════════════════════════════════')

  // Apply CLI filters to folder map
  let map = FOLDER_MAP
  if (FOLDER_FILTER) map = map.filter(e => e.folder.toLowerCase().includes(FOLDER_FILTER.toLowerCase()))
  if (PROJECT_FILTER) map = map.filter(e => e.project_id === PROJECT_FILTER.toUpperCase())

  // Collect all candidate files
  log('\n🔍 Scanning folders...')
  const allFiles = []
  for (const entry of map) {
    const files = await collectFiles(entry)
    allFiles.push(...files)
  }

  // Deduplicate by fileName (same file can appear in overlapping folder scans)
  const seen = new Set()
  const unique = allFiles.filter(f => {
    if (seen.has(f.fileName)) return false
    seen.add(f.fileName)
    return true
  })

  log(`   Found ${unique.length} candidate files (after dedup)`)
  if (DRY_RUN) {
    for (const f of unique) log(`   ${f.entry.project_id} | ${f.entry.doc_type} | ${f.fileName}`)
    log('\n════════════════════════════════════════════════════════════')
    log(`DRY RUN — ${unique.length} files would be processed`)
    log('════════════════════════════════════════════════════════════')
    return
  }

  // Check already indexed
  log('\n🔎 Checking already indexed...')
  const toProcess = []
  for (const f of unique) {
    const already = await isAlreadyIndexed(f.fileName)
    if (already) { log(`   ⏭  ${f.fileName}`); continue }
    toProcess.push(f)
  }
  log(`   ${toProcess.length} files to ingest (${unique.length - toProcess.length} already indexed)`)

  // Apply limit
  const queue = LIMIT > 0 ? toProcess.slice(0, LIMIT) : toProcess

  let totalChunks = 0, errors = 0, processed = 0
  for (const f of queue) {
    log(`\n[${processed + 1}/${queue.length}]`)
    try {
      const chunks = await processFile(f)
      totalChunks += chunks
      processed++
    } catch (err) {
      log(`     ❌ ${err.message}`)
      errors++
    }
    // Brief pause between files to avoid hammering APIs
    await sleep(500)
  }

  log('\n════════════════════════════════════════════════════════════')
  log('DMS INGESTION COMPLETE')
  log(`  Processed:      ${processed}`)
  log(`  Chunks indexed: ${totalChunks}`)
  log(`  Errors:         ${errors}`)
  log(`  Skipped (dup):  ${unique.length - toProcess.length}`)
  log('════════════════════════════════════════════════════════════')
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
