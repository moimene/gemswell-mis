import { NextRequest, NextResponse } from 'next/server'
import { createApiClient } from '@/lib/supabase-server'
import { parseDocument } from '@/lib/rag/parse'
import { chunkFinancialContent, embedText, type ChunkMetadata } from '@/lib/rag/embeddings'
import { readFile } from 'fs/promises'

const DMS_ROOT = process.env.DMS_ROOT || '/Users/moisesmenendez/Dropbox/DESARROLLO/GEMSWELL_MIS/DMS_GEMSWELL'

// Next.js config: allow long-running requests for ingestion
export const maxDuration = 800 // Vercel Pro max (13.3 min)

/**
 * POST /api/ingest/process
 * Process a batch of files from the ingest_queue.
 * Body: { batchSize?: number } — defaults to 1 file at a time
 *
 * Pipeline: read file → parse (LlamaParse premium) → chunk → embed → store
 *
 * QUALITY-FIRST: This is a one-time bulk ingestion.
 * We give each file as much time as needed for maximum parsing quality.
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

  const results: {
    file: string
    status: string
    chunks?: number
    parser?: string
    parseChars?: number
    error?: string
  }[] = []

  for (const item of queue) {
    const startTime = Date.now()
    console.log(`\n${'='.repeat(60)}`)
    console.log(`[ingest] Processing: ${item.file_name}`)
    console.log(`[ingest] Project: ${item.project_id} | Category: ${item.category} | Relevance: ${item.relevance}`)
    console.log(`${'='.repeat(60)}`)

    // Mark as processing
    await supabase
      .from('ingest_queue')
      .update({ status: 'processing' })
      .eq('id', item.id)

    try {
      // Step 1: Read file from local filesystem
      const fullPath = `${DMS_ROOT}/${item.rel_path}`
      console.log(`[ingest] Reading file: ${fullPath}`)
      const buffer = await readFile(fullPath)
      console.log(`[ingest] File size: ${(buffer.length / 1024).toFixed(0)} KB`)

      // Step 2: Parse document (LlamaParse premium or fallback)
      const mimeType = getMimeType(item.file_ext)
      const parsed = await parseDocument(fullPath, Buffer.from(buffer), item.file_name, mimeType)

      console.log(`[ingest] Parsed with: ${parsed.parser}`)
      console.log(`[ingest] Content length: ${parsed.content.length} chars`)

      if (!parsed.content || parsed.content.trim().length < 50) {
        throw new Error(`Parsed content too short: ${parsed.content.length} chars`)
      }

      // Step 3: Chunk with financial metadata
      const baseMetadata: ChunkMetadata = {
        project_id: item.project_id || undefined,
        doc_type: item.category || undefined,
        source_file: item.file_name,
      }

      const chunks = chunkFinancialContent(parsed.content, baseMetadata)
      console.log(`[ingest] Generated ${chunks.length} chunks`)

      if (chunks.length === 0) {
        throw new Error('No chunks generated from content')
      }

      // Step 4: Create rag_document record (bridge for FK)
      const { data: ragDoc, error: docErr } = await supabase
        .from('rag_documents')
        .insert({
          title: item.file_name,
          source_type: item.file_ext,
          chunk_count: chunks.length,
          status: 'processing',
          mis_document_id: null,
        })
        .select('id')
        .single()

      if (docErr) throw new Error(`rag_documents insert failed: ${docErr.message}`)

      // Step 5: Generate embeddings and insert chunks
      // Batches of 5 for Gemini rate limits, with retry logic
      let insertedChunks = 0
      let failedBatches = 0

      for (let i = 0; i < chunks.length; i += 5) {
        const batch = chunks.slice(i, i + 5)
        const batchNum = Math.floor(i / 5) + 1
        const totalBatches = Math.ceil(chunks.length / 5)

        try {
          const embeddings = await Promise.all(
            batch.map(c => embedText(c.content))
          )

          // Validate embeddings
          const validEmbeddings = embeddings.every(e => Array.isArray(e) && e.length === 768)
          if (!validEmbeddings) {
            console.error(`[ingest] ❌ Invalid embeddings in batch ${batchNum} — dims: ${embeddings.map(e => e.length)}`)
            failedBatches++
            continue
          }

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
            console.error(`[ingest] ❌ Chunk insert error (batch ${batchNum}/${totalBatches}):`, chunkErr.message)
            failedBatches++
          } else {
            insertedChunks += batch.length
            if (batchNum % 10 === 0 || batchNum === totalBatches) {
              console.log(`[ingest] ✅ Embedded batch ${batchNum}/${totalBatches} (${insertedChunks} chunks stored)`)
            }
          }

        } catch (embedErr: any) {
          console.error(`[ingest] ❌ Embedding error (batch ${batchNum}):`, embedErr.message)
          failedBatches++

          // Rate limit: wait and retry once
          if (embedErr.message?.includes('429') || embedErr.message?.includes('rate')) {
            console.log(`[ingest] 🕐 Rate limited, waiting 10s before retry...`)
            await new Promise(r => setTimeout(r, 10000))
            try {
              const retryEmbeddings = await Promise.all(
                batch.map(c => embedText(c.content))
              )
              const retryRows = batch.map((c, j) => ({
                document_id: ragDoc.id,
                chunk_index: i + j,
                content: c.content,
                embedding: JSON.stringify(retryEmbeddings[j]),
                metadata: c.metadata,
                token_count: c.tokenEstimate,
              }))
              const { error: retryErr } = await supabase
                .from('rag_chunks')
                .insert(retryRows)
              if (!retryErr) {
                insertedChunks += batch.length
                failedBatches-- // undo the failed count
                console.log(`[ingest] ✅ Retry succeeded for batch ${batchNum}`)
              }
            } catch { /* give up on this batch */ }
          }
        }
      }

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)

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

      console.log(`[ingest] ✅ DONE: ${item.file_name} → ${insertedChunks} chunks in ${elapsed}s (${failedBatches} failed batches, parser: ${parsed.parser})`)

      results.push({
        file: item.file_name,
        status: 'done',
        chunks: insertedChunks,
        parser: parsed.parser,
        parseChars: parsed.content.length,
      })

    } catch (err: any) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
      console.error(`[ingest] ❌ FAILED: ${item.file_name} after ${elapsed}s:`, err.message)

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
