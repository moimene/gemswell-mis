import type { SupabaseClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { readFile } from 'fs/promises'
import Anthropic from '@anthropic-ai/sdk'
import { parseDocument } from '@/lib/rag/parse'
import { chunkFinancialContent, embedBatch, DIMENSIONS, type ChunkMetadata } from '@/lib/rag/embeddings'
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

type ProcessOptions = {
  dmsRoot: string
  queueItemId?: string
  embeddingBatchSize?: number
  retryDelayMs?: number
  artifactBucket?: string
  log?: (message: string) => void
}

type RagDocumentInsert = {
  id: string
}

type ReservedDocument = {
  id: string
  reused: boolean
  rejected?: boolean
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
  }
  return map[ext] || 'application/octet-stream'
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Unknown error'
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
  sourceHash: string
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
    source_channel: DEFAULT_SOURCE_CHANNEL,
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
      .select('id, review_status, classification_source')
      .eq('source_hash', sourceHash)
      .maybeSingle()

    if (existingError) throw new Error(`rag_documents source_hash lookup failed: ${existingError.message}`)
    if (existing) {
      const document = existing as RagDocumentInsert & { review_status?: string; classification_source?: string }
      // CX-3: defense-in-depth — agent_rejected is the second rejection signal the chat RPCs
      // already exclude, so a re-ingest of an agent-rejected doc must also be sticky (else
      // governance can be silently overwritten).
      if (document.review_status === 'rejected' || document.classification_source === 'agent_rejected') {
        return { id: document.id, reused: true, rejected: true }
      }
      await supabase.from('rag_chunks').delete().eq('document_id', document.id)
      await supabase
        .from('rag_documents')
        .update({ status: 'processing', chunk_count: 0 })
        .eq('id', document.id)
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

export async function processIngestQueueItem(
  supabase: SupabaseClient,
  item: IngestQueueRow,
  options: ProcessOptions
): Promise<IngestProcessResult> {
  const startTime = Date.now()
  const log = options.log ?? (() => undefined)
  const embeddingBatchSize = options.embeddingBatchSize ?? DEFAULT_EMBEDDING_BATCH_SIZE
  const retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS
  const artifactBucket = options.artifactBucket ?? process.env.KNOWLEDGE_ARTIFACT_BUCKET ?? 'documents'
  let documentId: string | null = null

  log(`[ingest] Processing: ${item.file_name}`)
  log(`[ingest] Project: ${item.project_id ?? '?'} | Category: ${item.category ?? '?'} | Relevance: ${item.relevance ?? '?'}`)

  await supabase
    .from('ingest_queue')
    .update({ status: 'processing' })
    .eq('id', item.id)

  try {
    const fullPath = `${options.dmsRoot}/${item.rel_path}`
    log(`[ingest] Reading file: ${fullPath}`)
    const buffer = await readFile(fullPath)
    const sourceHash = sha256(Buffer.from(buffer))
    log(`[ingest] File size: ${(buffer.length / 1024).toFixed(0)} KB`)

    const reserved = await reserveRagDocument(supabase, item, sourceHash)
    documentId = reserved.id
    log(`[ingest] Reserved document: ${documentId}${reserved.reused ? ' (existing source_hash)' : ''}`)

    if (reserved.rejected) {
      log(`[ingest] skipping re-ingest of human-rejected document ${documentId}`)
      await supabase
        .from('ingest_queue')
        .update({
          status: 'done',
          error_message: 'skipped: human-rejected',
          processed_at: new Date().toISOString(),
        })
        .eq('id', item.id)
      return { file: item.file_name, status: 'done', chunks: 0 }
    }

    const parsed = await parseDocument(fullPath, Buffer.from(buffer), item.file_name, getMimeType(item.file_ext))
    log(`[ingest] Parsed with: ${parsed.parser}`)
    log(`[ingest] Content length: ${parsed.content.length} chars`)

    if (!parsed.content || parsed.content.trim().length < 50) {
      throw new Error(`Parsed content too short: ${parsed.content.length} chars`)
    }

    // Classify the freshly-parsed document so governance is real, not trusted-by-default.
    let cls: Awaited<ReturnType<typeof classifyDocument>> = null
    try {
      cls = await classifyDocument(
        { title: item.file_name, sample: parsed.content.slice(0, 4000), dmsFolder: item.category ?? null },
        getAnthropic()
      )
    } catch (clsErr) {
      log(`[ingest] classify failed, falling back to rule governance: ${errorMessage(clsErr)}`)
    }
    const govDocType = cls?.result.doc_type ?? item.category ?? null
    const govTier: AuthorityTier = cls?.result.authority_tier ?? DEFAULT_AUTHORITY_TIER
    const govScore = cls?.authority_score ?? DEFAULT_AUTHORITY_SCORE
    const govConfidence = cls?.result.confidence ?? 0
    const govLifecycle: Lifecycle = (cls?.result.lifecycle as Lifecycle) ?? DEFAULT_LIFECYCLE
    const govReview = decideReviewStatus({ doc_type: govDocType, authority_tier: govTier, confidence: govConfidence })
    const govSource: ClassificationSource = cls ? 'agent_auto' : 'rule'

    const mdFrontmatter: MarkdownFrontmatter = {
      document_id: documentId,
      source_channel: DEFAULT_SOURCE_CHANNEL,
      source_hash: sourceHash,
      file_name: item.file_name,
      mime_type: getMimeType(item.file_ext),
      business_line_id: null,
      project_id: item.project_id || null,
      doc_type: govDocType,
      lifecycle: govLifecycle,
      authority_tier: govTier,
      authority_score: govScore,
      classification_source: govSource,
      review_status: govReview,
      parser: parsed.parser,
      ocr_used: false,
      generated_at: new Date().toISOString(),
      version: 1,
    }
    const finalMarkdown = buildMarkdownArtifact(parsed.content, mdFrontmatter)
    const mdPath = await saveMarkdownArtifact(supabase, documentId, finalMarkdown, artifactBucket, log)

    const baseMetadata: ChunkMetadata = {
      project_id: item.project_id || undefined,
      doc_type: govDocType ?? undefined,
      source_file: item.file_name,
      document_id: documentId,
      source_hash: sourceHash,
      source_channel: DEFAULT_SOURCE_CHANNEL,
      review_status: govReview,
      classification_source: govSource,
      lifecycle: govLifecycle,
      authority_tier: govTier,
      authority_score: govScore,
      parser_used: parsed.parser,
      ocr_used: false,
      ...(mdPath ? { md_path: mdPath } : {}),
    }

    const chunks = chunkFinancialContent(finalMarkdown, baseMetadata)
    log(`[ingest] Generated ${chunks.length} chunks`)

    if (chunks.length === 0) {
      throw new Error('No chunks generated from content')
    }

    let insertedChunks = 0
    let failedBatches = 0

    for (let i = 0; i < chunks.length; i += embeddingBatchSize) {
      const batch = chunks.slice(i, i + embeddingBatchSize)
      const batchNumber = Math.floor(i / embeddingBatchSize) + 1
      const totalBatches = Math.ceil(chunks.length / embeddingBatchSize)

      try {
        await insertChunkBatch(supabase, documentId, batch, i)
        insertedChunks += batch.length
        if (batchNumber % 10 === 0 || batchNumber === totalBatches) {
          log(`[ingest] Embedded batch ${batchNumber}/${totalBatches} (${insertedChunks} chunks stored)`)
        }
      } catch (err: unknown) {
        const message = errorMessage(err)
        failedBatches++
        log(`[ingest] Chunk batch failed (${batchNumber}/${totalBatches}): ${message}`)

        if (message.includes('429') || message.toLowerCase().includes('rate')) {
          log(`[ingest] Rate limited, retrying batch ${batchNumber} after ${retryDelayMs / 1000}s`)
          await sleep(retryDelayMs)
          try {
            await insertChunkBatch(supabase, documentId, batch, i)
            insertedChunks += batch.length
            failedBatches--
            log(`[ingest] Retry succeeded for batch ${batchNumber}`)
          } catch (retryErr: unknown) {
            log(`[ingest] Retry failed for batch ${batchNumber}: ${errorMessage(retryErr)}`)
          }
        }
      }
    }

    if (insertedChunks !== chunks.length) {
      throw new Error(`Embedding incomplete: inserted ${insertedChunks}/${chunks.length} chunks (${failedBatches} failed batches)`)
    }

    // CX-4: silently ignoring this error would mark the queue item 'done' while
    // rag_documents.status stays 'processing' — the chat RPCs filter status='indexed', so the
    // doc + chunks become invisible. Throw and let the outer catch mark both rows 'error'
    // so the queue can be retried.
    const { error: finalUpdateErr } = await supabase
      .from('rag_documents')
      .update({
        status: 'indexed',
        chunk_count: insertedChunks,
        doc_type: govDocType,
        authority_tier: govTier,
        authority_score: govScore,
        classification_source: govSource,
        classification_confidence: govConfidence,
        review_status: govReview,
        lifecycle: govLifecycle,
        summary: cls?.result.summary ?? null,
        topics: cls?.result.topics ?? null,
        currency: cls?.result.currency ?? null,
        period: cls?.result.period ?? null,
      })
      .eq('id', documentId)
    if (finalUpdateErr) throw new Error(`rag_documents final update failed: ${finalUpdateErr.message}`)

    await supabase
      .from('ingest_queue')
      .update({
        status: 'done',
        chunk_count: insertedChunks,
        processed_at: new Date().toISOString(),
      })
      .eq('id', item.id)

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    log(`[ingest] Done: ${item.file_name} -> ${insertedChunks} chunks in ${elapsed}s (${failedBatches} failed batches, parser: ${parsed.parser})`)

    return {
      file: item.file_name,
      status: 'done',
      chunks: insertedChunks,
      parser: parsed.parser,
      parseChars: parsed.content.length,
    }
  } catch (err: unknown) {
    const message = errorMessage(err)
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    log(`[ingest] Failed: ${item.file_name} after ${elapsed}s: ${message}`)

    await supabase
      .from('ingest_queue')
      .update({
        status: 'error',
        error_message: message.slice(0, 500),
        processed_at: new Date().toISOString(),
      })
      .eq('id', item.id)

    if (documentId) {
      await supabase
        .from('rag_chunks')
        .delete()
        .eq('document_id', documentId)

      await supabase
        .from('rag_documents')
        .update({ status: 'error', chunk_count: 0 })
        .eq('id', documentId)
    }

    return { file: item.file_name, status: 'error', error: message }
  }
}

export async function processIngestQueueBatch(
  supabase: SupabaseClient,
  batchSize: number,
  options: ProcessOptions
) {
  let query = supabase
    .from('ingest_queue')
    .select('*')
    .eq('status', 'queued')

  if (options.queueItemId) {
    query = query.eq('id', options.queueItemId).limit(1)
  } else {
    query = query.order('relevance', { ascending: false }).limit(batchSize)
  }

  const { data: queue, error } = await query

  if (error) throw new Error(error.message)
  const items = (queue || []) as IngestQueueRow[]
  if (!items.length) return { message: 'No files in queue', processed: 0, results: [] as IngestProcessResult[] }

  const results: IngestProcessResult[] = []
  for (const item of items) {
    results.push(await processIngestQueueItem(supabase, item, options))
  }

  return { processed: results.length, results }
}
