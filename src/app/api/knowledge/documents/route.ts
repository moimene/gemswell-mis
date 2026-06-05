import { NextRequest, NextResponse } from 'next/server'
import { createApiClient } from '@/lib/supabase-server'
import { parseListParams, LIST_COLUMNS } from '@/lib/knowledge/documents-query'

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Internal server error'
}

export async function GET(request: NextRequest) {
  try {
    const p = parseListParams(request.nextUrl.searchParams)
    const supabase = createApiClient()

    let query = supabase
      .from('rag_documents')
      .select(LIST_COLUMNS, { count: 'exact' })

    // Retired docs hidden by default (mirrors RPC status='indexed'); includeRetired shows all
    if (!p.includeRetired) query = query.eq('status', 'indexed')
    if (p.status) query = query.eq('review_status', p.status)
    if (p.onlyNeedsReview) query = query.eq('review_status', 'needs_review')
    if (p.doc_type) query = query.eq('doc_type', p.doc_type)
    if (p.project) query = query.eq('project_id', p.project)
    if (p.channel) query = query.eq('source_channel', p.channel)
    if (p.authorityMin != null) query = query.gte('authority_score', p.authorityMin)
    if (p.onlyNoMarkdown) query = query.is('md_path', null)
    if (p.q) query = query.ilike('title', `%${p.q}%`)

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
