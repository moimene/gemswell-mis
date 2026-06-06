import { NextRequest, NextResponse } from 'next/server'
import { createApiClient, requireUser } from '@/lib/supabase-server'
import { parseListParams, LIST_COLUMNS } from '@/lib/knowledge/documents-query'

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Internal server error'
}

export async function GET(request: NextRequest) {
  try {
    if (!(await requireUser())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    const p = parseListParams(request.nextUrl.searchParams)
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

    query = query
      .order('authority_score', { ascending: false })
      .order('created_at', { ascending: false })
      .range(p.offset, p.offset + p.pageSize - 1)

    const { data, error, count } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({
      items: data ?? [],
      page: p.page, pageSize: p.pageSize, total: count ?? 0,
      totalPages: count ? Math.ceil(count / p.pageSize) : 0,
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
