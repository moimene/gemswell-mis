import { NextRequest, NextResponse } from 'next/server'
import { createApiClient } from '@/lib/supabase-server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createApiClient()

    // Pack header
    const { data: pack, error: packErr } = await supabase
      .from('rpt_pack')
      .select('pack_id, project_id, area, status, completeness_score, freshness_score, submitted_at, due_at, notes, is_critical, created_at')
      .eq('pack_id', id)
      .single()

    if (packErr) {
      return NextResponse.json({ error: packErr.message }, { status: 404 })
    }

    // All candidates for this pack with grounding data
    const { data: candidates, error: cErr } = await supabase
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
        authority_score,
        status,
        validation_notes,
        context_snippet,
        created_at,
        intel_metric_definition!metric_id (
          display_name,
          domain,
          unit
        ),
        rag_documents!rag_document_id (
          title,
          doc_type,
          source_file
        )
      `)
      .eq('pack_id', id)
      .order('status')
      .order('metric_id')

    if (cErr) {
      return NextResponse.json({ error: cErr.message }, { status: 500 })
    }

    return NextResponse.json({ pack, candidates: candidates || [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
