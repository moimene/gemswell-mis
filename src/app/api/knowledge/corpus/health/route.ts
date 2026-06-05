import { NextResponse } from 'next/server'
import { createApiClient } from '@/lib/supabase-server'
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
    const sb = createApiClient()

    // F6: single-query corpus health via RPC — replaces 9 head-counts + a full ~5.5k authority
    // scan + a full ingest_queue scan (perf + count fidelity). source_of_record + governance
    // counts are status='indexed'-scoped inside the RPC to match retrieval reality.
    const { data, error } = await sb.rpc('knowledge_corpus_health')
    if (error) throw new Error(error.message)

    const { docs, queue } = data as HealthRpc
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
