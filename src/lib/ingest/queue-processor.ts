import type { SupabaseClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import Anthropic from '@anthropic-ai/sdk'
import { parseDocument } from '@/lib/rag/parse'
import { chunkFinancialContent, embedBatch, DIMENSIONS, EMBEDDING_MODEL, type ChunkMetadata } from '@/lib/rag/embeddings'
import { buildMarkdownArtifact, type MarkdownFrontmatter } from '@/lib/knowledge/markdown-artifact'
import { classifyDocument, decideReviewStatus } from '@/lib/knowledge/classify'
import type {
  AuthorityTier,
  ClassificationSource,
  Lifecycle,
  ReviewStatus,
  SourceChannel,
} from '@/lib/knowledge/contracts'

export type IngestQueueRow = {
  id: string
  rel_path: string
  file_name: string
  file_ext: string
  file_size?: number | null
  project_id?: string | null
  category?: string | null
  relevance?: number | null
}

export type IngestProcessResult = {
  file: string
  status: 'done' | 'error'
  chunks?: number
  parser?: string
  parseChars?: number
  error?: string
}

type RagDocumentInsert = {
  id: string
}

type ReservedDocument = {
  id: string
  reused: boolean
  rejected?: boolean
  skipReingest?: boolean
  existingChunks?: number | null
}

let _anthropicClient: Anthropic | null = null
function getAnthropic(): Anthropic {
  if (!_anthropicClient) {
    _anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!,
      timeout: 30000,
      maxRetries: 3,
    })
  }
  return _anthropicClient
}

const DEFAULT_EMBEDDING_BATCH_SIZE = numberEnv('INGEST_EMBEDDING_BATCH_SIZE', 5)
const DEFAULT_RETRY_DELAY_MS = 10_000
const DEFAULT_SOURCE_CHANNEL: SourceChannel = 'local_backfill'
const DEFAULT_CLASSIFICATION_SOURCE: ClassificationSource = 'agent_auto'
const DEFAULT_REVIEW_STATUS: ReviewStatus = 'needs_review'
const DEFAULT_LIFECYCLE: Lifecycle = 'unknown'
const DEFAULT_AUTHORITY_TIER: AuthorityTier = 'unverified'
const DEFAULT_AUTHORITY_SCORE = 0

export function getMimeType(ext: string): string {
  const map: Record<string, string> = {
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.xls': 'application/vnd.ms-excel',
    '.pdf': 'application/pdf',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.csv': 'text/csv',
    '.txt': 'text/plain',
    // image mimes so a scanned image routes to OCR (audit A2)
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.tiff': 'image/tiff',
    '.tif': 'image/tiff',
    '.heic': 'image/heic',
  }
  return map[ext] || 'application/octet-stream'
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Unknown error'
}

/**
 * F15 reaper: ingestBuffer runs synchronously inside the upload request; if the serverless function
 * is killed mid-ingest (timeout, deploy, OOM, tab close) the doc is stranded in status='processing'
 * — invisible to chat (needs 'indexed') and to error-retry. This sweeps docs that have been
 * 'processing' for longer than any real ingest could take and flips them to 'error' so they're
 * visible/retryable. `created_at < cutoff` protects in-flight uploads (created_at = now); the only
 * edge is a re-ingest of an OLD doc caught mid-flight, which the ingest's own final update then
 * corrects back to 'indexed' (a harmless transient).
 */
export async function reapStrandedDocuments(
  supabase: SupabaseClient,
  olderThanMinutes = 30
): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanMinutes * 60_000).toISOString()
  const { data, error } = await supabase
    .from('rag_documents')
    .update({ status: 'error', chunk_count: 0, review_reason: 'reaped: stranded in processing' })
    .eq('status', 'processing')
    .lt('created_at', cutoff)
    .select('id')
  if (error) {
    console.error('[reaper] failed:', error.message)
    return 0
  }
  if (data && data.length) console.warn(`[reaper] flipped ${data.length} stranded processing doc(s) to error`)
  return data?.length ?? 0
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function numberEnv(name: string, fallback: number): number {
  const value = Number(process.env[name])
  return Number.isFinite(value) && value > 0 ? value : fallback
}

function sha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex')
}

function hasMissingColumnError(error: { message?: string; code?: string } | null): boolean {
  return error?.code === 'PGRST204' ||
    error?.message?.toLowerCase().includes('column') === true ||
    error?.message?.toLowerCase().includes('schema cache') === true
}

async function reserveRagDocument(
  supabase: SupabaseClient,
  item: IngestQueueRow,
  sourceHash: string,
  sourceChannel: SourceChannel
): Promise<ReservedDocument> {
  const sourceType = item.file_ext.replace('.', '') || item.file_ext
  const baseRow = {
    title: item.file_name,
    source_type: sourceType,
    chunk_count: 0,
    status: 'processing',
    mis_document_id: null,
  }
  const governedRow = {
    ...baseRow,
    source_hash: sourceHash,
    source_channel: sourceChannel,
    classification_source: DEFAULT_CLASSIFICATION_SOURCE,
    review_status: DEFAULT_REVIEW_STATUS,
    lifecycle: DEFAULT_LIFECYCLE,
    authority_tier: DEFAULT_AUTHORITY_TIER,
    authority_score: DEFAULT_AUTHORITY_SCORE,
    current_version: 1,
  }

  const { data, error } = await supabase
    .from('rag_documents')
    .insert(governedRow)
    .select('id')
    .single()

  if (!error && data) return { id: (data as RagDocumentInsert).id, reused: false }

  if (error && (error as { code?: string }).code === '23505') {
    const { data: existing, error: existingError } = await supabase
      .from('rag_documents')
      .select('id, review_status, classification_source, status, chunk_count')
      .eq('source_hash', sourceHash)
      .maybeSingle()

    if (existingError) throw new Error(`rag_documents source_hash lookup failed: ${existingError.message}`)
    if (existing) {
      const document = existing as RagDocumentInsert & {
        review_status?: string
        classification_source?: string
        status?: string
        chunk_count?: number | null
      }
      // CX-3: defense-in-depth — agent_rejected is the second rejection signal the chat RPCs
      // already exclude, so a re-ingest of an agent-rejected doc must also be sticky (else
      // governance can be silently overwritten).
      if (document.review_status === 'rejected' || document.classification_source === 'agent_rejected') {
        return { id: document.id, reused: true, rejected: true }
      }
      if (document.status === 'indexed' && (document.chunk_count ?? 0) > 0) {
        return {
          id: document.id,
          reused: true,
          skipReingest: true,
          existingChunks: document.chunk_count ?? 0,
        }
      }
      const deleted = await supabase.from('rag_chunks').delete().eq('document_id', document.id)
      if (deleted.error) throw new Error(`rag_chunks cleanup failed: ${deleted.error.message}`)
      const processing = await supabase
        .from('rag_documents')
        .update({ status: 'processing', chunk_count: 0, source_channel: sourceChannel })
        .eq('id', document.id)
      if (processing.error) throw new Error(`rag_documents reuse update failed: ${processing.error.message}`)
      return { id: document.id, reused: true }
    }
  }

  if (!hasMissingColumnError(error)) {
    throw new Error(`rag_documents reserve failed: ${error?.message ?? 'Unknown error'}`)
  }

  const fallback = await supabase
    .from('rag_documents')
    .insert(baseRow)
    .select('id')
    .single()

  if (fallback.error) throw new Error(`rag_documents reserve fallback failed: ${fallback.error.message}`)
  const document = fallback.data as RagDocumentInsert | null
  if (!document) throw new Error('rag_documents reserve fallback returned no id')

  return { id: document.id, reused: false }
}

async function saveMarkdownArtifact(
  supabase: SupabaseClient,
  documentId: string,
  markdown: string,
  bucket: string,
  log: (message: string) => void
): Promise<string | null> {
  const mdPath = `artifacts/${documentId}/v1.md`
  const { error } = await supabase.storage
    .from(bucket)
    .upload(mdPath, Buffer.from(markdown, 'utf8'), {
      contentType: 'text/markdown; charset=utf-8',
      upsert: true,
    })

  if (error) {
    log(`[ingest] Markdown artifact upload skipped: ${error.message}`)
    return null
  }

  const update = await supabase
    .from('rag_documents')
    .update({ md_path: mdPath, md_status: 'generated' })
    .eq('id', documentId)

  if (update.error) {
    if (hasMissingColumnError(update.error)) {
      log(`[ingest] Markdown artifact saved, but md columns are not migrated yet: ${mdPath}`)
    } else {
      log(`[ingest] Markdown artifact metadata update failed: ${update.error.message}`)
    }
  } else {
    log(`[ingest] Markdown artifact saved: ${bucket}/${mdPath}`)
  }

  return mdPath
}

async function insertChunkBatch(
  supabase: SupabaseClient,
  documentId: string,
  batch: ReturnType<typeof chunkFinancialContent>,
  startIndex: number
) {
  const embeddings = await embedBatch(batch.map(chunk => chunk.content))
  const validEmbeddings = embeddings.every(embedding => Array.isArray(embedding) && embedding.length === DIMENSIONS)
  if (!validEmbeddings) {
    throw new Error(`Invalid embedding dimensions: ${embeddings.map(embedding => embedding.length).join(', ')}`)
  }

  const chunkRows = batch.map((chunk, index) => ({
    document_id: documentId,
    chunk_index: startIndex + index,
    content: chunk.content,
    embedding: JSON.stringify(embeddings[index]),
    metadata: chunk.metadata,
    token_count: chunk.tokenEstimate,
  }))

  const { error } = await supabase
    .from('rag_chunks')
    .insert(chunkRows)

  if (error) throw new Error(`rag_chunks insert failed: ${error.message}`)
}

export type UploadIngestInput = {
  fileName: string        // e.g. "Acta consejo 2026-03.pdf"
  fileExt: string         // e.g. ".pdf" (lowercased, with dot)
  buffer: Buffer          // the uploaded file bytes
  projectId?: string | null
  docTypeHint?: string | null  // optional doc_type/category hint (classifier may override)
  rawStoragePath?: string | null  // F3: where the original file was uploaded in Storage (for citation artifacts)
  sourceChannel?: SourceChannel
}

/**
 * Ingest a single in-memory file (browser upload) through the SAME governed pipeline as the queue:
 * reserve -> parse -> Haiku classify -> markdown artifact -> chunk -> embed -> index. No filesystem
 * (works on serverless) and no ingest_queue coupling. Uploaded docs land as review_status the
 * classifier decides (typically needs_review), so they appear in the gestor for human governance.
 */
export async function ingestBuffer(
  supabase: SupabaseClient,
  input: UploadIngestInput,
  options?: { embeddingBatchSize?: number; artifactBucket?: string; retryDelayMs?: number; log?: (message: string) => void }
): Promise<IngestProcessResult & { documentId?: string; reused?: boolean; duplicateTitleCount?: number }> {
  const startTime = Date.now()
  const log = options?.log ?? (() => undefined)
  const embeddingBatchSize = options?.embeddingBatchSize ?? DEFAULT_EMBEDDING_BATCH_SIZE
  const retryDelayMs = options?.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS
  const artifactBucket = options?.artifactBucket ?? process.env.KNOWLEDGE_ARTIFACT_BUCKET ?? 'documents'
  const sourceChannel = input.sourceChannel ??
    (input.rawStoragePath?.startsWith('uploads/') ? 'browser_upload' : DEFAULT_SOURCE_CHANNEL)
  // Reuse the queue row shape so we can call the shared helpers unchanged.
  const item: IngestQueueRow = {
    id: '', rel_path: input.fileName, file_name: input.fileName, file_ext: input.fileExt,
    project_id: input.projectId ?? null, category: input.docTypeHint ?? null, relevance: null,
  }
  let documentId: string | null = null
  let duplicateTitleCount = 0
  try {
    const buffer = input.buffer
    const sourceHash = sha256(buffer)
    log(`[upload] ${input.fileName} (${(buffer.length / 1024).toFixed(0)} KB)`)

    // F14: source_hash dedup is unreliable for the legacy corpus (5,496/5,498 have NULL source_hash),
    // so also surface a same-title collision so the operator knows they may be creating a duplicate.
    const { count: titleMatches } = await supabase
      .from('rag_documents')
      .select('id', { count: 'exact', head: true })
      .eq('title', input.fileName)
      .neq('status', 'error')
    duplicateTitleCount = titleMatches ?? 0

    const reserved = await reserveRagDocument(supabase, item, sourceHash, sourceChannel)
    documentId = reserved.id
    if (reserved.rejected) {
      return { file: input.fileName, status: 'done', chunks: 0, documentId, reused: true, duplicateTitleCount }
    }
    if (reserved.skipReingest) {
      log(`[upload] existing source_hash already indexed — skipping re-ingest for document ${documentId}`)
      return {
        file: input.fileName,
        status: 'done',
        chunks: reserved.existingChunks ?? 0,
        documentId,
        reused: true,
        duplicateTitleCount,
      }
    }
    if (reserved.reused) log(`[upload] existing source_hash — re-ingesting document ${documentId}`)

    // Persist original bytes location BEFORE parsing/embedding. If a large upload fails mid-pipeline,
    // the reaper can recover it from Storage instead of leaving an unretryable status='error' row.
    if (input.rawStoragePath) {
      const earlyArtifact = await supabase
        .from('rag_documents')
        .update({ storage_path: input.rawStoragePath, source_channel: sourceChannel })
        .eq('id', documentId)
      if (earlyArtifact.error) log(`[upload] early storage_path update skipped: ${earlyArtifact.error.message}`)
    }

    const parsed = await parseDocument(input.fileName, buffer, input.fileName, getMimeType(input.fileExt))
    if (!parsed.content || parsed.content.trim().length < 50) {
      // F10: the most common cause of a near-empty parse is a scanned/image-only document the parser
      // (incl. LlamaParse premium OCR) could not extract text from — say so instead of "too short".
      throw new Error(
        `El documento parece escaneado o sin texto extraíble (el parser obtuvo solo ${parsed.content.trim().length} caracteres). ` +
        `Si es un PDF escaneado, súbelo con OCR aplicado o en un formato con texto.`
      )
    }

    let cls: Awaited<ReturnType<typeof classifyDocument>> = null
    try {
      cls = await classifyDocument(
        { title: input.fileName, sample: parsed.content.slice(0, 4000), dmsFolder: input.docTypeHint ?? null },
        getAnthropic()
      )
    } catch (clsErr) {
      log(`[upload] classify failed, using rule governance: ${errorMessage(clsErr)}`)
    }
    const govDocType = cls?.result.doc_type ?? input.docTypeHint ?? null
    const govTier: AuthorityTier = cls?.result.authority_tier ?? DEFAULT_AUTHORITY_TIER
    const govScore = cls?.authority_score ?? DEFAULT_AUTHORITY_SCORE
    const govConfidence = cls?.result.confidence ?? 0
    const govLifecycle: Lifecycle = (cls?.result.lifecycle as Lifecycle) ?? DEFAULT_LIFECYCLE
    const govReview = decideReviewStatus({ doc_type: govDocType, authority_tier: govTier, confidence: govConfidence })
    const govSource: ClassificationSource = cls ? 'agent_auto' : 'rule'

    const mdFrontmatter: MarkdownFrontmatter = {
      document_id: documentId, source_channel: sourceChannel, source_hash: sourceHash,
      file_name: input.fileName, mime_type: getMimeType(input.fileExt), business_line_id: null,
      project_id: input.projectId || null, doc_type: govDocType, lifecycle: govLifecycle,
      authority_tier: govTier, authority_score: govScore, classification_source: govSource,
      review_status: govReview, parser: parsed.parser, ocr_used: parsed.ocr_used ?? false,
      generated_at: new Date().toISOString(), version: 1,
    }
    const finalMarkdown = buildMarkdownArtifact(parsed.content, mdFrontmatter)
    const mdPath = await saveMarkdownArtifact(supabase, documentId, finalMarkdown, artifactBucket, log)

    const baseMetadata: ChunkMetadata = {
      project_id: input.projectId || undefined, doc_type: govDocType ?? undefined,
      source_file: input.fileName, document_id: documentId, source_hash: sourceHash,
      source_channel: sourceChannel, review_status: govReview, classification_source: govSource,
      lifecycle: govLifecycle, authority_tier: govTier, authority_score: govScore,
      parser_used: parsed.parser, ocr_used: parsed.ocr_used ?? false,
      embedding_model: EMBEDDING_MODEL, ...(mdPath ? { md_path: mdPath } : {}),
    }
    const chunks = chunkFinancialContent(finalMarkdown, baseMetadata)
    if (chunks.length === 0) throw new Error('No chunks generated from content')

    // F9: per-batch try/catch + rate-limit retry + reconciliation, matching the old queue path — so a
    // single transient 429/insert error near the end of a large doc no longer discards the whole ingest.
    let insertedChunks = 0
    for (let i = 0; i < chunks.length; i += embeddingBatchSize) {
      const batch = chunks.slice(i, i + embeddingBatchSize)
      try {
        await insertChunkBatch(supabase, documentId, batch, i)
        insertedChunks += batch.length
      } catch (err: unknown) {
        const message = errorMessage(err)
        if (message.includes('429') || message.toLowerCase().includes('rate')) {
          log(`[upload] rate limited on batch @${i}, retrying after ${retryDelayMs / 1000}s`)
          await sleep(retryDelayMs)
          await insertChunkBatch(supabase, documentId, batch, i) // a second failure propagates to the outer catch
          insertedChunks += batch.length
        } else {
          throw err
        }
      }
    }
    if (insertedChunks !== chunks.length) {
      throw new Error(`Embedding incomplete: inserted ${insertedChunks}/${chunks.length} chunks`)
    }

    const { error: finalUpdateErr } = await supabase
      .from('rag_documents')
      .update({
        status: 'indexed', chunk_count: insertedChunks, doc_type: govDocType, authority_tier: govTier,
        authority_score: govScore, classification_source: govSource, classification_confidence: govConfidence,
        review_status: govReview, lifecycle: govLifecycle, summary: cls?.result.summary ?? null,
        topics: cls?.result.topics ?? null, currency: cls?.result.currency ?? null, period: cls?.result.period ?? null,
        ...(input.rawStoragePath ? { storage_path: input.rawStoragePath } : {}),
      })
      .eq('id', documentId)
    if (finalUpdateErr) throw new Error(`rag_documents final update failed: ${finalUpdateErr.message}`)

    // Best-effort retry bookkeeping: sql/029 may not exist on every environment, so never let this
    // fail an otherwise-successful ingest.
    try {
      const { error: retryResetErr } = await supabase
        .from('rag_documents')
        .update({ reingest_attempts: 0 })
        .eq('id', documentId)
      if (retryResetErr) log(`[upload] reingest_attempts reset skipped: ${retryResetErr.message}`)
    } catch (e) {
      log(`[upload] reingest_attempts reset threw (non-fatal): ${errorMessage(e)}`)
    }

    // A4: keep the keyword-selectivity oracle (rag_term_df) fresh now that the corpus changed, so the
    // keyword lane can't silently time out on a stale df after a bulk ingest. Best-effort — a refresh
    // failure must NOT fail an otherwise-successful ingest (the oracle degrades gracefully: an unknown
    // lexeme defaults to df=0 = treated rare = kept). DEBOUNCED: ts_stat is a full scan, so a bulk N-file
    // upload would otherwise recompute N times — skip if the oracle was refreshed in the last 10 min
    // (Ronda 2). The tail file of a bulk run still refreshes once the window elapses.
    try {
      const { data: meta } = await supabase
        .from('rag_term_df_meta').select('refreshed_at').maybeSingle()
      const staleMs = meta?.refreshed_at ? Date.now() - new Date(meta.refreshed_at as string).getTime() : Infinity
      if (staleMs >= 10 * 60 * 1000) {
        const { error: refreshErr } = await supabase.rpc('refresh_rag_term_df')
        if (refreshErr) log(`[upload] rag_term_df refresh skipped: ${refreshErr.message}`)
      } else {
        log(`[upload] rag_term_df refresh debounced (last ${Math.round(staleMs / 1000)}s ago)`)
      }
    } catch (e) {
      log(`[upload] rag_term_df refresh threw (non-fatal): ${errorMessage(e)}`)
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    log(`[upload] Done: ${input.fileName} -> ${insertedChunks} chunks in ${elapsed}s (parser: ${parsed.parser})`)
    return {
      file: input.fileName, status: 'done', chunks: insertedChunks, parser: parsed.parser,
      parseChars: parsed.content.length, documentId, reused: reserved.reused, duplicateTitleCount,
    }
  } catch (err: unknown) {
    const message = errorMessage(err)
    log(`[upload] Failed: ${input.fileName}: ${message}`)
    if (documentId) {
      await supabase.from('rag_chunks').delete().eq('document_id', documentId)
      await supabase.from('rag_documents').update({
        status: 'error',
        chunk_count: 0,
        review_reason: message.slice(0, 500),
        ...(input.rawStoragePath ? { storage_path: input.rawStoragePath } : {}),
      }).eq('id', documentId)
    }
    return { file: input.fileName, status: 'error', error: message, documentId: documentId ?? undefined }
  }
}
