import { NextRequest, NextResponse } from 'next/server'
import { createApiClient, requireUser } from '@/lib/supabase-server'
import {
  attachGroundedDocument,
  validationNotesText,
  type MaybeJoined,
} from '@/lib/intel/grounding'

type MetricDefinition = {
  id?: string
  display_name: string
  domain: string
  unit?: string | null
}

type CandidateRow = {
  id: string
  metric_id: string
  confidence: number
  period_date: string | null
  status: string
  validation_notes: unknown
  intel_metric_definition?: MaybeJoined<MetricDefinition>
  rag_documents?: MaybeJoined<{
    title: string | null
    source_type: string | null
  }>
  rag_chunks?: MaybeJoined<{
    metadata: Record<string, unknown> | null
  }>
}

type PackRow = {
  pack_id: string
  project_id: string
}

type MetricDefinitionRow = {
  id: string
  display_name: string
  domain: string
}

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Internal server error'
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await requireUser())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
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
          source_type
        ),
        rag_chunks!rag_chunk_id (
          metadata
        )
      `)
      .eq('pack_id', id)
      .order('status')
      .order('metric_id')

    if (cErr) {
      return NextResponse.json({ error: cErr.message }, { status: 500 })
    }
    const groundedCandidates = ((candidates || []) as CandidateRow[]).map(attachGroundedDocument)
    const packRow = pack as PackRow

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
        .eq('project_id', packRow.project_id)
        .eq('status', 'open')
        .order('severity'),

      // All metric definitions for this project (to find gaps)
      supabase
        .from('intel_metric_definition')
        .select('id, display_name, domain')
        .eq('project_id', packRow.project_id)
        .eq('is_active', true),

      // Publication receipts for this pack
      supabase
        .from('intel_fact_publication')
        .select('metric_id, target_table, target_column, published_value, published_at')
        .in('candidate_id', groundedCandidates.map(candidate => candidate.id)),
    ])

    // Derive reconciliation items
    const acceptedMetricIds = new Set(
      groundedCandidates
        .filter(candidate => candidate.status === 'accepted')
        .map(candidate => candidate.metric_id)
    )
    const provisionalCandidates = groundedCandidates.filter(candidate =>
      candidate.status === 'accepted' &&
      (validationNotesText(candidate.validation_notes).toLowerCase().includes('provisional') || candidate.confidence < 0.75)
    )
    const missingMetrics = ((allMetricDefs || []) as MetricDefinitionRow[])
      .filter(definition => !acceptedMetricIds.has(definition.id))
    const staleThresholdDays = 90
    const staleMs = staleThresholdDays * 24 * 3600 * 1000
    const now = Date.now()
    const staleCandidates = groundedCandidates.filter(candidate => {
      if (candidate.status !== 'accepted' || !candidate.period_date) return false
      const age = now - new Date(candidate.period_date).getTime()
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

    return NextResponse.json({ pack, candidates: groundedCandidates, reconciliation })
  } catch (err: unknown) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
