import { NextRequest, NextResponse } from 'next/server'
import { createApiClient, requireUser } from '@/lib/supabase-server'
import {
  createIngestJob,
  getIngestJobSummary,
  INGEST_JOB_STATUSES,
  listIngestJobs,
  type IngestJobStatus,
} from '@/lib/ingest/jobs'

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Error interno'
}

function clampLimit(value: string | null): number {
  const n = Number(value)
  return Number.isFinite(n) ? Math.min(Math.max(n, 1), 100) : 25
}

export async function GET(request: NextRequest) {
  try {
    if (!(await requireUser())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    const sb = createApiClient()
    const url = new URL(request.url)
    const status = (url.searchParams.get('status') ?? 'all') as IngestJobStatus | 'all'
    if (status !== 'all' && !(INGEST_JOB_STATUSES as readonly string[]).includes(status)) {
      return NextResponse.json({ error: 'status inválido' }, { status: 400 })
    }
    const limit = clampLimit(url.searchParams.get('limit'))

    const [jobs, summary] = await Promise.all([
      listIngestJobs(sb, { status, limit }),
      getIngestJobSummary(sb),
    ])
    return NextResponse.json({ items: jobs.items, summary, unavailable: jobs.unavailable || Boolean(summary.unavailable) })
  } catch (err) {
    console.error('[knowledge/ingest/jobs] GET failed:', errMessage(err))
    return NextResponse.json({ error: 'No se pudo cargar la cola de ingesta.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const user = await requireUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  try {
    const body = (await request.json().catch(() => null)) as
      | { storagePath?: string; fileName?: string; fileSize?: number; project_id?: string; doc_type?: string }
      | null
    if (!body?.storagePath || !body.fileName) {
      return NextResponse.json({ error: 'Faltan storagePath/fileName' }, { status: 400 })
    }

    const sb = createApiClient()
    const job = await createIngestJob(sb, {
      storagePath: body.storagePath,
      fileName: body.fileName,
      fileSize: body.fileSize ?? null,
      projectId: body.project_id?.trim() || null,
      docTypeHint: body.doc_type?.trim() || null,
      requestedBy: user.email ?? user.id,
      sourceChannel: 'browser_upload',
    })

    return NextResponse.json({ ok: true, job }, { status: 202 })
  } catch (err) {
    const message = errMessage(err)
    const status = /storagePath|fileName|Tipo no soportado|Falta|El archivo/.test(message) ? 400 : 500
    console.error('[knowledge/ingest/jobs] POST failed:', message)
    return NextResponse.json({ error: status === 400 ? message : 'No se pudo encolar el documento.' }, { status })
  }
}
