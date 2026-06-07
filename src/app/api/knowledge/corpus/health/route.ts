import { NextResponse } from 'next/server'
import { createApiClient, requireUser } from '@/lib/supabase-server'
import { buildCorpusHealth } from '@/lib/knowledge/corpus-health'

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Internal server error'
}

/** Shape returned by the knowledge_corpus_health() RPC. */
type HealthRpc = {
  docs: {
    total: number
    approved: number
    needs_review: number
    rejected: number
    pending: number
    retired: number
    source_of_record: number
    authority_sum: number
    authority_count: number
    with_markdown: number
    with_source_hash: number
  }
  queue: { total: number; queued: number; processing: number; done: number; error: number }
}

export async function GET() {
  try {
    if (!(await requireUser())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    const sb = createApiClient()

    // F6: single-query corpus health via RPC — replaces 9 head-counts + a full ~5.5k authority
    // scan + a full ingest_queue scan (perf + count fidelity). source_of_record + governance
    // counts are status='indexed'-scoped inside the RPC to match retrieval reality.
    const { data, error } = await sb.rpc('knowledge_corpus_health')
    if (error) throw new Error(error.message)

    // F22: the RPC shape is duplicated across migrations 010/011; guard against drift (a renamed/missing
    // key) instead of silently rendering `undefined` tiles.
    const d = data as Partial<HealthRpc> | null
    if (!d?.docs || typeof d.docs.total !== 'number' || !d.queue) {
      console.error('[corpus/health] unexpected RPC shape:', JSON.stringify(data)?.slice(0, 300))
      return NextResponse.json({ error: 'Estado del corpus no disponible.' }, { status: 500 })
    }

    const { docs, queue } = d as HealthRpc
    const health = buildCorpusHealth({
      total: docs.total,
      approved: docs.approved,
      needs_review: docs.needs_review,
      rejected: docs.rejected,
      pending: docs.pending,
      retired: docs.retired,
      sourceOfRecord: docs.source_of_record,
      authoritySum: docs.authority_sum,
      authorityCount: docs.authority_count,
      withMarkdown: docs.with_markdown,
      withSourceHash: docs.with_source_hash,
      queue,
    })
    return NextResponse.json(health)
  } catch (err: unknown) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
