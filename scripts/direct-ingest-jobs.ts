import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { errorMessage, ingestBuffer } from '../src/lib/ingest/queue-processor'
import type { SourceChannel } from '../src/lib/knowledge/contracts'

type Cli = {
  ids: string[]
  files: string[]
  includeLlama402Errors: boolean
  includeExpiredProcessing: boolean
  limit: number | null
  dryRun: boolean
}

type JobRow = {
  id: string
  status: string
  attempts: number | null
  max_attempts: number | null
  storage_bucket: string
  storage_path: string
  file_name: string
  file_ext: string | null
  file_size: number | null
  project_id: string | null
  doc_type_hint: string | null
  source_channel: string | null
  error_message: string | null
  lease_expires_at: string | null
}

function usage(): never {
  console.error(`Usage:
  npx tsx scripts/direct-ingest-jobs.ts [selectors] [--dry-run]

Selectors:
  --id <job-id>                 Process a specific knowledge_ingest_jobs row. Repeatable.
  --file <file-name>            Process latest non-done row by exact file name. Repeatable.
  --llama-402-errors            Process error rows caused by exhausted LlamaParse credits.
  --expired-processing          Process processing rows whose lease has expired.
  --limit N                     Limit selected jobs after de-duplication.

This downloads the existing Storage object and runs the normal ingestBuffer pipeline.
Set RAG_LOCAL_PARSE_FALLBACK=force to avoid LlamaParse for local recovery.
`)
  process.exit(1)
}

function parseArgs(): Cli {
  const argv = process.argv.slice(2)
  const ids: string[] = []
  const files: string[] = []
  let includeLlama402Errors = false
  let includeExpiredProcessing = false
  let limit: number | null = null
  let dryRun = false

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--id') {
      const id = argv[++i] ?? ''
      if (!id) usage()
      ids.push(id)
    } else if (arg === '--file') {
      const file = argv[++i] ?? ''
      if (!file) usage()
      files.push(file)
    } else if (arg === '--llama-402-errors') {
      includeLlama402Errors = true
    } else if (arg === '--expired-processing') {
      includeExpiredProcessing = true
    } else if (arg === '--limit') {
      const n = Number(argv[++i])
      if (!Number.isInteger(n) || n <= 0) usage()
      limit = n
    } else if (arg === '--dry-run') {
      dryRun = true
    } else {
      usage()
    }
  }

  if (!ids.length && !files.length && !includeLlama402Errors && !includeExpiredProcessing) usage()
  return { ids, files, includeLlama402Errors, includeExpiredProcessing, limit, dryRun }
}

function extOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  return dot >= 0 ? fileName.slice(dot).toLowerCase() : ''
}

function dedupeJobs(groups: JobRow[][], limit: number | null): JobRow[] {
  const jobs = new Map<string, JobRow>()
  for (const group of groups) {
    for (const job of group) {
      if (job.status === 'done' || job.status === 'canceled') continue
      jobs.set(job.id, job)
    }
  }
  const selected = Array.from(jobs.values())
  return limit == null ? selected : selected.slice(0, limit)
}

async function fetchJobs(sb: SupabaseClient, cli: Cli): Promise<JobRow[]> {
  const groups: JobRow[][] = []

  if (cli.ids.length) {
    const { data, error } = await sb
      .from('knowledge_ingest_jobs')
      .select('*')
      .in('id', cli.ids)
      .returns<JobRow[]>()
    if (error) throw new Error(`job id lookup failed: ${error.message}`)
    groups.push(data ?? [])
  }

  for (const file of cli.files) {
    const { data, error } = await sb
      .from('knowledge_ingest_jobs')
      .select('*')
      .eq('file_name', file)
      .neq('status', 'done')
      .order('updated_at', { ascending: false })
      .limit(1)
      .returns<JobRow[]>()
    if (error) throw new Error(`job file lookup failed for ${file}: ${error.message}`)
    groups.push(data ?? [])
  }

  if (cli.includeLlama402Errors) {
    const { data, error } = await sb
      .from('knowledge_ingest_jobs')
      .select('*')
      .eq('status', 'error')
      .ilike('error_message', '%maximum number of credits%')
      .order('updated_at', { ascending: false })
      .returns<JobRow[]>()
    if (error) throw new Error(`Llama 402 job lookup failed: ${error.message}`)
    groups.push(data ?? [])
  }

  if (cli.includeExpiredProcessing) {
    const { data, error } = await sb
      .from('knowledge_ingest_jobs')
      .select('*')
      .eq('status', 'processing')
      .lt('lease_expires_at', new Date().toISOString())
      .order('updated_at', { ascending: false })
      .returns<JobRow[]>()
    if (error) throw new Error(`expired processing job lookup failed: ${error.message}`)
    groups.push(data ?? [])
  }

  return dedupeJobs(groups, cli.limit)
}

async function processJob(sb: SupabaseClient, job: JobRow): Promise<Record<string, unknown>> {
  const { data: blob, error: downloadErr } = await sb.storage
    .from(job.storage_bucket)
    .download(job.storage_path)
  if (downloadErr || !blob) throw new Error(`download failed: ${downloadErr?.message ?? 'no blob returned'}`)

  const buffer = Buffer.from(await blob.arrayBuffer())
  if (buffer.length === 0) throw new Error('downloaded file is empty')

  const result = await ingestBuffer(sb, {
    fileName: job.file_name,
    fileExt: job.file_ext || extOf(job.file_name),
    buffer,
    projectId: job.project_id,
    docTypeHint: job.doc_type_hint,
    rawStoragePath: job.storage_path,
    sourceChannel: (job.source_channel || 'drive_sync') as SourceChannel,
  }, {
    embeddingBatchSize: 20,
    log: message => console.log(JSON.stringify({ job_id: job.id, file: job.file_name, message })),
  })

  const now = new Date().toISOString()
  const patch: Record<string, unknown> = result.status === 'done'
    ? {
        status: 'done',
        stage: 'indexed',
        finished_at: now,
        lease_expires_at: null,
        document_id: result.documentId ?? null,
        chunks: result.chunks ?? 0,
        parser: result.parser ?? null,
        error_message: null,
      }
    : {
        status: 'error',
        stage: 'error',
        finished_at: now,
        lease_expires_at: null,
        document_id: result.documentId ?? null,
        error_message: (result.error ?? 'No se pudo procesar el documento').slice(0, 1000),
      }

  const { error: updateErr } = await sb
    .from('knowledge_ingest_jobs')
    .update(patch)
    .eq('id', job.id)
  if (updateErr) throw new Error(`job update failed: ${updateErr.message}`)

  return { job_id: job.id, ...result }
}

async function main() {
  process.env.RAG_LOCAL_PARSE_FALLBACK = process.env.RAG_LOCAL_PARSE_FALLBACK || 'force'
  const cli = parseArgs()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')

  const sb = createClient(url, key, { auth: { persistSession: false } })
  const jobs = await fetchJobs(sb, cli)
  console.log(JSON.stringify({
    selected: jobs.length,
    dryRun: cli.dryRun,
    jobs: jobs.map(job => ({
      id: job.id,
      file: job.file_name,
      status: job.status,
      attempts: job.attempts,
      storage_path: job.storage_path,
      error: job.error_message,
    })),
  }, null, 2))

  if (cli.dryRun) return

  const results: Record<string, unknown>[] = []
  for (const job of jobs) {
    try {
      results.push(await processJob(sb, job))
    } catch (err) {
      const message = errorMessage(err).slice(0, 1000)
      await sb
        .from('knowledge_ingest_jobs')
        .update({
          status: 'error',
          stage: 'error',
          finished_at: new Date().toISOString(),
          lease_expires_at: null,
          error_message: message,
        })
        .eq('id', job.id)
      results.push({ job_id: job.id, file: job.file_name, status: 'error', error: message })
    }
  }
  console.log(JSON.stringify({ results }, null, 2))
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
