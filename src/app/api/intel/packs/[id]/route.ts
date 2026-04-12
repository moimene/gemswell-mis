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

    // Reconciliation data — parallel fetches
    const [
      { data: contradictions },
      { data: allMetricDefs },
      { data: publications },
    ] = await Promise.all([
      // Open contradictions for this pack's project
      supabase
        .from('intel_contradiction_alert')
        .select('id, metric_id, value_a, value_b, delta_pct, severity, status, resolution_note, period_label')
        .eq('project_id', pack.project_id)
        .eq('status', 'open')
        .order('severity'),

      // All metric definitions for this project (to find gaps)
      supabase
        .from('intel_metric_definition')
        .select('id, display_name, domain')
        .eq('project_id', pack.project_id)
        .eq('is_active', true),

      // Publication receipts for this pack
      supabase
        .from('intel_fact_publication')
        .select('metric_id, target_table, target_column, published_value, published_at')
        .in('candidate_id', (candidates || []).map((c: any) => c.id)),
    ])

    // Derive reconciliation items
    const acceptedMetricIds = new Set(
      (candidates || []).filter((c: any) => c.status === 'accepted').map((c: any) => c.metric_id)
    )
    const provisionalCandidates = (candidates || []).filter((c: any) =>
      c.status === 'accepted' &&
      (c.validation_notes?.toLowerCase().includes('provisional') || c.confidence < 0.75)
    )
    const missingMetrics = (allMetricDefs || []).filter(d => !acceptedMetricIds.has(d.id))
    const staleThresholdDays = 90
    const staleMs = staleThresholdDays * 24 * 3600 * 1000
    const staleCandidates = (candidates || []).filter((c: any) => {
      if (c.status !== 'accepted' || !c.period_date) return false
      const age = Date.now() - new Date(c.period_date).getTime()
      return age > staleMs
    })

    const reconciliation = {
      contradictions:       contradictions || [],
      provisional:          provisionalCandidates,
      missing_metrics:      missingMetrics,
      stale:                staleCandidates,
      publications:         publications || [],
      summary: {
        total_items:          (contradictions?.length || 0) + provisionalCandidates.length + missingMetrics.length + staleCandidates.length,
        contradictions_open:  contradictions?.length || 0,
        provisional_count:    provisionalCandidates.length,
        missing_count:        missingMetrics.length,
        stale_count:          staleCandidates.length,
        published_count:      publications?.length || 0,
      },
    }

    return NextResponse.json({ pack, candidates: candidates || [], reconciliation })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
