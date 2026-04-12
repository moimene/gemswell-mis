#!/usr/bin/env node
/**
 * Standalone ingestion worker — runs OUTSIDE Next.js dev server.
 * Processes files from ingest_queue directly, no HTTP involved.
 *
 * Usage: node scripts/ingest-worker.mjs [--batch=5] [--max=0]
 *   --batch=N   Process N files per round (default 5)
 *   --max=N     Stop after N total files (0 = no limit, default 0)
 */

import { createClient } from '@supabase/supabase-js'
import { GoogleGenAI } from '@google/genai'
import { CohereClient } from 'cohere-ai'
import { readFile } from 'fs/promises'
import * as XLSX from 'xlsx'
import dotenv from 'dotenv'

// Load .env.local
dotenv.config({ path: '.env.local' })

const DMS_ROOT = process.env.DMS_ROOT || '/Users/moisesmenendez/Dropbox/DESARROLLO/GEMSWELL_MIS/DMS_GEMSWELL'

// ─── Supabase ─────────────────────────────────────────────────
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// ─── Gemini Embeddings ────────────────────────────────────────
const genai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY })
const EMBED_MODEL = 'gemini-embedding-001'
const EMBED_DIMS = 768

async function embedText(text) {
  const result = await genai.models.embedContent({
    model: EMBED_MODEL,
    contents: text,
    config: { outputDimensionality: EMBED_DIMS },
  })
  return result.embeddings?.[0]?.values || []
}

// ─── LlamaParse ───────────────────────────────────────────────
const LLAMA_API = 'https://api.cloud.llamaindex.ai/api/v1/parsing'
const LLAMA_KEY = process.env.LLAMA_CLOUD_API_KEY

const PARSE_INSTRUCTIONS = `
You are parsing financial documents from a wave park development company (Gemswell Ventures).
These are critical investment documents — accuracy is paramount.

EXCEL-SPECIFIC RULES:
- Extract ALL sheets that contain data (skip navigation/separator sheets like "Wave Park-->", "P&L-->", "Retail -->")
- For each sheet, output a clear markdown heading with the sheet name
- Preserve ALL table headers, including multi-row headers
- Convert Excel date serial numbers to human-readable dates
- Preserve full numeric precision — do NOT round numbers
- Output currency values with their symbols (€/£)
- Preserve the account hierarchy in P&L statements
- For CapEx tables, preserve category groupings and subtotals

PDF-SPECIFIC RULES:
- Extract all text maintaining document structure
- Preserve table formatting as markdown tables

GENERAL RULES:
- Output in clean markdown format
- Use ## for section headers
- Use markdown tables for tabular data
- Do NOT summarize or skip any data rows
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

  if (!uploadRes.ok) {
    const err = await uploadRes.text()
    throw new Error(`LlamaParse upload failed: ${uploadRes.status} ${err}`)
  }

  const { id: jobId } = await uploadRes.json()
  log(`  ⏳ Job ${jobId} — polling...`)

  // Poll up to 15 min
  for (let i = 0; i < 180; i++) {
    await sleep(5000)
    const statusRes = await fetch(`${LLAMA_API}/job/${jobId}`, {
      headers: { Authorization: `Bearer ${LLAMA_KEY}` },
    })
    const status = await statusRes.json()

    if (i % 12 === 0 && i > 0) log(`  ⏳ Still processing... (${i * 5}s)`)

    if (status.status === 'SUCCESS') {
      const resultRes = await fetch(`${LLAMA_API}/job/${jobId}/result/markdown`, {
        headers: { Authorization: `Bearer ${LLAMA_KEY}` },
      })
      const result = await resultRes.json()
      const md = result.markdown || result.text || ''
      log(`  ✅ LlamaParse done: ${md.length} chars`)
      return { content: md, parser: 'llamaparse' }
    }

    if (status.status === 'ERROR') {
      throw new Error(`LlamaParse error: ${status.error || status.error_message}`)
    }
  }
  throw new Error('LlamaParse timed out (15min)')
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
    try {
      return await parseLlama(buffer, fileName)
    } catch (err) {
      log(`  ⚠️ LlamaParse failed: ${err.message}`)
      if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        log(`  🔄 Falling back to local xlsx parser`)
        return await parseExcelLocal(buffer, fileName)
      }
      throw err
    }
  }
  if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
    return await parseExcelLocal(buffer, fileName)
  }
  throw new Error(`No parser for ${fileName}`)
}

// ─── Chunking ─────────────────────────────────────────────────
const MAX_CHUNK = 2000
const OVERLAP = 200

const PROJECT_RE = { MAD: /\b(madrid|mad|playa\s*surf|spain)\b/i, BHX: /\b(birmingham|bhx|uk|england|coventry)\b/i }
const DOCTYPE_RE = { capex: /\b(capex|capital\s*expenditure|eac|committed)\b/i, cash_flow: /\b(cash\s*flow|inflow|outflow|13.*week|liquidity)\b/i, funding: /\b(funding|loan|facility|drawn|cesce|debt|equity)\b/i, bp_model: /\b(business\s*plan|bp\s*model|irr|npv|revenue\s*model)\b/i }
const CCY_RE = { EUR: /[€]|EUR/i, GBP: /[£]|GBP/i }

function detectMeta(text) {
  const m = {}
  for (const [k, re] of Object.entries(PROJECT_RE)) if (re.test(text)) { m.project_id = k; break }
  for (const [k, re] of Object.entries(DOCTYPE_RE)) if (re.test(text)) { m.doc_type = k; break }
  for (const [k, re] of Object.entries(CCY_RE)) if (re.test(text)) { m.currency = k; break }
  const period = text.match(/\b(Q[1-4])\s*(20\d{2})\b/) || text.match(/\b(FY)\s*(20\d{2})\b/) || text.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*(20\d{2})\b/i)
  if (period) m.period = period[0]
  return m
}

function chunkContent(text, baseMeta) {
  const lines = text.split('\n')
  const tabular = lines.filter(l => /\t/.test(l) || (l.split(',').length > 3 && /\d/.test(l)))

  if (tabular.length >= 3) return chunkTabular(lines, baseMeta)
  return chunkNarrative(text, baseMeta)
}

function chunkTabular(lines, base) {
  const chunks = []
  let section = '', rows = [], header = ''

  for (const line of lines) {
    const t = line.trim()
    if (!t) continue
    if (!header && (t.split('\t').length > 2 || t.split('|').length > 3) && !/\d{3,}/.test(t.replace(/,/g, ''))) {
      header = t; continue
    }
    const isHeader = /^[A-Z][A-Z\s&]+$/.test(t) || /^#+\s/.test(t) || (/^[A-Z]/.test(t) && !t.includes('\t') && !t.includes('|') && t.length < 60)
    if (isHeader && rows.length > 0) {
      chunks.push(makeChunk(header, section, rows, base))
      rows = []
    }
    if (isHeader) section = t.replace(/^#+\s*/, '')
    else rows.push(t)
  }
  if (rows.length) chunks.push(makeChunk(header, section, rows, base))

  return chunks.flatMap(c => c.content.length > MAX_CHUNK * 1.5 ? splitChunk(c) : [c])
}

function makeChunk(header, section, rows, base) {
  const content = [section ? `## ${section}` : '', header, ...rows].filter(Boolean).join('\n')
  return { content, metadata: { ...base, ...detectMeta(content), section, chunk_type: 'table_section' }, tokenEstimate: Math.ceil(content.length / 4) }
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
      chunks.push({ content: cur.trim(), metadata: { ...base, ...detectMeta(cur), chunk_type: 'narrative' }, tokenEstimate: Math.ceil(cur.length / 4) })
      const words = cur.split(/\s+/)
      cur = words.slice(-Math.ceil(OVERLAP / 5)).join(' ') + '\n\n'
    }
    cur += t + '\n\n'
  }
  if (cur.trim()) chunks.push({ content: cur.trim(), metadata: { ...base, ...detectMeta(cur), chunk_type: 'narrative' }, tokenEstimate: Math.ceil(cur.length / 4) })
  return chunks
}

// ─── Worker Loop ──────────────────────────────────────────────
const args = Object.fromEntries(
  process.argv.slice(2).map(a => { const [k, v] = a.replace('--', '').split('='); return [k, v || 'true'] })
)
const BATCH_SIZE = parseInt(args.batch || '5')
const MAX_FILES = parseInt(args.max || '0')

function log(msg) {
  const ts = new Date().toISOString().slice(11, 19)
  const line = `${ts} ${msg}`
  console.log(line)
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function processFile(item) {
  const t0 = Date.now()

  // Mark processing
  await supabase.from('ingest_queue').update({ status: 'processing' }).eq('id', item.id)

  // 1. Read file
  const fullPath = `${DMS_ROOT}/${item.rel_path}`
  const buffer = await readFile(fullPath)
  log(`  📂 Read ${(buffer.length / 1024).toFixed(0)} KB`)

  // 2. Parse
  const parsed = await parseDocument(buffer, item.file_name)
  if (!parsed.content || parsed.content.trim().length < 50) throw new Error(`Empty parse: ${parsed.content.length} chars`)

  // 3. Chunk
  const baseMeta = { project_id: item.project_id || undefined, doc_type: item.category || undefined, source_file: item.file_name }
  const chunks = chunkContent(parsed.content, baseMeta)
  log(`  🔪 ${chunks.length} chunks`)
  if (!chunks.length) throw new Error('No chunks')

  // 4. Create rag_document bridge
  const { data: ragDoc, error: docErr } = await supabase
    .from('rag_documents')
    .insert({ title: item.file_name, source_type: item.file_ext, chunk_count: chunks.length, status: 'processing' })
    .select('id')
    .single()
  if (docErr) throw new Error(`rag_documents: ${docErr.message}`)

  // 5. Embed + insert chunks (batches of 5)
  let inserted = 0
  for (let i = 0; i < chunks.length; i += 5) {
    const batch = chunks.slice(i, i + 5)
    try {
      const embeddings = await Promise.all(batch.map(c => embedText(c.content)))
      const valid = embeddings.every(e => Array.isArray(e) && e.length === EMBED_DIMS)
      if (!valid) { log(`  ⚠️ Bad embedding dims at batch ${Math.floor(i/5)+1}`); continue }

      const rows = batch.map((c, j) => ({
        document_id: ragDoc.id, chunk_index: i + j, content: c.content,
        embedding: JSON.stringify(embeddings[j]), metadata: c.metadata, token_count: c.tokenEstimate,
      }))
      const { error } = await supabase.from('rag_chunks').insert(rows)
      if (error) { log(`  ⚠️ Chunk insert err: ${error.message}`); continue }
      inserted += batch.length
    } catch (err) {
      log(`  ⚠️ Embed batch error: ${err.message}`)
      if (err.message?.includes('429')) { log(`  🕐 Rate limit, waiting 10s...`); await sleep(10000) }
    }
  }

  // 6. Finalize
  await supabase.from('rag_documents').update({ status: 'indexed', chunk_count: inserted }).eq('id', ragDoc.id)
  await supabase.from('ingest_queue').update({ status: 'done', chunk_count: inserted, processed_at: new Date().toISOString() }).eq('id', item.id)

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
  log(`  ✅ ${inserted} chunks in ${elapsed}s (${parsed.parser})`)
  return { status: 'done', chunks: inserted, parser: parsed.parser }
}

async function main() {
  log(`\n${'═'.repeat(60)}`)
  log(`INGESTION WORKER — batch=${BATCH_SIZE}, max=${MAX_FILES || 'unlimited'}`)
  log(`DMS: ${DMS_ROOT}`)
  log(`LlamaParse: ${LLAMA_KEY ? 'YES' : 'NO (local only)'}`)
  log(`${'═'.repeat(60)}\n`)

  let totalDone = 0, totalErrors = 0, round = 0

  while (true) {
    if (MAX_FILES && totalDone + totalErrors >= MAX_FILES) {
      log(`\n🏁 Reached max files (${MAX_FILES}). Stopping.`)
      break
    }

    const limit = MAX_FILES ? Math.min(BATCH_SIZE, MAX_FILES - totalDone - totalErrors) : BATCH_SIZE

    const { data: queue, error } = await supabase
      .from('ingest_queue')
      .select('*')
      .eq('status', 'queued')
      .order('relevance', { ascending: false })
      .limit(limit)

    if (error) { log(`❌ DB error: ${error.message}`); await sleep(5000); continue }
    if (!queue?.length) { log(`\n🏁 Queue empty. DONE: ${totalDone} files, ${totalErrors} errors`); break }

    round++
    log(`\n── Round ${round} (${queue.length} files) ──────────────`)

    for (const item of queue) {
      log(`\n📄 ${item.file_name} [${item.category}] (${(item.file_size/1024).toFixed(0)}KB, rel=${item.relevance})`)
      try {
        const result = await processFile(item)
        totalDone++
      } catch (err) {
        totalErrors++
        log(`  ❌ FAILED: ${err.message}`)
        await supabase.from('ingest_queue').update({
          status: 'error', error_message: err.message?.slice(0, 500), processed_at: new Date().toISOString()
        }).eq('id', item.id)
      }
    }

    log(`\n📊 Progress: ${totalDone} done, ${totalErrors} errors, ${418 - totalDone - totalErrors} remaining`)
    await sleep(1000)
  }
}

main().catch(err => { console.error('FATAL:', err); process.exit(1) })
