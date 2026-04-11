import { NextRequest, NextResponse } from 'next/server'
import { createApiClient } from '@/lib/supabase-server'
import { parseDocument } from '@/lib/rag/parse'
import { chunkFinancialContent, embedText, type ChunkMetadata } from '@/lib/rag/embeddings'
import { readFile } from 'fs/promises'

const DMS_ROOT = process.env.DMS_ROOT || '/Users/moisesmenendez/Dropbox/DESARROLLO/GEMSWELL_MIS/DMS_GEMSWELL'

/**
 * POST /api/ingest/process
 * Process a batch of files from the ingest_queue.
 * Body: { batchSize?: number } — defaults to 1 file at a time
 *
 * Pipeline: read file → parse (LlamaParse/xlsx) → chunk → embed → store in rag_chunks
 */
export async function POST(request: NextRequest) {
  const { batchSize = 1 } = await request.json().catch(() => ({}))
  const supabase = createApiClient()

  // Get next queued files
  const { data: queue, error: qErr } = await supabase
    .from('ingest_queue')
    .select('*')
    .eq('status', 'queued')
    .order('relevance', { ascending: false })
    .limit(batchSize)

  if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 })
  if (!queue?.length) return NextResponse.json({ message: 'No files in queue', processed: 0 })

  const results: { file: string; status: string; chunks?: number; error?: string }[] = []

  for (const item of queue) {
    // Mark as processing
    await supabase
      .from('ingest_queue')
      .update({ status: 'processing' })
      .eq('id', item.id)

    try {
      // Step 1: Read file from local filesystem
      const fullPath = `${DMS_ROOT}/${item.rel_path}`
      const buffer = await readFile(fullPath)

      // Step 2: Parse document
      const mimeType = getMimeType(item.file_ext)
      const parsed = await parseDocument(fullPath, Buffer.from(buffer), item.file_name, mimeType)

      if (!parsed.content || parsed.content.trim().length < 50) {
        throw new Error('Parsed content too short or empty')
      }

      // Step 3: Chunk with financial metadata
      const baseMetadata: ChunkMetadata = {
        project_id: item.project_id || undefined,
        doc_type: item.category || undefined,
        source_file: item.file_name,
      }

      const chunks = chunkFinancialContent(parsed.content, baseMetadata)

      if (chunks.length === 0) {
        throw new Error('No chunks generated from content')
      }

      // Step 4: Create rag_document record
      const { data: ragDoc, error: docErr } = await supabase
        .from('rag_documents')
        .insert({
          title: item.file_name,
          source_type: item.file_ext,
          chunk_count: chunks.length,
          status: 'indexing',
          mis_document_id: null, // no mis_document linkage for DMS files
        })
        .select('id')
        .single()

      if (docErr) throw new Error(`rag_documents insert failed: ${docErr.message}`)

      // Step 5: Generate embeddings and insert chunks (batches of 5)
      let insertedChunks = 0
      for (let i = 0; i < chunks.length; i += 5) {
        const batch = chunks.slice(i, i + 5)

        const embeddings = await Promise.all(
          batch.map(c => embedText(c.content))
        )

        const chunkRows = batch.map((c, j) => ({
          document_id: ragDoc.id,
          chunk_index: i + j,
          content: c.content,
          embedding: JSON.stringify(embeddings[j]),
          metadata: c.metadata,
          token_count: c.tokenEstimate,
        }))

        const { error: chunkErr } = await supabase
          .from('rag_chunks')
          .insert(chunkRows)

        if (chunkErr) {
          console.error(`Chunk insert error (batch ${i}):`, chunkErr)
        } else {
          insertedChunks += batch.length
        }
      }

      // Step 6: Update rag_document status
      await supabase
        .from('rag_documents')
        .update({ status: 'indexed', chunk_count: insertedChunks })
        .eq('id', ragDoc.id)

      // Step 7: Mark queue item as done
      await supabase
        .from('ingest_queue')
        .update({
          status: 'done',
          chunk_count: insertedChunks,
          processed_at: new Date().toISOString(),
        })
        .eq('id', item.id)

      results.push({ file: item.file_name, status: 'done', chunks: insertedChunks })

    } catch (err: any) {
      console.error(`Processing error for ${item.file_name}:`, err)

      await supabase
        .from('ingest_queue')
        .update({
          status: 'error',
          error_message: err.message?.slice(0, 500),
          processed_at: new Date().toISOString(),
        })
        .eq('id', item.id)

      results.push({ file: item.file_name, status: 'error', error: err.message })
    }
  }

  return NextResponse.json({
    processed: results.length,
    results,
  })
}

function getMimeType(ext: string): string {
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
