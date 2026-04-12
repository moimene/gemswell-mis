import { NextRequest, NextResponse } from 'next/server'
import { createApiClient } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'pending_review'
    const project = searchParams.get('project')
    const domain = searchParams.get('domain')
    const packId = searchParams.get('pack_id')
    const limit = parseInt(searchParams.get('limit') || '100', 10)

    const supabase = createApiClient()

    // Fetch candidates with metric definition joined
    let query = supabase
      .from('intel_metric_candidate')
      .select(`
        id,
        metric_id,
        extracted_value,
        extracted_text,
        period_label,
        period_date,
        currency,
        confidence,
        extraction_method,
        context_snippet,
        authority_score,
        status,
        validation_status,
        validation_notes,
        is_latest,
        created_at,
        rag_document_id,
        rag_chunk_id,
        extraction_run_id,
        intel_metric_definition!metric_id (
          display_name,
          domain,
          project_id,
          unit,
          target_table,
          target_column,
          extraction_hint
        ),
        rag_documents!rag_document_id (
          title,
          doc_type,
          source_file,
          project_id
        )
      `)
      .order('created_at', { ascending: false })
      .limit(limit)

    // Pack filter — bypass status/is_latest defaults when fetching by pack
    if (packId) {
      query = query.eq('pack_id', packId)
    } else {
      // Status filter: 'all' fetches everything
      if (status !== 'all') {
        query = query.eq('status', status)
      }
      // Only latest extractions per metric
      query = query.eq('is_latest', true)
    }

    const { data, error } = await query

    if (error) {
      console.error('Candidates fetch error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Post-filter by project/domain (joined fields)
    let filtered = data || []

    if (project && project !== 'all') {
      filtered = filtered.filter((c: any) =>
        c.intel_metric_definition?.project_id === project
      )
    }

    if (domain && domain !== 'all') {
      filtered = filtered.filter((c: any) =>
        c.intel_metric_definition?.domain === domain
      )
    }

    return NextResponse.json({ candidates: filtered, total: filtered.length })
  } catch (err: any) {
    console.error('Candidates API error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
