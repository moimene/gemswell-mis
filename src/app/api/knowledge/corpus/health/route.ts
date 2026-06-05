import { NextResponse } from 'next/server'
import { createApiClient } from '@/lib/supabase-server'
import { buildCorpusHealth } from '@/lib/knowledge/corpus-health'
import type { SupabaseClient } from '@supabase/supabase-js'

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Internal server error'
}

/** Head-count query builder type derived from a real count query (avoids `any`). */
type CountQuery = ReturnType<
  ReturnType<SupabaseClient['from']>['select']
>

async function countWhere(sb: SupabaseClient, build: (q: CountQuery) => CountQuery): Promise<number> {
  const { count, error } = await build(sb.from('rag_documents').select('id', { count: 'exact', head: true }))
  if (error) throw new Error(error.message)
  return count ?? 0
}

export async function GET() {
  try {
    const sb = createApiClient()

    const [total, approved, needs_review, rejected, pending, retired, sourceOfRecord, withMarkdown, withSourceHash] =
      await Promise.all([
        countWhere(sb, q => q),
        countWhere(sb, q => q.eq('review_status', 'approved')),
        countWhere(sb, q => q.eq('review_status', 'needs_review')),
        countWhere(sb, q => q.eq('review_status', 'rejected')),
        countWhere(sb, q => q.eq('review_status', 'pending')),
        countWhere(sb, q => q.eq('status', 'retired')),
        countWhere(sb, q => q.gte('authority_score', 90).eq('review_status', 'approved')
          .in('classification_source', ['human', 'agent_reviewed', 'agent_corrected'])),
        countWhere(sb, q => q.not('md_path', 'is', null)),
        countWhere(sb, q => q.not('source_hash', 'is', null)),
      ])

    // avg authority over indexed docs — single lightweight column fetch (one int column × ~5.5k rows)
    let authoritySum = 0, authorityCount = 0
    const { data: authRows, error: authErr } = await sb
      .from('rag_documents').select('authority_score').eq('status', 'indexed')
    if (authErr) throw new Error(authErr.message)
    for (const r of authRows ?? []) { authoritySum += Number(r.authority_score) || 0; authorityCount++ }

    const { data: queueRows } = await sb.from('ingest_queue').select('status')
    const queue = {
      total: queueRows?.length ?? 0,
      queued: queueRows?.filter(r => r.status === 'queued').length ?? 0,
      processing: queueRows?.filter(r => r.status === 'processing').length ?? 0,
      done: queueRows?.filter(r => r.status === 'done').length ?? 0,
      error: queueRows?.filter(r => r.status === 'error').length ?? 0,
    }

    const health = buildCorpusHealth({
      total, approved, needs_review, rejected, pending, retired, sourceOfRecord,
      authoritySum, authorityCount, withMarkdown, withSourceHash, queue,
    })
    return NextResponse.json(health)
  } catch (err: unknown) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
