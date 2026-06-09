import type { SupabaseClient } from '@supabase/supabase-js'
import { reapStrandedDocuments, ingestBuffer } from './queue-processor'

// F6 — ingest reaper. Two jobs, run on a Vercel cron (vercel.json → /api/cron/ingest-reaper):
//  1. flip docs stranded in status='processing' (killed mid-ingest) to 'error' — on a SCHEDULE, not
//     only opportunistically on the next upload (the F15 reaper only fired on upload).
//  2. RE-INGEST (not just mark) recoverable docs: status='error' WITH original bytes in Storage
//     (storage_path). Re-ingest goes through ingestBuffer, idempotent by source_hash (deletes the doc's
//     chunks + re-runs the governed pipeline on the same row), so re-running converges — never duplicates.
//
// Chat-safety: every retrieval RPC filters status='indexed'; the reaper only touches 'processing'/'error'
// docs, which are already invisible to chat. The worst case (chunks deleted, re-ingest throws) leaves an
// 'error' doc as an 'error' doc with 0 chunks — no delta vs its pre-reaper state. It cannot regress chat.
//
// RETRY CEILING (Ronda-1 finding): a permanently-failing doc (corrupt bytes, scanned-no-text) must NOT be
// re-downloaded + re-parsed every 30 min forever (spend + head-of-line starvation). `reingest_attempts`
// (sql/029) is incremented on each failure; listRecoverable excludes docs at/over the cap and orders
// least-attempted first. If sql/029 is not yet applied, the re-ingest lane FAILS CLOSED (returns no docs)
// so no uncapped loop is ever possible — job 1 (stranded sweep) still runs.
//
// Legacy docs (5,496/5,498) have NULL storage_path → not re-ingested. The re-ingest lane is preventive
// infra for new direct-to-Storage uploads; it acts on real data as those accrue.
//
// Deps are injected so the orchestration is unit-tested without a DB/Storage (see __tests__/reaper.test.ts).

export type RecoverableDoc = {
  id: string
  storage_path: string
  title: string
  project_id: string | null
  reingest_attempts: number
}
export type ReaperResult = {
  stranded: number
  scanned: number
  reingested: number
  failed: number
  timedOut: boolean
  capDisabled: boolean
}

export type ReaperDeps = {
  reapStranded: (sb: SupabaseClient, olderThanMinutes: number) => Promise<number>
  // returns [] (and capDisabled via the marker doc) if sql/029 is not applied — fail closed.
  listRecoverable: (sb: SupabaseClient, limit: number, maxAttempts: number) => Promise<RecoverableDoc[] | null>
  downloadBytes: (sb: SupabaseClient, storagePath: string) => Promise<Buffer | null>
  reingest: (sb: SupabaseClient, doc: RecoverableDoc, buffer: Buffer) => Promise<{ status: string }>
  markFailure: (sb: SupabaseClient, docId: string, nextAttempts: number) => Promise<void>
  now: () => number
}

export type ReaperOptions = {
  strandedOlderThanMinutes?: number
  batchLimit?: number
  budgetMs?: number
  maxAttempts?: number
  bucket?: string
}

function extOf(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot >= 0 ? name.slice(dot).toLowerCase() : ''
}

function numberEnv(name: string, fallback: number): number {
  const v = Number(process.env[name])
  return Number.isFinite(v) && v > 0 ? v : fallback
}

export function defaultReaperDeps(opts: ReaperOptions = {}): ReaperDeps {
  const bucket = opts.bucket ?? process.env.KNOWLEDGE_ARTIFACT_BUCKET ?? 'documents'
  return {
    reapStranded: reapStrandedDocuments,
    listRecoverable: async (sb, limit, maxAttempts) => {
      const { data, error } = await sb
        .from('rag_documents')
        .select('id, storage_path, title, project_id, reingest_attempts')
        .eq('status', 'error')
        .not('storage_path', 'is', null)
        .neq('review_status', 'rejected')          // never re-process a rejected doc (sticky)
        .neq('classification_source', 'agent_rejected')
        .lt('reingest_attempts', maxAttempts)        // retry ceiling
        .order('reingest_attempts', { ascending: true })  // least-attempted first → no head-of-line block
        .order('created_at', { ascending: true })
        .limit(limit)
      if (error) {
        // 42703 = undefined_column → sql/029 not applied yet → fail closed (no re-ingest, no loop).
        if ((error as { code?: string }).code === '42703') {
          console.warn('[reaper] reingest_attempts column missing (sql/029 not applied) — re-ingest lane disabled; stranded-sweep still runs.')
          return null
        }
        console.error('[reaper] listRecoverable failed:', error.message)
        return []
      }
      return (data ?? []) as RecoverableDoc[]
    },
    downloadBytes: async (sb, storagePath) => {
      const { data: blob, error } = await sb.storage.from(bucket).download(storagePath)
      if (error || !blob) return null
      return Buffer.from(await blob.arrayBuffer())
    },
    reingest: async (sb, doc, buffer) => {
      // fileExt from the storage_path (preserves the original uploaded filename) — title is renamable.
      const res = await ingestBuffer(sb, {
        fileName: doc.title,
        fileExt: extOf(doc.storage_path) || extOf(doc.title),
        buffer,
        projectId: doc.project_id,
        rawStoragePath: doc.storage_path,
      })
      return { status: res.status }
    },
    markFailure: async (sb, docId, nextAttempts) => {
      await sb.from('rag_documents').update({ reingest_attempts: nextAttempts }).eq('id', docId)
    },
    now: () => Date.now(),
  }
}

/**
 * Sweep stranded docs (job 1) then re-ingest a time-boxed, retry-capped batch of recoverable docs
 * (job 2). Pure orchestration over injected deps; the real deps hit Supabase + Storage + ingestBuffer.
 */
export async function reapAndRequeue(
  sb: SupabaseClient,
  opts: ReaperOptions = {},
  deps: ReaperDeps = defaultReaperDeps(opts)
): Promise<ReaperResult> {
  const stranded = await deps.reapStranded(sb, opts.strandedOlderThanMinutes ?? numberEnv('REAPER_STRANDED_MINUTES', 30))
  const batchLimit = opts.batchLimit ?? numberEnv('REAPER_BATCH_LIMIT', 10)
  const budgetMs = opts.budgetMs ?? numberEnv('REAPER_BUDGET_MS', 600_000)
  const maxAttempts = opts.maxAttempts ?? numberEnv('REAPER_MAX_ATTEMPTS', 5)

  const recoverable = await deps.listRecoverable(sb, batchLimit, maxAttempts)
  const capDisabled = recoverable === null
  const start = deps.now()
  let scanned = 0
  let reingested = 0
  let failed = 0
  let timedOut = false

  for (const doc of recoverable ?? []) {
    if (deps.now() - start >= budgetMs) {
      timedOut = true
      break
    }
    scanned++
    try {
      const buffer = await deps.downloadBytes(sb, doc.storage_path)
      if (!buffer) {
        await deps.markFailure(sb, doc.id, (doc.reingest_attempts ?? 0) + 1)
        failed++
        continue
      }
      const res = await deps.reingest(sb, doc, buffer)
      if (res.status === 'error') {
        await deps.markFailure(sb, doc.id, (doc.reingest_attempts ?? 0) + 1)
        failed++
      } else {
        reingested++
      }
    } catch (err) {
      await deps.markFailure(sb, doc.id, (doc.reingest_attempts ?? 0) + 1).catch(() => undefined)
      failed++
      console.error(`[reaper] re-ingest ${doc.id} failed:`, err instanceof Error ? err.message : err)
    }
  }

  if (failed > 0 || timedOut) {
    console.warn(`[reaper] run finished with issues: ${JSON.stringify({ stranded, scanned, reingested, failed, timedOut, capDisabled })}`)
  }
  return { stranded, scanned, reingested, failed, timedOut, capDisabled }
}
