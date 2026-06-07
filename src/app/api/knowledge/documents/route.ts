import { NextRequest, NextResponse } from 'next/server'
import { createApiClient, requireUser } from '@/lib/supabase-server'
import { parseListParams, LIST_COLUMNS } from '@/lib/knowledge/documents-query'

// F11: never leak raw Postgres/PostgREST internals (column/enum/constraint names) to the client —
// log the real error server-side, return a generic message.
function internalError(context: string, err: unknown): NextResponse {
  console.error(`[knowledge/documents] ${context}:`, err instanceof Error ? err.message : err)
  return NextResponse.json({ error: 'Error interno al procesar la solicitud.' }, { status: 500 })
}

export async function GET(request: NextRequest) {
  try {
    if (!(await requireUser())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    const p = parseListParams(request.nextUrl.searchParams)

    // F17: an unrecognised doc_type returns ZERO results, never the full list.
    if (p.docTypeInvalid) {
      return NextResponse.json({ items: [], page: p.page, pageSize: p.pageSize, total: 0, totalPages: 0 })
    }

    const supabase = createApiClient()

    let query = supabase
      .from('rag_documents')
      .select(LIST_COLUMNS, { count: 'exact' })

    // F7: retired docs hidden by default; includeRetired means indexed-OR-retired (not all statuses)
    query = p.includeRetired
      ? query.in('status', ['indexed', 'retired'])
      : query.eq('status', 'indexed')
    if (p.status) query = query.eq('review_status', p.status)
    if (p.onlyNeedsReview) query = query.eq('review_status', 'needs_review')
    if (p.doc_type) query = query.eq('doc_type', p.doc_type)
    if (p.project) query = query.eq('project_id', p.project)
    if (p.channel) query = query.eq('source_channel', p.channel)
    if (p.authorityMin != null) query = query.gte('authority_score', p.authorityMin)
    if (p.onlyNoMarkdown) query = query.is('md_path', null)
    // F12: escape LIKE wildcards (% _ \) so a literal search term isn't treated as a pattern
    if (p.q) {
      const safeQ = p.q.replace(/[%_\\]/g, m => '\\' + m)
      query = query.ilike('title', `%${safeQ}%`)
    }

    // F18: review-priority ordering surfaces the least-confident, oldest docs first for the queue.
    if (p.sort === 'review') {
      query = query
        .order('classification_confidence', { ascending: true, nullsFirst: true })
        .order('created_at', { ascending: true })
    } else {
      query = query
        .order('authority_score', { ascending: false })
        .order('created_at', { ascending: false })
    }
    query = query.range(p.offset, p.offset + p.pageSize - 1)

    const { data, error, count } = await query
    if (error) return internalError('list query', error)

    return NextResponse.json({
      items: data ?? [],
      page: p.page, pageSize: p.pageSize, total: count ?? 0,
      totalPages: count ? Math.ceil(count / p.pageSize) : 0,
    })
  } catch (err: unknown) {
    return internalError('list handler', err)
  }
}
