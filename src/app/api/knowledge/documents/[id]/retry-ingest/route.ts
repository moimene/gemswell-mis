import { NextRequest, NextResponse } from 'next/server'
import { createApiClient, requireUser } from '@/lib/supabase-server'
import { createIngestJob } from '@/lib/ingest/jobs'
import { canRetryFailedDocument } from '@/lib/knowledge/failed-document-actions'

const RETRY_COLUMNS = 'id, title, status, storage_path, project_id, doc_type'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const sb = createApiClient()
    const { data: doc, error } = await sb
      .from('rag_documents')
      .select(RETRY_COLUMNS)
      .eq('id', id)
      .maybeSingle()
    if (error) {
      console.error('[knowledge/documents/:id/retry-ingest] fetch failed:', error.message)
      return NextResponse.json({ error: 'No se pudo cargar el documento.' }, { status: 500 })
    }
    if (!doc) return NextResponse.json({ error: 'document not found' }, { status: 404 })

    const allowed = canRetryFailedDocument(doc)
    if (!allowed.ok) {
      return NextResponse.json({ error: allowed.reason }, { status: allowed.reason === 'document not found' ? 404 : 409 })
    }

    const active = await sb
      .from('knowledge_ingest_jobs')
      .select('*')
      .eq('storage_path', doc.storage_path as string)
      .in('status', ['queued', 'processing'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (active.error) {
      console.error('[knowledge/documents/:id/retry-ingest] active job lookup failed:', active.error.message)
      return NextResponse.json({ error: 'No se pudo comprobar la cola de ingesta.' }, { status: 500 })
    }
    if (active.data) return NextResponse.json({ ok: true, job: active.data, alreadyQueued: true }, { status: 202 })

    const job = await createIngestJob(sb, {
      storagePath: doc.storage_path as string,
      fileName: doc.title as string,
      projectId: typeof doc.project_id === 'string' ? doc.project_id : null,
      docTypeHint: typeof doc.doc_type === 'string' ? doc.doc_type : null,
      requestedBy: user.email ?? user.id,
      sourceChannel: 'browser_upload',
    })
    return NextResponse.json({ ok: true, job, alreadyQueued: false }, { status: 202 })
  } catch (err) {
    console.error('[knowledge/documents/:id/retry-ingest] failed:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'No se pudo reintentar la ingesta.' }, { status: 500 })
  }
}
