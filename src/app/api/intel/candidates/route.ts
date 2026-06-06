import { NextRequest, NextResponse } from 'next/server'
import { createApiClient, requireUser } from '@/lib/supabase-server'
import { attachGroundedDocument, firstJoined, type MaybeJoined } from '@/lib/intel/grounding'

type MetricDefinition = {
  display_name: string
  domain: string
  project_id: string
  unit: string
  target_table: string
  target_column: string
  extraction_hint: string | null
}

type CandidateRow = {
  id: string
  intel_metric_definition?: MaybeJoined<MetricDefinition>
  rag_documents?: MaybeJoined<{
    title: string | null
    source_type: string | null
  }>
  rag_chunks?: MaybeJoined<{
    metadata: Record<string, unknown> | null
  }>
}

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Internal server error'
}

export async function GET(request: NextRequest) {
  try {
    if (!(await requireUser())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
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
          source_type
        ),
        rag_chunks!rag_chunk_id (
          metadata
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
    let filtered = ((data || []) as CandidateRow[]).map(attachGroundedDocument)

    if (project && project !== 'all') {
      filtered = filtered.filter(candidate =>
        firstJoined(candidate.intel_metric_definition)?.project_id === project
      )
    }

    if (domain && domain !== 'all') {
      filtered = filtered.filter(candidate =>
        firstJoined(candidate.intel_metric_definition)?.domain === domain
      )
    }

    return NextResponse.json({ candidates: filtered, total: filtered.length })
  } catch (err: unknown) {
    console.error('Candidates API error:', err)
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
