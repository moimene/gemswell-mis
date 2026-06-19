import { config } from 'dotenv'
config({ path: '.env.local' })

import { createHash } from 'node:crypto'
import { execFileSync, spawn } from 'node:child_process'
import { createReadStream, createWriteStream, existsSync } from 'node:fs'
import { mkdir, open, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { ingestBuffer } from '../src/lib/ingest/queue-processor'
import type { ProjectId, SourceChannel } from '../src/lib/knowledge/contracts'

type ReportItem = {
  relPath: string
  fileName: string
  fileExt: string
  fileSize: number
  sourceHash: string
  projectId: ProjectId | null
  docTypeHint: string | null
  action: string
}

type ZipEntryMeta = {
  archivePath: string
  path: string
  size: number
  packedSize: number
  method: string
  offset: number
}

type Cli = {
  report: string
  sources: string[]
  apply: boolean
  output: string | null
  limit: number | null
}

const SOURCE_CHANNEL: SourceChannel = 'drive_sync'
const SUPPORTED_LARGE_EXT = new Set(['.pdf', '.pptx'])

function usage(): never {
  console.error(`Usage:
  npx tsx scripts/ingest-sharepoint-large-local.ts --report <reconcile.json> --source <zip> [--source <zip>] [--apply]

Options:
  --report <path>   JSON report from reconcile-sharepoint-local.ts
  --source <path>   SharePoint/OneDrive ZIP. Repeatable.
  --output <path>   Write JSON result report.
  --limit N         Limit oversized files processed.
  --apply           Write to Supabase. Default is dry-run extraction only.
`)
  process.exit(1)
}

function parseArgs(): Cli {
  const argv = process.argv.slice(2)
  const sources: string[] = []
  let report = ''
  let output: string | null = null
  let limit: number | null = null
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--report') report = argv[++i] ?? ''
    else if (arg === '--source') {
      const source = argv[++i] ?? ''
      if (!source) usage()
      sources.push(source)
    } else if (arg === '--output') output = argv[++i] ?? ''
    else if (arg === '--limit') {
      const n = Number(argv[++i])
      if (!Number.isInteger(n) || n <= 0) usage()
      limit = n
    } else if (arg === '--apply') {
      continue
    } else {
      usage()
    }
  }
  if (!report || sources.length === 0) usage()
  return { report, sources, output, limit, apply: argv.includes('--apply') }
}

function sha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex')
}

function run7zList(archivePath: string): string {
  try {
    return execFileSync('7z', ['l', '-slt', archivePath], { encoding: 'utf8', maxBuffer: 200 * 1024 * 1024 })
  } catch (err) {
    const output = (err as { stdout?: Buffer | string }).stdout
    if (!output) throw err
    return Buffer.isBuffer(output) ? output.toString('utf8') : output
  }
}

function parse7zEntries(archivePath: string, output: string): ZipEntryMeta[] {
  const entries: ZipEntryMeta[] = []
  let current: Record<string, string> = {}
  const flush = () => {
    if (current.Path && current.Folder === '-' && current.Offset != null) {
      entries.push({
        archivePath,
        path: current.Path,
        size: Number(current.Size ?? 0),
        packedSize: Number(current['Packed Size'] ?? current.Size ?? 0),
        method: current.Method ?? '',
        offset: Number(current.Offset ?? 0),
      })
    }
    current = {}
  }
  for (const line of output.split(/\r?\n/)) {
    if (!line.trim()) {
      flush()
      continue
    }
    const match = line.match(/^([^=]+) = (.*)$/)
    if (match) current[match[1].trim()] = match[2]
  }
  flush()
  return entries
}

function normKey(value: string): string {
  return value.normalize('NFC')
}

async function materializeStoredZipEntry(entry: ZipEntryMeta, destPath: string): Promise<void> {
  if (entry.method !== 'Store') throw new Error(`Unsupported ZIP method for ${entry.path}: ${entry.method}`)
  const fh = await open(entry.archivePath, 'r')
  try {
    const header = Buffer.alloc(30)
    await fh.read(header, 0, header.length, entry.offset)
    if (header.readUInt32LE(0) !== 0x04034b50) {
      throw new Error(`Invalid local ZIP header at ${entry.offset} for ${entry.path}`)
    }
    const nameLen = header.readUInt16LE(26)
    const extraLen = header.readUInt16LE(28)
    const dataStart = entry.offset + 30 + nameLen + extraLen
    await mkdir(path.dirname(destPath), { recursive: true })
    await pipeline(
      createReadStream(entry.archivePath, { start: dataStart, end: dataStart + entry.packedSize - 1 }),
      createWriteStream(destPath)
    )
  } finally {
    await fh.close()
  }
}

async function materializeCompressedZipEntry(entry: ZipEntryMeta, destPath: string): Promise<void> {
  await mkdir(path.dirname(destPath), { recursive: true })
  const child = spawn('7z', ['x', '-so', entry.archivePath, entry.path], { stdio: ['ignore', 'pipe', 'pipe'] })
  let stderr = ''
  child.stderr.setEncoding('utf8')
  child.stderr.on('data', chunk => {
    stderr = `${stderr}${chunk}`.slice(-4000)
  })
  const closePromise = new Promise<void>((resolve, reject) => {
    child.on('error', reject)
    child.on('close', code => {
      if (code === 0) resolve()
      else reject(new Error(`7z extract failed for ${entry.path} with code ${code}: ${stderr.trim()}`))
    })
  })
  await Promise.all([
    pipeline(child.stdout, createWriteStream(destPath)),
    closePromise,
  ])
}

async function materializeZipEntry(entry: ZipEntryMeta, destPath: string): Promise<void> {
  if (existsSync(destPath)) return
  if (entry.method === 'Store') return materializeStoredZipEntry(entry, destPath)
  return materializeCompressedZipEntry(entry, destPath)
}

function extractPdfText(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('pdftotext', ['-layout', '-enc', 'UTF-8', filePath, '-'], { stdio: ['ignore', 'pipe', 'pipe'] })
    const chunks: Buffer[] = []
    let stderr = ''
    child.stdout.on('data', chunk => chunks.push(Buffer.from(chunk)))
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', chunk => {
      stderr = `${stderr}${chunk}`.slice(-4000)
    })
    child.on('error', reject)
    child.on('close', code => {
      if (code !== 0) {
        reject(new Error(`pdftotext failed with code ${code}: ${stderr.trim()}`))
        return
      }
      resolve(Buffer.concat(chunks).toString('utf8'))
    })
  })
}

function decodeXmlText(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

function slideNumber(name: string): number {
  const match = name.match(/slide(\d+)\.xml$/)
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER
}

function extractPptxText(filePath: string): string {
  const entries = parse7zEntries(filePath, run7zList(filePath))
    .filter(entry => /^ppt\/(slides|notesSlides)\/.+\.xml$/i.test(entry.path))
    .sort((a, b) => slideNumber(a.path) - slideNumber(b.path) || a.path.localeCompare(b.path))
  const sections: string[] = []
  for (const entry of entries) {
    const xml = execFileSync('7z', ['x', '-so', filePath, entry.path], { encoding: 'utf8', maxBuffer: 80 * 1024 * 1024 })
    const texts = Array.from(xml.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g))
      .map(match => decodeXmlText(match[1] ?? '').replace(/\s+/g, ' ').trim())
      .filter(Boolean)
    if (texts.length === 0) continue
    const label = entry.path.includes('/notesSlides/') ? 'Notes' : `Slide ${slideNumber(entry.path)}`
    sections.push(`## ${label}\n\n${texts.join('\n')}`)
  }
  return sections.join('\n\n')
}

function normalizeExtractedText(text: string): string {
  return text
    .replace(/\f/g, '\n\n---\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim()
}

async function recordFailedLargeDocument(
  sb: SupabaseClient,
  item: ReportItem,
  sourceHash: string,
  message: string
): Promise<string | null> {
  const baseRow = {
    title: item.fileName,
    source_type: item.fileExt.replace(/^\./, '') || 'unknown',
    chunk_count: 0,
    status: 'error',
    source_hash: sourceHash,
    source_channel: SOURCE_CHANNEL,
    project_id: item.projectId,
    doc_type: item.docTypeHint,
    review_status: 'needs_review',
    classification_source: 'rule',
    lifecycle: 'unknown',
    authority_tier: 'unverified',
    authority_score: 0,
    current_version: 1,
    review_reason: message.slice(0, 500),
  }
  const { data, error } = await sb
    .from('rag_documents')
    .insert(baseRow)
    .select('id')
    .single()
  if (!error && typeof data?.id === 'string') return data.id

  if ((error as { code?: string } | null)?.code !== '23505') {
    throw new Error(`failed large document record failed: ${error?.message ?? 'unknown error'}`)
  }

  let lookup = sb
    .from('rag_documents')
    .select('id')
    .eq('source_hash', sourceHash)
  lookup = item.projectId ? lookup.eq('project_id', item.projectId) : lookup.is('project_id', null)
  const { data: existing, error: lookupError } = await lookup.limit(1).maybeSingle()
  if (lookupError) throw new Error(`failed large document lookup failed: ${lookupError.message}`)
  return typeof existing?.id === 'string' ? existing.id : null
}

async function main() {
  const cli = parseArgs()
  const raw = JSON.parse(await readFile(cli.report, 'utf8')) as { items?: ReportItem[] }
  const targets = (raw.items ?? [])
    .filter(item => item.action === 'too_large')
    .filter(item => SUPPORTED_LARGE_EXT.has(item.fileExt))
    .filter(item => item.projectId)
    .slice(0, cli.limit ?? undefined)

  const entryByPath = new Map<string, ZipEntryMeta>()
  for (const source of cli.sources) {
    const abs = path.resolve(source)
    for (const entry of parse7zEntries(abs, run7zList(abs))) {
      entryByPath.set(normKey(entry.path), entry)
    }
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const sb = cli.apply && url && key
    ? createClient(url, key, { auth: { persistSession: false } })
    : null
  if (cli.apply && !sb) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')

  const workDir = path.join(os.tmpdir(), 'gemswell-sharepoint-large-local')
  await mkdir(workDir, { recursive: true })

  const results = []
  for (const item of targets) {
    const entry = entryByPath.get(normKey(item.relPath))
    if (!entry) {
      results.push({ fileName: item.fileName, relPath: item.relPath, status: 'missing_zip_entry' })
      continue
    }
    const localPath = path.join(workDir, `${item.sourceHash}${item.fileExt}`)
    let actualSourceHash = item.sourceHash
    try {
      await materializeZipEntry(entry, localPath)
      const bytes = await readFile(localPath)
      actualSourceHash = sha256(bytes)

      const extracted = item.fileExt === '.pdf'
        ? await extractPdfText(localPath)
        : extractPptxText(localPath)
      const content = normalizeExtractedText(`# ${item.fileName}\n\n${extracted}`)
      if (content.trim().length < 50) throw new Error(`local extraction returned near-empty result (${content.trim().length} chars)`)

      let ingestResult = null
      if (cli.apply) {
        ingestResult = await ingestBuffer(sb!, {
          fileName: item.fileName,
          fileExt: item.fileExt,
          buffer: Buffer.from(content, 'utf8'),
          projectId: item.projectId,
          docTypeHint: item.docTypeHint,
          sourceChannel: SOURCE_CHANNEL,
          sourceHashOverride: actualSourceHash,
          parsedContentOverride: content,
          parserOverride: item.fileExt === '.pdf' ? 'local-pdftotext' : 'local-pptx-xml',
        }, { embeddingBatchSize: 20, log: message => console.log(message) })
      }

      results.push({
        fileName: item.fileName,
        relPath: item.relPath,
        projectId: item.projectId,
        fileSize: item.fileSize,
        sourceHash: actualSourceHash,
        reportSourceHash: item.sourceHash,
        extractedChars: content.length,
        status: cli.apply ? ingestResult?.status : 'dry_run',
        chunks: ingestResult?.chunks,
        documentId: ingestResult?.documentId,
        parser: ingestResult?.parser ?? (item.fileExt === '.pdf' ? 'local-pdftotext' : 'local-pptx-xml'),
        reused: ingestResult?.reused ?? false,
        error: ingestResult?.error,
      })
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      let documentId: string | null = null
      if (cli.apply && sb && item.projectId) {
        documentId = await recordFailedLargeDocument(sb, item, actualSourceHash, error)
      }
      results.push({
        fileName: item.fileName,
        relPath: item.relPath,
        projectId: item.projectId,
        fileSize: item.fileSize,
        sourceHash: actualSourceHash,
        status: 'error',
        documentId,
        error,
      })
    }
  }

  const summary = results.reduce<Record<string, number>>((acc, row) => {
    const status = String(row.status)
    acc[status] = (acc[status] ?? 0) + 1
    return acc
  }, {})
  const output = { at: new Date().toISOString(), apply: cli.apply, total: results.length, summary, results }
  const json = JSON.stringify(output, null, 2)
  console.log(json)
  if (cli.output) {
    await mkdir(path.dirname(path.resolve(cli.output)), { recursive: true })
    await writeFile(cli.output, `${json}\n`)
  }
  if (!cli.apply) await rm(workDir, { recursive: true, force: true })
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
