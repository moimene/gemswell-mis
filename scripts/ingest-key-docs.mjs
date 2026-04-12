#!/usr/bin/env node
/**
 * One-shot ingestion for the 'key information' folder.
 * Sets explicit project_id + doc_type metadata on every file —
 * no regex-based auto-detection — so these documents land in the
 * correct project bucket with the correct authority tier.
 *
 * Usage:
 *   node scripts/ingest-key-docs.mjs
 *   node scripts/ingest-key-docs.mjs --dry-run
 *   node scripts/ingest-key-docs.mjs --file="BP Model"   # partial match
 */

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { createClient }    from '@supabase/supabase-js'
import { GoogleGenAI }     from '@google/genai'
import { readFile }        from 'fs/promises'
import * as XLSX           from 'xlsx'
import { join }            from 'path'

// ─── Config ───────────────────────────────────────────────────
const FOLDER    = '/Users/moisesmenendez/Downloads/key information'
const SUBFOLDER = '/Users/moisesmenendez/Downloads/key information/carpeta sin título'
const DRY_RUN  = process.argv.includes('--dry-run')
const FILE_FILTER = process.argv.find(a => a.startsWith('--file='))?.split('=')[1] || null

const EMBED_MODEL = 'gemini-embedding-001'
const EMBED_DIMS  = 768
const MAX_CHUNK   = 2000
const OVERLAP     = 200
const LLAMA_API   = 'https://api.cloud.llamaindex.ai/api/v1/parsing'
const LLAMA_KEY   = process.env.LLAMA_CLOUD_API_KEY

// ─── Manifest ─────────────────────────────────────────────────
// authority: 95 = signed legal/financial contract (source of truth)
//            90 = official management report
//            85 = working model / monitoring file
//            75 = portfolio deck / summary
const MANIFEST = [
  // ── MAD — fuente de verdad financiación ───────────────────
  {
    file:       '20260115_BP Reporting Model_Madrid Surf Park v28 (Buena vista update).xlsx',
    project_id: 'MAD',
    doc_type:   'bp_model',
    authority:  90,
    note:       'BP Reporting Model MPS v28 — Buena Vista update',
  },
  {
    file:       '4140-7692-5542 v 1, Piscina de Olas - Contrato de financiación (vfinal).pdf',
    project_id: 'MAD',
    doc_type:   'funding',
    authority:  95,
    note:       'Contrato de financiación principal — Wave Pool / Piscina de Olas',
  },
  {
    file:       '4148-6073-6102 v 1, 1.- MPS_Contrato de Crédito Participativo (Buenavista)_vFF.pdf',
    project_id: 'MAD',
    doc_type:   'funding',
    authority:  95,
    note:       'Contrato de Crédito Participativo Buenavista — MPS',
  },
  {
    file:       'BP_OPCO_V260325_vTBD_EXE vRR.xlsx',
    project_id: 'MAD',
    doc_type:   'bp_model',
    authority:  90,
    note:       'BP OPCO ejecutivo — versión marzo 2026',
  },
  {
    file:       'Market Reading CESCE Buyer Credit - The Urban Surf Ajustado 2026 copia.pdf',
    project_id: 'MAD',
    doc_type:   'funding',
    authority:  85,
    note:       'CESCE Buyer Credit — versión ajustada MAD 2026',
    skip_if_indexed: true,  // already in corpus
  },

  // ── BHX ───────────────────────────────────────────────────
  {
    file:       '20260123_BP Model_Birmingham v15.xlsx',
    project_id: 'BHX',
    doc_type:   'bp_model',
    authority:  90,
    note:       'BP Model Birmingham v15',
  },

  // ── KLP — HoldCo ──────────────────────────────────────────
  {
    file:       'AMA_Kelpa_SW_Infrasports_executed_version.pdf',
    project_id: 'KLP',
    doc_type:   'asset_management',
    authority:  95,
    note:       'AMA ejecutado Kelpa ↔ SW Infrasports',
  },
  {
    file:       'Primera Adenda al AMA.pdf',
    project_id: 'KLP',
    doc_type:   'asset_management',
    authority:  95,
    note:       'Primera Adenda al AMA Kelpa/SW Infrasports',
  },
  {
    file:       'Business Plan Stoneweg Infrasports - Marzo 2026.xlsx',
    project_id: 'KLP',
    doc_type:   'bp_model',
    authority:  85,
    note:       'BP Stoneweg Infrasports (gestora) — marzo 2026',
  },

  // ── GVF — Portfolio ────────────────────────────────────────
  {
    file:       'Waves_-_AMA__Esp__Consolidado__limpio__DEF.pdf',
    project_id: 'GVF',
    doc_type:   'asset_management',
    authority:  90,
    note:       'AMA Wavegarden en español — versión consolidada definitiva',
  },
  {
    file:       'Gemswell Surf Parks - One Pager.pdf',
    project_id: 'GVF',
    doc_type:   'other',
    authority:  70,
    note:       'One-pager Gemswell Surf Parks',
  },
  {
    file:       'Gemswell Surf Parks - Short Deck - 02.2026.pdf',
    project_id: 'GVF',
    doc_type:   'other',
    authority:  70,
    note:       'Investor deck Gemswell — febrero 2026',
  },

  // ── MAD — estados financieros históricos (carpeta sin título) ─
  {
    folder:     SUBFOLDER,
    file:       'MPSCIERREDEF-2025.xlsx',
    project_id: 'MAD',
    doc_type:   'financial_statements',
    authority:  92,
    note:       'Cierre definitivo MPS 2025 — fuente de verdad balance/P&L',
  },
  {
    folder:     SUBFOLDER,
    file:       'MPSCIERREDEF2024.xlsx',
    project_id: 'MAD',
    doc_type:   'financial_statements',
    authority:  92,
    note:       'Cierre definitivo MPS 2024 — fuente de verdad balance/P&L',
  },
  {
    folder:     SUBFOLDER,
    file:       '20240627 BS 2023 - MPS V4.xlsx',
    project_id: 'MAD',
    doc_type:   'financial_statements',
    authority:  90,
    note:       'Balance Sheet MPS 2023 v4',
  },
  {
    folder:     SUBFOLDER,
    file:       'CCAA 2022 MPS - enviadas RM.pdf',
    project_id: 'MAD',
    doc_type:   'financial_statements',
    authority:  90,
    note:       'Cuentas Anuales 2022 MPS — depositadas en Registro Mercantil',
  },
  {
    folder:     SUBFOLDER,
    file:       'Memoria MPS 2022.pdf',
    project_id: 'MAD',
    doc_type:   'financial_statements',
    authority:  90,
    note:       'Memoria abreviada MPS 2022 — año de constitución, actividad nula',
  },

  // ── Skipped ────────────────────────────────────────────────
  // Balances MPS.eml — .eml format requires attachment extraction; handle manually
  // 20260129 MPS Cost Allocation prop.xlsx — already indexed
  // 20260330_CapEx Monitoring CF.xlsx — already indexed
  // Project Ocean - Asset Management Agreement — already indexed
]

// ─── Clients ──────────────────────────────────────────────────
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

// ─── Embedding ────────────────────────────────────────────────
async function embedText(text) {
  const result = await genai.models.embedContent({
    model: EMBED_MODEL,
    contents: text,
    config: { outputDimensionality: EMBED_DIMS },
  })
  return result.embeddings?.[0]?.values || []
}

// ─── Parsers ─────────────────────────────────────────────────
const PARSE_INSTRUCTIONS = `
You are parsing financial documents from a wave park development company (Gemswell Ventures / Madrid Playa Surf).
These are critical investment and legal documents — accuracy is paramount.

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

GENERAL: Output in clean markdown. Use ## for section headers. Do NOT summarize or skip data.
`.trim()

async function parseLlama(buffer, fileName) {
  const formData = new FormData()
  formData.append('file', new Blob([new Uint8Array(buffer)]), fileName)
  formData.append('parsing_instruction', PARSE_INSTRUCTIONS)
  formData.append('result_type', 'markdown')
  formData.append('premium_mode', 'true')

  log(`  📤 Uploading to LlamaParse...`)
  const uploadRes = await fetch(`${LLAMA_API}/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${LLAMA_KEY}` },
    body: formData,
  })
  if (!uploadRes.ok) throw new Error(`LlamaParse upload: ${uploadRes.status} ${await uploadRes.text()}`)

  const { id: jobId } = await uploadRes.json()
  log(`  ⏳ Job ${jobId}...`)

  for (let i = 0; i < 180; i++) {
    await sleep(5000)
    const s = await (await fetch(`${LLAMA_API}/job/${jobId}`, { headers: { Authorization: `Bearer ${LLAMA_KEY}` } })).json()
    if (i % 12 === 0 && i > 0) log(`  ⏳ ${i * 5}s...`)
    if (s.status === 'SUCCESS') {
      const r = await (await fetch(`${LLAMA_API}/job/${jobId}/result/markdown`, { headers: { Authorization: `Bearer ${LLAMA_KEY}` } })).json()
      const md = r.markdown || r.text || ''
      log(`  ✅ LlamaParse: ${md.length} chars`)
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
  log(`  ✅ Local xlsx: ${sections.length} sheets, ${content.length} chars`)
  return { content, parser: 'local-xlsx' }
}

async function parseDocument(buffer, fileName) {
  if (LLAMA_KEY) {
    try { return await parseLlama(buffer, fileName) }
    catch (err) {
      log(`  ⚠️ LlamaParse failed: ${err.message}`)
      if (/\.xlsx?$/i.test(fileName)) return await parseExcelLocal(buffer, fileName)
      throw err
    }
  }
  if (/\.xlsx?$/i.test(fileName)) return await parseExcelLocal(buffer, fileName)
  throw new Error(`No parser for ${fileName}`)
}

// ─── Chunking ─────────────────────────────────────────────────
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

// ─── Check already indexed ────────────────────────────────────
async function isAlreadyIndexed(fileName) {
  const { count } = await supabase
    .from('rag_chunks')
    .select('id', { count: 'exact', head: true })
    .eq('metadata->>source_file', fileName)
  return (count || 0) > 0
}

// ─── Process one file ─────────────────────────────────────────
async function processFile(entry) {
  const filePath = join(entry.folder || FOLDER, entry.file)
  const baseMeta = {
    source_file: entry.file,
    project_id:  entry.project_id,
    doc_type:    entry.doc_type,
    authority:   entry.authority,
    ingest_note: entry.note,
  }

  log(`\n── ${entry.file}`)
  log(`   ${entry.project_id} | ${entry.doc_type} | authority=${entry.authority}`)
  log(`   ${entry.note}`)

  if (DRY_RUN) { log(`   🔶 DRY RUN — skip`); return }

  // Read
  const buffer = await readFile(filePath)
  log(`  📂 ${(buffer.length / 1024).toFixed(0)} KB`)

  // Parse
  const parsed = await parseDocument(buffer, entry.file)
  if (!parsed.content || parsed.content.trim().length < 50)
    throw new Error(`Empty parse result (${parsed.content?.length ?? 0} chars)`)

  // Chunk — base metadata is explicit, no regex detection
  const chunks = chunkContent(parsed.content, baseMeta)
  log(`  🔪 ${chunks.length} chunks (${parsed.parser})`)
  if (!chunks.length) throw new Error('No chunks produced')

  // rag_document record
  const { data: ragDoc, error: docErr } = await supabase
    .from('rag_documents')
    .insert({ title: entry.file, source_type: entry.file.split('.').pop(), chunk_count: chunks.length, status: 'processing' })
    .select('id').single()
  if (docErr) throw new Error(`rag_documents insert: ${docErr.message}`)

  // Embed + insert in batches of 5
  let inserted = 0
  for (let i = 0; i < chunks.length; i += 5) {
    const batch = chunks.slice(i, i + 5)
    try {
      const embeddings = await Promise.all(batch.map(c => embedText(c.content)))
      if (!embeddings.every(e => Array.isArray(e) && e.length === EMBED_DIMS)) {
        log(`  ⚠️ Bad embeddings at batch ${Math.floor(i / 5) + 1}`)
        continue
      }
      const rows = batch.map((c, j) => ({
        document_id:  ragDoc.id,
        chunk_index:  i + j,
        content:      c.content,
        embedding:    JSON.stringify(embeddings[j]),
        metadata:     c.metadata,
        token_count:  c.tokenEstimate,
      }))
      const { error } = await supabase.from('rag_chunks').insert(rows)
      if (error) { log(`  ⚠️ Insert error: ${error.message}`); continue }
      inserted += batch.length
    } catch (err) {
      log(`  ⚠️ Embed batch error: ${err.message}`)
      if (err.message?.includes('429')) { log(`  🕐 Rate limit — waiting 10s`); await sleep(10000) }
    }
  }

  await supabase.from('rag_documents').update({ status: 'indexed', chunk_count: inserted }).eq('id', ragDoc.id)
  log(`  ✅ ${inserted}/${chunks.length} chunks indexed`)
  return inserted
}

// ─── Main ─────────────────────────────────────────────────────
async function main() {
  log('')
  log('════════════════════════════════════════════════════════════')
  log('KEY DOCS INGESTION — Gemswell MIS')
  log(`Folder: ${FOLDER}`)
  log(`Dry run: ${DRY_RUN}`)
  log(`Filter: ${FILE_FILTER || 'all'}`)
  log('════════════════════════════════════════════════════════════')

  let entries = MANIFEST
  if (FILE_FILTER) entries = entries.filter(e => e.file.toLowerCase().includes(FILE_FILTER.toLowerCase()))

  let totalChunks = 0, totalErrors = 0, skipped = 0

  for (const entry of entries) {
    if (entry.skip_if_indexed) {
      const indexed = await isAlreadyIndexed(entry.file)
      if (indexed) { log(`\n⏭  ${entry.file} — already indexed, skipping`); skipped++; continue }
    }

    try {
      const chunks = await processFile(entry)
      if (chunks) totalChunks += chunks
    } catch (err) {
      log(`  ❌ ERROR: ${err.message}`)
      totalErrors++
    }
  }

  log('\n════════════════════════════════════════════════════════════')
  log('INGESTION COMPLETE')
  log(`  Files processed: ${entries.length - skipped - totalErrors}`)
  log(`  Chunks indexed:  ${totalChunks}`)
  log(`  Skipped:         ${skipped}`)
  log(`  Errors:          ${totalErrors}`)
  if (DRY_RUN) log('  ⚠️  DRY RUN — nothing written')
  log('════════════════════════════════════════════════════════════')

  if (!DRY_RUN) {
    log('\n⚠️  NOTE: Balances MPS.eml requires manual extraction.')
    log('   Open the .eml file, save the attachment(s), and ingest separately.')
  }
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
