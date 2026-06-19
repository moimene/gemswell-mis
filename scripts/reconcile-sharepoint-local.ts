import { config } from 'dotenv'
config({ path: '.env.local' })

import { createHash } from 'node:crypto'
import { execFileSync, spawn } from 'node:child_process'
import { createReadStream, createWriteStream, existsSync } from 'node:fs'
import { mkdir, open, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createIngestJob, MAX_INGEST_JOB_BYTES } from '../src/lib/ingest/jobs'
import type { ProjectId, SourceChannel } from '../src/lib/knowledge/contracts'

type ExistingDoc = {
  id: string
  title: string | null
  project_id: string | null
  source_hash: string | null
  status: string | null
  lifecycle: string | null
  chunk_count: number | null
  review_reason: string | null
}

type ExistingJob = {
  id: string
  storage_path: string
  status: string
  document_id: string | null
}

type InventoryItem = {
  absPath: string | null
  relPath: string
  fileName: string
  fileExt: string
  fileSize: number
  sourceHash: string
  storagePath: string
  legacyStoragePath?: string
  projectId: ProjectId | null
  projectRule: string
  docTypeHint: string | null
  sourceUnavailable?: string
  action: Action
  reason: string
  existingIds: string[]
  jobId?: string
}

type Action =
  | 'missing'
  | 'changed'
  | 'reingest_same_hash'
  | 'already_indexed_hash'
  | 'duplicate_content_superseded'
  | 'failed_unextractable'
  | 'legacy_title_match'
  | 'job_exists'
  | 'unsupported'
  | 'too_large'
  | 'unmapped'
  | 'unavailable'
  | 'duplicate_in_batch'

type Cli = {
  sources: string[]
  apply: boolean
  limit: number | null
  report: string | null
  forceProject: ProjectId | null
  includeLegacyTitleMatches: boolean
}

type SourceFile = {
  absPath: string | null
  relPath: string
  size?: number
  unavailableReason?: string
}

type ZipEntryMeta = {
  path: string
  size: number
  packedSize: number
  method: string
  offset: number
}

const PROJECTS = new Set<ProjectId>(['MAD', 'BHX', 'KLP', 'PHILAE', 'GVF', 'ETP'])
const SUPPORTED_EXT = new Set(['.pdf', '.doc', '.docx', '.xlsx', '.xls', '.csv', '.txt', '.pptx'])
const SOURCE_CHANNEL: SourceChannel = 'drive_sync'
const DEFAULT_BUCKET = process.env.KNOWLEDGE_ARTIFACT_BUCKET ?? 'documents'
const EXTRACTION_CACHE_VERSION = 'v3'

function usage(): never {
  console.error(`Usage:
  npx tsx scripts/reconcile-sharepoint-local.ts --source <zip-or-dir> [--apply] [--limit N]

Options:
  --source <path>                    ZIP exported from SharePoint/OneDrive or extracted folder. Repeatable.
  --apply                            Upload missing/changed files to Storage and enqueue ingest jobs.
  --limit N                          Limit files processed/enqueued after reconciliation ordering.
  --report <path>                    Report JSON path. CSV is written next to it.
  --force-project <MAD|BHX|KLP|PHILAE|GVF|ETP>
  --include-legacy-title-matches     Enqueue files that only matched legacy title rows with NULL source_hash.
`)
  process.exit(1)
}

function parseArgs(): Cli {
  const argv = process.argv.slice(2)
  const sources: string[] = []
  let limit: number | null = null
  let report: string | null = null
  let forceProject: ProjectId | null = null
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--source') {
      const source = argv[++i] ?? ''
      if (!source) usage()
      sources.push(source)
    }
    else if (arg === '--limit') {
      const n = Number(argv[++i])
      if (!Number.isInteger(n) || n <= 0) usage()
      limit = n
    } else if (arg === '--report') report = argv[++i] ?? ''
    else if (arg === '--force-project') {
      const p = argv[++i] as ProjectId | undefined
      if (!p || !PROJECTS.has(p)) usage()
      forceProject = p
    } else if (arg === '--apply' || arg === '--include-legacy-title-matches') {
      continue
    } else {
      usage()
    }
  }
  if (sources.length === 0) usage()
  return {
    sources,
    apply: argv.includes('--apply'),
    limit,
    report,
    forceProject,
    includeLegacyTitleMatches: argv.includes('--include-legacy-title-matches'),
  }
}

function sha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex')
}

function stableUuidFromHash(hash: string): string {
  const variantNibble = (parseInt(hash[16] ?? '8', 16) & 0x3) | 0x8
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    `4${hash.slice(13, 16)}`,
    `${variantNibble.toString(16)}${hash.slice(17, 20)}`,
    hash.slice(20, 32),
  ].join('-')
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\\/g, '/')
}

function titleKey(title: string | null | undefined): string {
  return normalizeText((title ?? '').trim())
}

function extOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  return dot >= 0 ? fileName.slice(dot).toLowerCase() : ''
}

function safeSegment(value: string, fallback: string): string {
  const safe = value
    .replace(/[<>:"\\|?*\x00-\x1F]/g, '_')
    .replace(/\//g, '_')
    .trim()
  return safe || fallback
}

function safeStorageSegment(value: string, fallback: string): string {
  const safe = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9.() _-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
  return safe || fallback
}

function getMimeType(ext: string): string {
  const map: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.xls': 'application/vnd.ms-excel',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.csv': 'text/csv',
    '.txt': 'text/plain; charset=utf-8',
  }
  return map[ext] ?? 'application/octet-stream'
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

function parse7zEntries(output: string): ZipEntryMeta[] {
  const entries: ZipEntryMeta[] = []
  let current: Record<string, string> = {}
  const flush = () => {
    if (current.Path && current.Folder === '-' && current.Offset != null) {
      entries.push({
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

async function materializeStoredZipEntry(archivePath: string, entry: ZipEntryMeta, destPath: string): Promise<void> {
  if (entry.method !== 'Store') throw new Error(`Unsupported ZIP method for ${entry.path}: ${entry.method}`)
  const fh = await open(archivePath, 'r')
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
      createReadStream(archivePath, { start: dataStart, end: dataStart + entry.packedSize - 1 }),
      createWriteStream(destPath)
    )
  } finally {
    await fh.close()
  }
}

async function materializeCompressedZipEntry(archivePath: string, entry: ZipEntryMeta, destPath: string): Promise<void> {
  await mkdir(path.dirname(destPath), { recursive: true })
  const child = spawn('7z', ['x', '-so', archivePath, entry.path], { stdio: ['ignore', 'pipe', 'pipe'] })
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

async function materializeZipEntry(archivePath: string, entry: ZipEntryMeta, destPath: string): Promise<void> {
  if (entry.method === 'Store') return materializeStoredZipEntry(archivePath, entry, destPath)
  return materializeCompressedZipEntry(archivePath, entry, destPath)
}

async function loadSourceFiles(source: string): Promise<{ root: string; files: SourceFile[] }> {
  const abs = path.resolve(source)
  const s = await stat(abs)
  if (s.isDirectory()) {
    const files = await walkFiles(abs)
    return {
      root: abs,
      files: files.map(absPath => ({
        absPath,
        relPath: path.relative(abs, absPath).split(path.sep).join('/'),
      })),
    }
  }
  if (!s.isFile() || !abs.toLowerCase().endsWith('.zip')) throw new Error(`Unsupported source: ${source}`)

  const key = sha256(Buffer.from(`${EXTRACTION_CACHE_VERSION}:${abs}:${s.size}:${s.mtimeMs}`)).slice(0, 16)
  const dir = path.join(os.tmpdir(), 'gemswell-sharepoint-local', key)
  const marker = path.join(dir, '.extracted-v3')
  const manifestPath = path.join(dir, 'manifest.json')
  if (!existsSync(marker)) {
    await rm(dir, { recursive: true, force: true })
    await mkdir(dir, { recursive: true })
    const entries = parse7zEntries(run7zList(abs))
    const manifest: SourceFile[] = []
    let index = 0
    for (const entry of entries) {
      const zipPath = entry.path
      const parts = zipPath.split('/').filter(Boolean)
      const originalName = parts.at(-1) ?? `file-${index}`
      if (originalName === '.DS_Store' || originalName.startsWith('._') || parts.includes('__MACOSX')) continue
      const localName = `${String(index).padStart(5, '0')}_${safeSegment(originalName, `file-${index}`)}`
      const absPath = path.join(dir, 'files', localName)
      const ext = extOf(originalName)
      const shouldMaterialize = SUPPORTED_EXT.has(ext)
      let unavailableReason: string | undefined
      if (shouldMaterialize) {
        try {
          await materializeZipEntry(abs, entry, absPath)
        } catch (err) {
          unavailableReason = err instanceof Error ? err.message : String(err)
        }
      }
      manifest.push({
        absPath: shouldMaterialize && !unavailableReason ? absPath : null,
        relPath: zipPath,
        size: entry.size,
        unavailableReason,
      })
      index++
    }
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2))
    await writeFile(marker, new Date().toISOString())
  }
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as SourceFile[]
  return { root: dir, files: manifest }
}

async function walkFiles(root: string): Promise<string[]> {
  const out: string[] = []
  async function visit(dir: string) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (entry.name === '__MACOSX' || entry.name === '.DS_Store' || entry.name.startsWith('._')) continue
      const abs = path.join(dir, entry.name)
      if (entry.isDirectory()) await visit(abs)
      else if (entry.isFile()) out.push(abs)
    }
  }
  await visit(root)
  return out.sort((a, b) => a.localeCompare(b))
}

function deriveProjectId(relPath: string, forceProject: ProjectId | null): { projectId: ProjectId | null; rule: string } {
  if (forceProject) return { projectId: forceProject, rule: `forced:${forceProject}` }
  const n = normalizeText(`/${relPath}/`)

  if (/\bbhx\b|birmingham/.test(n)) return { projectId: 'BHX', rule: 'path:bhx-or-birmingham' }
  if (/philae/.test(n)) return { projectId: 'PHILAE', rule: 'path:philae' }
  if (/kelpa|line\s*sports?|linesport|linesp/.test(n)) return { projectId: 'KLP', rule: 'path:kelpa-or-line-sports' }
  if (/madrid|playa surf|waves madrid|opco waves madrid|\bmps\b/.test(n)) return { projectId: 'MAD', rule: 'path:madrid-mps' }
  if (/\/03\. ventures\/3\. investors\/(1\. deck founders|2\. investment memorandum|7\. moodboards|8\. project teaser|9\. membresias)\//.test(n)) {
    return { projectId: 'PHILAE', rule: 'path:ventures-investor-fundraising' }
  }
  if (/\/03\. ventures\/3\. investors\/4\. grandvalira\//.test(n)) return { projectId: 'GVF', rule: 'path:grandvalira' }
  if (/\/03\. ventures\/1\. bp\//.test(n)) return { projectId: 'GVF', rule: 'path:ventures-bp-opco' }
  if (/\/03\. ventures\/12\. sl\//.test(n)) {
    if (/kenichi|lona barcelona/.test(n)) return { projectId: 'KLP', rule: 'path:sl-kenichi-lona' }
    return { projectId: 'GVF', rule: 'path:ventures-sl' }
  }
  if (/\/03\. ventures\/(10\. legal|14\. m&a|15\. controlling)\//.test(n)) {
    return { projectId: 'GVF', rule: 'path:ventures-corporate' }
  }
  if (/\/project\/|\/due diligence final\/|\/financing|debt|prestam|tasaci|\/monitoring\/|\/sales\//.test(n)) {
    return { projectId: 'MAD', rule: 'path:asset-project-financing' }
  }
  if (/\/sl\/corporate\//.test(n)) return { projectId: 'KLP', rule: 'path:sl-corporate' }
  if (/\/sl\/accounts|\/sl\/contracts/.test(n)) return { projectId: 'GVF', rule: 'path:sl-accounts-contracts' }
  if (/0\. gemswell ventures sl/.test(n)) return { projectId: 'GVF', rule: 'path:gemswell-ventures-root' }
  if (/_*1\. gemswell ventures\//.test(n)) return { projectId: 'GVF', rule: 'path:gemswell-ventures-fallback' }
  return { projectId: null, rule: 'unmapped' }
}

function deriveDocTypeHint(relPath: string): string | null {
  const n = normalizeText(relPath)
  if (/ccaa|annual accounts|ee cc|estados financieros|balance|cierres?|tancaments/.test(n)) return 'annual_accounts'
  if (/impostos|iva|irpf|modelo 036|mod036|tax|nif|tgss|hisenda/.test(n)) return 'tax'
  if (/corporate|contrat|contracts?|constituci|compraventa|poder|atr|cambio socio|acuerdos sociales|banco/.test(n)) return 'legal'
  if (/financing|debt|prestam|cesce|funding|sabadell/.test(n)) return 'funding'
  if (/due diligence|dd\b|auditor/.test(n)) return 'dd'
  if (/project|licencias?|obra|arquitectura|urbanistic|monitoring/.test(n)) return 'monitoring'
  if (/sales|mkt|marketing/.test(n)) return 'asset_management'
  return null
}

async function fetchAllDocuments(sb: SupabaseClient): Promise<ExistingDoc[]> {
  const rows: ExistingDoc[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb
      .from('rag_documents')
      .select('id,title,project_id,source_hash,status,lifecycle,chunk_count,review_reason')
      .range(from, from + 999)
    if (error) throw new Error(`rag_documents fetch failed: ${error.message}`)
    rows.push(...((data ?? []) as ExistingDoc[]))
    if (!data || data.length < 1000) break
  }
  return rows
}

async function fetchJobsByStoragePath(sb: SupabaseClient, storagePaths: string[]): Promise<Map<string, ExistingJob>> {
  const jobs = new Map<string, ExistingJob>()
  for (let i = 0; i < storagePaths.length; i += 100) {
    const chunk = storagePaths.slice(i, i + 100)
    const { data, error } = await sb
      .from('knowledge_ingest_jobs')
      .select('id,storage_path,status,document_id')
      .in('storage_path', chunk)
    if (error) {
      if (error.message?.toLowerCase().includes('knowledge_ingest_jobs')) return jobs
      throw new Error(`knowledge_ingest_jobs fetch failed: ${error.message}`)
    }
    for (const row of (data ?? []) as ExistingJob[]) jobs.set(row.storage_path, row)
  }
  return jobs
}

function buildIndexes(existing: ExistingDoc[]) {
  const byHash = new Map<string, ExistingDoc[]>()
  const byTitle = new Map<string, ExistingDoc[]>()
  for (const doc of existing) {
    const project = doc.project_id ?? ''
    if (doc.source_hash) {
      const k = `${project}:${doc.source_hash}`
      byHash.set(k, [...(byHash.get(k) ?? []), doc])
    }
    if (doc.lifecycle !== 'superseded') {
      const k = `${project}:${titleKey(doc.title)}`
      byTitle.set(k, [...(byTitle.get(k) ?? []), doc])
    }
  }
  return { byHash, byTitle }
}

function decideAction(item: InventoryItem, existing: ExistingDoc[], jobs: Map<string, ExistingJob>): InventoryItem {
  if (/_error\.txt$/i.test(item.fileName)) {
    return { ...item, action: 'unsupported', reason: 'parser/export error sidecar, not a source document' }
  }
  if (!SUPPORTED_EXT.has(item.fileExt)) return { ...item, action: 'unsupported', reason: `unsupported extension ${item.fileExt || '(none)'}` }
  if (item.sourceUnavailable) return { ...item, action: 'unavailable', reason: item.sourceUnavailable }
  if (!item.projectId) return { ...item, action: 'unmapped', reason: 'no folder-to-project rule matched' }

  const { byHash, byTitle } = buildIndexes(existing)
  const project = item.projectId
  const hashMatches = byHash.get(`${project}:${item.sourceHash}`) ?? []
  const consultableHash = hashMatches.find(doc => doc.status === 'indexed' && doc.lifecycle !== 'superseded' && (doc.chunk_count ?? 0) > 0)
  if (consultableHash) {
    return {
      ...item,
      action: 'already_indexed_hash',
      reason: 'same source_hash/project already indexed',
      existingIds: hashMatches.map(doc => doc.id),
    }
  }
  if (hashMatches.length > 0) {
    const supersededHash = hashMatches.find(doc => doc.status === 'indexed' && doc.lifecycle === 'superseded' && (doc.chunk_count ?? 0) > 0)
    if (supersededHash) {
      return {
        ...item,
        action: 'duplicate_content_superseded',
        reason: 'same source_hash/project indexed, then superseded by duplicate content hash',
        existingIds: hashMatches.map(doc => doc.id),
      }
    }
    const failedHash = hashMatches.find(doc => doc.status === 'error')
    if (failedHash) {
      const reason = failedHash.review_reason
        ? `same source_hash/project failed extraction: ${failedHash.review_reason.slice(0, 240)}`
        : 'same source_hash/project failed extraction'
      return {
        ...item,
        action: 'failed_unextractable',
        reason,
        existingIds: hashMatches.map(doc => doc.id),
      }
    }
    return {
      ...item,
      action: 'reingest_same_hash',
      reason: 'same source_hash/project exists but is not currently consultable',
      existingIds: hashMatches.map(doc => doc.id),
    }
  }
  if (item.fileSize > MAX_INGEST_JOB_BYTES) return { ...item, action: 'too_large', reason: `over ${MAX_INGEST_JOB_BYTES} byte ingest job limit` }

  const job = jobs.get(item.storagePath) ?? (item.legacyStoragePath ? jobs.get(item.legacyStoragePath) : undefined)
  if (job && ['queued', 'processing', 'done'].includes(job.status)) {
    return { ...item, action: 'job_exists', reason: `existing ingest job is ${job.status}`, jobId: job.id }
  }

  const titleMatches = byTitle.get(`${project}:${titleKey(item.fileName)}`) ?? []
  if (titleMatches.length > 0) {
    const hashed = titleMatches.filter(doc => Boolean(doc.source_hash))
    if (hashed.length > 0) {
      return {
        ...item,
        action: 'changed',
        reason: 'same title/project exists with different source_hash',
        existingIds: titleMatches.map(doc => doc.id),
      }
    }
    return {
      ...item,
      action: 'legacy_title_match',
      reason: 'legacy title/project match has NULL source_hash; skipped by default to avoid duplicates',
      existingIds: titleMatches.map(doc => doc.id),
    }
  }

  return { ...item, action: 'missing', reason: 'no source_hash or title/project match' }
}

function shouldEnqueue(item: InventoryItem, includeLegacyTitleMatches: boolean): boolean {
  return item.action === 'missing' ||
    item.action === 'changed' ||
    item.action === 'reingest_same_hash' ||
    (includeLegacyTitleMatches && item.action === 'legacy_title_match')
}

function markBatchDuplicates(items: InventoryItem[]): InventoryItem[] {
  const firstByKey = new Map<string, InventoryItem>()
  return items.map(item => {
    if (!item.projectId || [
      'unsupported',
      'too_large',
      'unmapped',
      'unavailable',
      'duplicate_in_batch',
      'duplicate_content_superseded',
      'failed_unextractable',
    ].includes(item.action)) {
      return item
    }
    const key = `${item.projectId}:${item.sourceHash}`
    const first = firstByKey.get(key)
    if (!first) {
      firstByKey.set(key, item)
      return item
    }
    if (!shouldEnqueue(item, true)) return item
    return {
      ...item,
      action: 'duplicate_in_batch',
      reason: `same bytes/project already present in this source batch: ${first.relPath}`,
      existingIds: first.existingIds,
    }
  })
}

function summarize(items: InventoryItem[]) {
  const byAction: Record<string, number> = {}
  const byProject: Record<string, number> = {}
  const byExt: Record<string, number> = {}
  for (const item of items) {
    byAction[item.action] = (byAction[item.action] ?? 0) + 1
    byProject[item.projectId ?? 'UNMAPPED'] = (byProject[item.projectId ?? 'UNMAPPED'] ?? 0) + 1
    byExt[item.fileExt || '(none)'] = (byExt[item.fileExt || '(none)'] ?? 0) + 1
  }
  return { total: items.length, byAction, byProject, byExt }
}

function csvEscape(value: unknown): string {
  const s = String(value ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

async function writeReports(reportPath: string, payload: unknown, items: InventoryItem[]) {
  await mkdir(path.dirname(reportPath), { recursive: true })
  await writeFile(reportPath, JSON.stringify(payload, null, 2))
  const csvPath = reportPath.replace(/\.json$/i, '.csv')
  const header = ['action', 'project_id', 'file_ext', 'file_size', 'file_name', 'rel_path', 'reason', 'existing_ids', 'job_id', 'storage_path', 'legacy_storage_path']
  const rows = items.map(item => [
    item.action,
    item.projectId,
    item.fileExt,
    item.fileSize,
    item.fileName,
    item.relPath,
    item.reason,
    item.existingIds.join(';'),
    item.jobId ?? '',
    item.storagePath,
    item.legacyStoragePath ?? '',
  ].map(csvEscape).join(','))
  await writeFile(csvPath, [header.join(','), ...rows].join('\n') + '\n')
}

async function uploadAndEnqueue(sb: SupabaseClient, item: InventoryItem): Promise<string> {
  if (!item.absPath) throw new Error(`No local bytes materialized for ${item.relPath}`)
  const buffer = await readFile(item.absPath)
  const upload = await sb.storage.from(DEFAULT_BUCKET).upload(item.storagePath, buffer, {
    contentType: getMimeType(item.fileExt),
    upsert: true,
  })
  if (upload.error) throw new Error(`Storage upload failed for ${item.relPath}: ${upload.error.message}`)
  const job = await createIngestJob(sb, {
    storageBucket: DEFAULT_BUCKET,
    storagePath: item.storagePath,
    fileName: item.fileName,
    fileSize: item.fileSize,
    projectId: item.projectId,
    docTypeHint: item.docTypeHint,
    sourceChannel: SOURCE_CHANNEL,
    requestedBy: 'sharepoint-local-reconcile',
  })
  return job.id
}

async function main() {
  const cli = parseArgs()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  const sb = createClient(url, key, { auth: { persistSession: false } })

  const loadedSources = []
  for (const source of cli.sources) loadedSources.push(await loadSourceFiles(source))
  const rawItems: InventoryItem[] = []
  for (const { files } of loadedSources) for (const { absPath, relPath, size, unavailableReason } of files) {
    const fileName = path.posix.basename(relPath)
    const fileExt = extOf(fileName)
    const fileSize = absPath ? (await stat(absPath)).size : size ?? 0
    const sourceHash = absPath
      ? sha256(await readFile(absPath))
      : sha256(Buffer.from(`${relPath}:${fileSize}:${fileExt}`))
    const { projectId, rule } = deriveProjectId(relPath, cli.forceProject)
    const storageDir = `uploads/${stableUuidFromHash(sourceHash)}`
    const storageFallback = `${sourceHash}${fileExt || '.bin'}`
    const legacyStoragePath = `${storageDir}/${safeSegment(fileName, storageFallback)}`
    const storagePath = `${storageDir}/${safeStorageSegment(fileName, storageFallback)}`
    rawItems.push({
      absPath,
      relPath,
      fileName,
      fileExt,
      fileSize,
      sourceHash,
      storagePath,
      legacyStoragePath,
      projectId,
      projectRule: rule,
      docTypeHint: deriveDocTypeHint(relPath),
      sourceUnavailable: unavailableReason,
      action: 'missing',
      reason: '',
      existingIds: [],
    })
  }

  const existing = await fetchAllDocuments(sb)
  const jobs = await fetchJobsByStoragePath(sb, [...new Set(rawItems.flatMap(item => [item.storagePath, item.legacyStoragePath].filter(Boolean) as string[]))])
  let items = markBatchDuplicates(rawItems.map(item => decideAction(item, existing, jobs)))
  if (cli.limit) items = items.slice(0, cli.limit)

  const enqueueable = items.filter(item => shouldEnqueue(item, cli.includeLegacyTitleMatches))
  const reportPath = cli.report ?? path.join('docs', 'reports', `sharepoint-local-reconcile-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)

  const applied: Array<{ relPath: string; jobId: string }> = []
  const applyErrors: Array<{ relPath: string; error: string }> = []
  if (cli.apply) {
    for (const item of enqueueable) {
      try {
        const jobId = await uploadAndEnqueue(sb, item)
        applied.push({ relPath: item.relPath, jobId })
        item.jobId = jobId
        item.reason = `${item.reason}; enqueued`
      } catch (err) {
        applyErrors.push({ relPath: item.relPath, error: err instanceof Error ? err.message : String(err) })
      }
    }
  }

  const summary = summarize(items)
  const payload = {
    generatedAt: new Date().toISOString(),
    mode: cli.apply ? 'apply' : 'dry-run',
    sources: cli.sources.map(source => path.resolve(source)),
    extractedRoots: loadedSources.map(source => source.root),
    bucket: DEFAULT_BUCKET,
    sourceChannel: SOURCE_CHANNEL,
    summary,
    enqueueable: enqueueable.length,
    applied,
    applyErrors,
    samples: {
      missing: items.filter(i => i.action === 'missing').slice(0, 25),
      changed: items.filter(i => i.action === 'changed').slice(0, 25),
      legacyTitleMatches: items.filter(i => i.action === 'legacy_title_match').slice(0, 25),
      unsupported: items.filter(i => i.action === 'unsupported').slice(0, 25),
      unmapped: items.filter(i => i.action === 'unmapped').slice(0, 25),
      unavailable: items.filter(i => i.action === 'unavailable').slice(0, 25),
    },
    items,
  }
  await writeReports(reportPath, payload, items)

  console.log(JSON.stringify({
    mode: payload.mode,
    sources: payload.sources,
    extractedRoots: payload.extractedRoots,
    report: path.resolve(reportPath),
    csv: path.resolve(reportPath.replace(/\.json$/i, '.csv')),
    ...summary,
    enqueueable: enqueueable.length,
    applied: applied.length,
    applyErrors: applyErrors.length,
  }, null, 2))
  if (!cli.apply) {
    console.log('DRY-RUN: pass --apply to upload/enqueue only enqueueable files after reviewing the report.')
  }
  if (cli.apply && applyErrors.length > 0) process.exitCode = 1
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
