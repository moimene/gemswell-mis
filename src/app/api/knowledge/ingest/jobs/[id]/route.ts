import { NextRequest, NextResponse } from 'next/server'
import { createApiClient, requireUser } from '@/lib/supabase-server'
import { getIngestJob } from '@/lib/ingest/jobs'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await requireUser())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    const { id } = await params
    const job = await getIngestJob(createApiClient(), id)
    if (!job) return NextResponse.json({ error: 'job not found' }, { status: 404 })
    return NextResponse.json({ job })
  } catch (err) {
    console.error('[knowledge/ingest/jobs/:id] GET failed:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'No se pudo cargar el job.' }, { status: 500 })
  }
}
