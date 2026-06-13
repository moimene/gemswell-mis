import { NextRequest, NextResponse } from 'next/server'
import { createApiClient, requireUser } from '@/lib/supabase-server'
import { cancelIngestJob } from '@/lib/ingest/jobs'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await requireUser())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    const { id } = await params
    const job = await cancelIngestJob(createApiClient(), id)
    return NextResponse.json({ ok: true, job })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'No se pudo cancelar el job.'
    const status = /not found/.test(message) ? 404 : /No se puede/.test(message) ? 409 : 500
    console.error('[knowledge/ingest/jobs/:id/cancel] failed:', message)
    return NextResponse.json({ error: status === 500 ? 'No se pudo cancelar el job.' : message }, { status })
  }
}
