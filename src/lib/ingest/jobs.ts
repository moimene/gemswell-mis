import type { SupabaseClient } from '@supabase/supabase-js'
import type { SourceChannel } from '@/lib/knowledge/contracts'
import { ingestBuffer, errorMessage } from '@/lib/ingest/queue-processor'

export const INGEST_JOB_STATUSES = ['queued', 'processing', 'done', 'error', 'canceled'] as const
export type IngestJobStatus = typeof INGEST_JOB_STATUSES[number]

export type IngestJob = {
  id: string
  created_at: string
  updated_at: string
  queued_at: string
  started_at: string | null
  finished_at: string | null
  lease_expires_at: string | null
  status: IngestJobStatus
  stage: string
  attempts: number
  max_attempts: number
  storage_bucket: string
  storage_path: string
  file_name: string
  file_ext: string
  file_size: number | null
  project_id: string | null
  doc_type_hint: string | null
  source_channel: SourceChannel
  document_id: string | null
  chunks: number | null
  parser: string | null
  error_message: string | null
  requested_by: string | null
}

export type IngestJobSummary = Record<IngestJobStatus, number> & { total: number; unavailable?: boolean }

export type CreateIngestJobInput = {
  storagePath: string
  fileName: string
  fileSize?: number | null
  projectId?: string | null
  docTypeHint?: string | null
  requestedBy?: string | null
  storageBucket?: string
  sourceChannel?: SourceChannel
}

export type ProcessIngestJobsResult = {
  scanned: number
  processed: number
  done: number
  failed: number
  retried: number
  skipped: number
  timedOut: boolean
}

const ALLOWED_EXT = new Set(['.pdf', '.doc', '.docx', '.xlsx', '.xls', '.csv', '.txt', '.pptx'])
const PROJECTS = new Set(['MAD', 'BHX', 'KLP', 'PHILAE', 'GVF', 'ETP'])
const DEFAULT_BUCKET = process.env.KNOWLEDGE_ARTIFACT_BUCKET ?? 'documents'
const DEFAULT_LEASE_MS = 2 * 60 * 60_000
export const MAX_INGEST_JOB_BYTES = 50 * 1024 * 1024

function extOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  return dot >= 0 ? fileName.slice(dot).toLowerCase() : ''
}

function asStatus(value: unknown): IngestJobStatus {
  return typeof value === 'string' && (INGEST_JOB_STATUSES as readonly string[]).includes(value)
    ? value as IngestJobStatus
    : 'error'
}

function asJob(row: Record<string, unknown>): IngestJob {
  return {
    id: String(row.id),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    queued_at: String(row.queued_at),
    started_at: typeof row.started_at === 'string' ? row.started_at : null,
    finished_at: typeof row.finished_at === 'string' ? row.finished_at : null,
    lease_expires_at: typeof row.lease_expires_at === 'string' ? row.lease_expires_at : null,
    status: asStatus(row.status),
    stage: typeof row.stage === 'string' ? row.stage : asStatus(row.status),
    attempts: Number(row.attempts ?? 0),
    max_attempts: Number(row.max_attempts ?? 3),
    storage_bucket: String(row.storage_bucket ?? DEFAULT_BUCKET),
    storage_path: String(row.storage_path),
    file_name: String(row.file_name),
    file_ext: String(row.file_ext ?? extOf(String(row.file_name ?? ''))),
    file_size: row.file_size == null ? null : Number(row.file_size),
    project_id: typeof row.project_id === 'string' ? row.project_id : null,
    doc_type_hint: typeof row.doc_type_hint === 'string' ? row.doc_type_hint : null,
    source_channel: (typeof row.source_channel === 'string' ? row.source_channel : 'browser_upload') as SourceChannel,
    document_id: typeof row.document_id === 'string' ? row.document_id : null,
    chunks: row.chunks == null ? null : Number(row.chunks),
    parser: typeof row.parser === 'string' ? row.parser : null,
    error_message: typeof row.error_message === 'string' ? row.error_message : null,
    requested_by: typeof row.requested_by === 'string' ? row.requested_by : null,
  }
}

function isMissingJobsTable(err: { code?: string; message?: string } | null | undefined): boolean {
  return err?.code === '42P01' ||
    err?.message?.toLowerCase().includes('knowledge_ingest_jobs') === true ||
    err?.message?.toLowerCase().includes('schema cache') === true
}

function throwIfError(context: string, err: { code?: string; message?: string } | null | undefined): void {
  if (err) throw new Error(`${context}: ${err.message ?? 'unknown error'}`)
}

function isMissingClaimRpc(err: { code?: string; message?: string } | null | undefined): boolean {
  return err?.code === '42883' ||
    err?.message?.toLowerCase().includes('claim_knowledge_ingest_job') === true ||
    err?.message?.toLowerCase().includes('schema cache') === true
}

export function isValidUploadStoragePath(path: string): boolean {
  return /^uploads\/[0-9a-fA-F-]{36}\/[^/]+$/.test(path)
}

export function validateIngestJobInput(input: CreateIngestJobInput): { fileExt: string; projectId: string | null } {
  if (!input.storagePath || !isValidUploadStoragePath(input.storagePath)) {
    throw new Error('storagePath inválido')
  }
  const fileName = input.fileName.trim()
  if (!fileName) throw new Error('Falta fileName')
  const fileExt = extOf(fileName)
  if (!ALLOWED_EXT.has(fileExt)) throw new Error(`Tipo no soportado (${fileExt || 'sin extensión'})`)
  if (input.fileSize != null) {
    const fileSize = Number(input.fileSize)
    if (!Number.isFinite(fileSize) || fileSize <= 0) throw new Error('El archivo está vacío')
    if (fileSize > MAX_INGEST_JOB_BYTES) {
      throw new Error(`El archivo supera el límite de ${MAX_INGEST_JOB_BYTES / 1024 / 1024} MB`)
    }
  }
  const projectId = input.projectId && PROJECTS.has(input.projectId) ? input.projectId : null
  return { fileExt, projectId }
}

function leaseExpired(job: IngestJob): boolean {
  if (!job.lease_expires_at) return false
  return new Date(job.lease_expires_at).getTime() <= Date.now()
}

function retryDelayMs(attempts: number): number {
  return Math.min(15 * 60_000, Math.max(30_000, attempts * attempts * 30_000))
}

export function isNonRetryableJobError(message: string): boolean {
  return /storagePath inválido|No se encontró el archivo subido|El archivo está vacío|supera el límite|Tipo no soportado|escaneado o sin texto extraíble|near-empty result/i.test(message)
}

export async function createIngestJob(sb: SupabaseClient, input: CreateIngestJobInput): Promise<IngestJob> {
  const { fileExt, projectId } = validateIngestJobInput(input)
  const row = {
    storage_bucket: input.storageBucket ?? DEFAULT_BUCKET,
    storage_path: input.storagePath,
    file_name: input.fileName.trim(),
    file_ext: fileExt,
    file_size: input.fileSize ?? null,
    project_id: projectId,
    doc_type_hint: input.docTypeHint?.trim() || null,
    source_channel: input.sourceChannel ?? 'browser_upload',
    stage: 'queued',
    requested_by: input.requestedBy ?? null,
  }
  const { data, error } = await sb
    .from('knowledge_ingest_jobs')
    .insert(row)
    .select('*')
    .single()
  throwIfError('knowledge_ingest_jobs insert failed', error)
  if (!data) throw new Error('knowledge_ingest_jobs insert returned no row')
  return asJob(data as Record<string, unknown>)
}

export async function listIngestJobs(
  sb: SupabaseClient,
  opts: { limit?: number; status?: IngestJobStatus | 'all' } = {}
): Promise<{ items: IngestJob[]; unavailable: boolean }> {
  const limit = Math.min(Math.max(opts.limit ?? 25, 1), 100)
  let query = sb
    .from('knowledge_ingest_jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (opts.status && opts.status !== 'all') query = query.eq('status', opts.status)
  const { data, error } = await query
  if (error) {
    if (isMissingJobsTable(error)) return { items: [], unavailable: true }
    throw new Error(`knowledge_ingest_jobs list failed: ${error.message}`)
  }
  return { items: ((data ?? []) as Record<string, unknown>[]).map(asJob), unavailable: false }
}

export async function getIngestJob(sb: SupabaseClient, id: string): Promise<IngestJob | null> {
  const { data, error } = await sb
    .from('knowledge_ingest_jobs')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) {
    if (isMissingJobsTable(error)) return null
    throw new Error(`knowledge_ingest_jobs fetch failed: ${error.message}`)
  }
  return data ? asJob(data as Record<string, unknown>) : null
}

export async function getIngestJobSummary(sb: SupabaseClient): Promise<IngestJobSummary> {
  const summary: IngestJobSummary = { total: 0, queued: 0, processing: 0, done: 0, error: 0, canceled: 0 }
  for (const status of INGEST_JOB_STATUSES) {
    const { count, error } = await sb
      .from('knowledge_ingest_jobs')
      .select('id', { count: 'exact', head: true })
      .eq('status', status)
    if (error) {
      if (isMissingJobsTable(error)) return { ...summary, unavailable: true }
      throw new Error(`knowledge_ingest_jobs summary failed: ${error.message}`)
    }
    summary[status] = count ?? 0
    summary.total += count ?? 0
  }
  return summary
}

export async function retryIngestJob(sb: SupabaseClient, id: string): Promise<IngestJob> {
  const existing = await getIngestJob(sb, id)
  if (!existing) throw new Error('job not found')
  if (existing.status === 'processing' && !leaseExpired(existing)) throw new Error('No se puede reintentar un job en proceso')
  if (existing.status === 'done') throw new Error('No se puede reintentar un job completado')
  const now = new Date().toISOString()
  const { data, error } = await sb
    .from('knowledge_ingest_jobs')
    .update({
      status: 'queued',
      stage: 'queued',
      attempts: 0,
      queued_at: now,
      started_at: null,
      finished_at: null,
      lease_expires_at: null,
      error_message: null,
    })
    .eq('id', id)
    .eq('updated_at', existing.updated_at)
    .select('*')
    .maybeSingle()
  throwIfError('knowledge_ingest_jobs retry failed', error)
  if (!data) throw new Error('El job cambió de estado; recarga antes de reintentar')
  return asJob(data as Record<string, unknown>)
}

export async function cancelIngestJob(sb: SupabaseClient, id: string): Promise<IngestJob> {
  const existing = await getIngestJob(sb, id)
  if (!existing) throw new Error('job not found')
  if (existing.status === 'processing') throw new Error('No se puede cancelar un job en proceso')
  if (existing.status === 'done') throw new Error('No se puede cancelar un job completado')
  if (existing.status === 'canceled') return existing
  const { data, error } = await sb
    .from('knowledge_ingest_jobs')
    .update({
      status: 'canceled',
      stage: 'canceled',
      finished_at: new Date().toISOString(),
      lease_expires_at: null,
      error_message: null,
    })
    .eq('id', id)
    .eq('updated_at', existing.updated_at)
    .select('*')
    .maybeSingle()
  throwIfError('knowledge_ingest_jobs cancel failed', error)
  if (!data) throw new Error('El job cambió de estado; recarga antes de cancelar')
  return asJob(data as Record<string, unknown>)
}

async function claimNextJob(sb: SupabaseClient): Promise<IngestJob | null> {
  const { data: claimedRpc, error: rpcErr } = await sb.rpc('claim_knowledge_ingest_job', {
    p_lease_seconds: Math.round(DEFAULT_LEASE_MS / 1000),
  })
  if (!rpcErr) {
    const rows = Array.isArray(claimedRpc) ? claimedRpc as Record<string, unknown>[] : claimedRpc ? [claimedRpc as Record<string, unknown>] : []
    return rows[0] ? asJob(rows[0]) : null
  }
  if (!isMissingClaimRpc(rpcErr)) {
    throw new Error(`claim_knowledge_ingest_job failed: ${rpcErr.message}`)
  }

  // Dev fallback while sql/031 has not been applied yet. Production should use the SKIP LOCKED RPC above.
  const { data, error } = await sb
    .from('knowledge_ingest_jobs')
    .select('*')
    .eq('status', 'queued')
    .order('queued_at', { ascending: true })
    .limit(10)
  throwIfError('knowledge_ingest_jobs claim scan failed', error)

  for (const row of (data ?? []) as Record<string, unknown>[]) {
    const job = asJob(row)
    if (job.attempts >= job.max_attempts) {
      await sb.from('knowledge_ingest_jobs').update({
        status: 'error',
        stage: 'error',
        finished_at: new Date().toISOString(),
        error_message: 'Retry ceiling reached',
      }).eq('id', job.id)
      continue
    }
    const now = Date.now()
    if (new Date(job.queued_at).getTime() > now) continue
    const { data: claimed, error: claimErr } = await sb
      .from('knowledge_ingest_jobs')
      .update({
        status: 'processing',
        stage: 'processing',
        attempts: job.attempts + 1,
        started_at: new Date(now).toISOString(),
        finished_at: null,
        lease_expires_at: new Date(now + DEFAULT_LEASE_MS).toISOString(),
        error_message: null,
      })
      .eq('id', job.id)
      .eq('status', 'queued')
      .select('*')
      .maybeSingle()
    throwIfError('knowledge_ingest_jobs claim failed', claimErr)
    if (claimed) return asJob(claimed as Record<string, unknown>)
  }
  return null
}

async function finishJob(sb: SupabaseClient, job: IngestJob, patch: Record<string, unknown>): Promise<boolean> {
  let query = sb
    .from('knowledge_ingest_jobs')
    .update({ ...patch, finished_at: new Date().toISOString(), lease_expires_at: null })
    .eq('id', job.id)
    .eq('status', 'processing')
    .eq('attempts', job.attempts)
  query = job.lease_expires_at ? query.eq('lease_expires_at', job.lease_expires_at) : query.is('lease_expires_at', null)
  const { data, error } = await query.select('id').maybeSingle()
  throwIfError('knowledge_ingest_jobs finish failed', error)
  return Boolean(data)
}

async function updateStage(sb: SupabaseClient, job: IngestJob, stage: string): Promise<boolean> {
  let query = sb
    .from('knowledge_ingest_jobs')
    .update({ stage })
    .eq('id', job.id)
    .eq('status', 'processing')
    .eq('attempts', job.attempts)
  query = job.lease_expires_at ? query.eq('lease_expires_at', job.lease_expires_at) : query.is('lease_expires_at', null)
  const { data, error } = await query.select('id').maybeSingle()
  if (error) throw new Error(`knowledge_ingest_jobs stage update failed: ${error.message}`)
  return Boolean(data)
}

async function requeueJobForRetry(sb: SupabaseClient, job: IngestJob, message: string): Promise<boolean> {
  let query = sb
    .from('knowledge_ingest_jobs')
    .update({
      status: 'queued',
      stage: 'retry_wait',
      queued_at: new Date(Date.now() + retryDelayMs(job.attempts)).toISOString(),
      finished_at: null,
      lease_expires_at: null,
      error_message: message,
    })
    .eq('id', job.id)
    .eq('status', 'processing')
    .eq('attempts', job.attempts)
  query = job.lease_expires_at ? query.eq('lease_expires_at', job.lease_expires_at) : query.is('lease_expires_at', null)
  const { data, error } = await query.select('id').maybeSingle()
  throwIfError('knowledge_ingest_jobs retry requeue failed', error)
  return Boolean(data)
}

async function recordFailedDocumentForJob(
  sb: SupabaseClient,
  job: IngestJob,
  message: string,
  documentId: string | null
): Promise<string | null> {
  const reviewReason = message.slice(0, 500)
  const storagePath = isValidUploadStoragePath(job.storage_path) ? job.storage_path : null

  if (documentId) {
    const { error } = await sb
      .from('rag_documents')
      .update({
        status: 'error',
        chunk_count: 0,
        review_reason: reviewReason,
        ...(storagePath ? { storage_path: storagePath } : {}),
      })
      .eq('id', documentId)
    if (error) console.warn(`[ingest-jobs] failed document update skipped for ${documentId}: ${error.message}`)
    return documentId
  }

  const sourceType = (job.file_ext || extOf(job.file_name)).replace(/^\./, '') || 'unknown'
  const { data, error } = await sb
    .from('rag_documents')
    .insert({
      title: job.file_name,
      source_type: sourceType,
      chunk_count: 0,
      status: 'error',
      project_id: job.project_id,
      doc_type: job.doc_type_hint,
      storage_path: storagePath,
      source_channel: job.source_channel,
      review_status: 'needs_review',
      classification_source: 'rule',
      lifecycle: 'unknown',
      authority_tier: 'unverified',
      authority_score: 0,
      current_version: 1,
      review_reason: reviewReason,
    })
    .select('id')
    .single()
  if (error) {
    console.warn(`[ingest-jobs] failed document insert skipped for job ${job.id}: ${error.message}`)
    return null
  }
  return typeof data?.id === 'string' ? data.id : null
}

async function processClaimedJob(sb: SupabaseClient, job: IngestJob): Promise<'done' | 'failed' | 'retried' | 'skipped'> {
  let failedDocumentId: string | null = job.document_id
  try {
    if (!isValidUploadStoragePath(job.storage_path)) throw new Error('storagePath inválido')
    if (!await updateStage(sb, job, 'downloading')) return 'skipped'
    const { data: blob, error: downloadErr } = await sb.storage.from(job.storage_bucket).download(job.storage_path)
    if (downloadErr || !blob) throw new Error('No se encontró el archivo subido en Storage')
    const buffer = Buffer.from(await blob.arrayBuffer())
    if (buffer.length === 0) throw new Error('El archivo está vacío')
    if (buffer.length > MAX_INGEST_JOB_BYTES) {
      throw new Error(`El archivo supera el límite de ${MAX_INGEST_JOB_BYTES / 1024 / 1024} MB`)
    }

    if (!await updateStage(sb, job, 'indexing')) return 'skipped'
    const result = await ingestBuffer(sb, {
      fileName: job.file_name,
      fileExt: job.file_ext || extOf(job.file_name),
      buffer,
      projectId: job.project_id,
      docTypeHint: job.doc_type_hint,
      rawStoragePath: job.storage_path,
      sourceChannel: job.source_channel,
    })
    failedDocumentId = result.documentId ?? failedDocumentId
    if (result.status === 'error') throw new Error(result.error ?? 'No se pudo procesar el documento')
    const finished = await finishJob(sb, job, {
      status: 'done',
      stage: 'indexed',
      document_id: result.documentId ?? null,
      chunks: result.chunks ?? 0,
      parser: result.parser ?? null,
      error_message: null,
    })
    if (!finished) return 'skipped'
    return 'done'
  } catch (err) {
    const message = errorMessage(err).slice(0, 1000)
    const canRetry = job.attempts < job.max_attempts && !isNonRetryableJobError(message)
    if (canRetry) {
      try {
        return await requeueJobForRetry(sb, job, message) ? 'retried' : 'skipped'
      } catch { /* terminal status will be retried by lease recovery if this update fails */ }
      return 'failed'
    }
    if (!canRetry) {
      failedDocumentId = await recordFailedDocumentForJob(sb, job, message, failedDocumentId)
    }
    const finished = await finishJob(sb, job, {
      status: 'error',
      stage: 'error',
      error_message: message,
      ...(failedDocumentId ? { document_id: failedDocumentId } : {}),
    }).catch(() => undefined)
    return finished === false ? 'skipped' : 'failed'
  }
}

export async function processIngestJobs(
  sb: SupabaseClient,
  opts: { limit?: number; budgetMs?: number } = {}
): Promise<ProcessIngestJobsResult> {
  const limit = Math.min(Math.max(opts.limit ?? 3, 1), 25)
  const budgetMs = opts.budgetMs ?? 700_000
  const start = Date.now()
  const result: ProcessIngestJobsResult = { scanned: 0, processed: 0, done: 0, failed: 0, retried: 0, skipped: 0, timedOut: false }

  while (result.processed < limit) {
    if (Date.now() - start >= budgetMs) {
      result.timedOut = true
      break
    }
    const job = await claimNextJob(sb)
    if (!job) break
    result.scanned++
    const status = await processClaimedJob(sb, job)
    result.processed++
    if (status === 'done') result.done++
    else if (status === 'retried') result.retried++
    else if (status === 'skipped') result.skipped++
    else result.failed++
  }

  return result
}
