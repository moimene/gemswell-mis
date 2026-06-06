import { NextRequest, NextResponse } from 'next/server'
import { createApiClient, requireUser } from '@/lib/supabase-server'

type QueueItem = {
  relPath: string
  fileName: string
  fileExt: string
  fileSize: number
  projectId: string
  category: string
  relevance: number
}

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Internal server error'
}

export async function POST(request: NextRequest) {
  try {
    if (!(await requireUser())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    const { files } = await request.json() as { files: QueueItem[] }

    if (!files?.length) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 })
    }

    const supabase = createApiClient()

    // Upsert files into ingest_queue (skip if already exists)
    const rows = files.map(f => ({
      rel_path: f.relPath,
      file_name: f.fileName,
      file_ext: f.fileExt,
      file_size: f.fileSize,
      project_id: f.projectId,
      category: f.category,
      relevance: f.relevance,
      status: 'queued',
      queued_at: new Date().toISOString(),
    }))

    const { data, error } = await supabase
      .from('ingest_queue')
      .upsert(rows, { onConflict: 'rel_path', ignoreDuplicates: false })
      .select('id')

    if (error) {
      console.error('Queue insert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ queued: data?.length || 0 })

  } catch (err: unknown) {
    console.error('Queue API error:', err)
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}

// GET: return current queue status
export async function GET() {
  try {
    if (!(await requireUser())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    const supabase = createApiClient()
    const { data, error } = await supabase
      .from('ingest_queue')
      .select('*')
      .order('relevance', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const summary = {
      total: data?.length || 0,
      queued: data?.filter(r => r.status === 'queued').length || 0,
      processing: data?.filter(r => r.status === 'processing').length || 0,
      done: data?.filter(r => r.status === 'done').length || 0,
      error: data?.filter(r => r.status === 'error').length || 0,
    }

    return NextResponse.json({ summary, items: data })
  } catch (err: unknown) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
