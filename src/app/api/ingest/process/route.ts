import { NextRequest, NextResponse } from 'next/server'
import { createApiClient } from '@/lib/supabase-server'
import { errorMessage, processIngestQueueBatch } from '@/lib/ingest/queue-processor'

const DMS_ROOT = process.env.DMS_ROOT || '/Users/moisesmenendez/Dropbox/DESARROLLO/GEMSWELL_MIS/DMS_GEMSWELL'

// Next.js config: allow long-running requests for ingestion.
export const maxDuration = 800

/**
 * POST /api/ingest/process
 * Process a batch of files from ingest_queue.
 * Body: { batchSize?: number } defaults to one file.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({})) as { batchSize?: number; itemId?: string }
    const batchSize = Math.max(1, Number(body.batchSize || 1))
    const supabase = createApiClient()

    const result = await processIngestQueueBatch(supabase, batchSize, {
      dmsRoot: DMS_ROOT,
      queueItemId: body.itemId,
      log: message => console.log(message),
    })

    return NextResponse.json(result)
  } catch (err: unknown) {
    console.error('Ingest process API error:', err)
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 })
  }
}
