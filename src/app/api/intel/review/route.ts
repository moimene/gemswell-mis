import { NextRequest, NextResponse } from 'next/server'
import { createApiClient } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      candidate_id,
      decision,          // 'accept' | 'reject' | 'override' | 'defer'
      override_value,    // numeric, only for 'override'
      override_reason,
      decided_by = 'reviewer@gemswell.com',
    } = body

    if (!candidate_id || !decision) {
      return NextResponse.json({ error: 'candidate_id and decision required' }, { status: 400 })
    }

    if (!['accept', 'reject', 'override', 'defer'].includes(decision)) {
      return NextResponse.json({ error: 'Invalid decision value' }, { status: 400 })
    }

    const supabase = createApiClient()

    // 1. Load the candidate to validate it exists and is reviewable
    const { data: candidate, error: candidateError } = await supabase
      .from('intel_metric_candidate')
      .select('id, status, metric_id, extracted_value, period_date, period_label')
      .eq('id', candidate_id)
      .single()

    if (candidateError || !candidate) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })
    }

    if (!['pending_review', 'auto_accepted', 'validation_failed'].includes(candidate.status)) {
      return NextResponse.json(
        { error: `Candidate status '${candidate.status}' cannot be reviewed` },
        { status: 400 }
      )
    }

    // 2. Map decision → new candidate status
    const statusMap: Record<string, string> = {
      accept: 'accepted',
      reject: 'rejected',
      override: 'accepted',   // override accepts with corrected value
      defer: 'pending_review', // stays pending
    }
    const newStatus = statusMap[decision]

    // 3. Update candidate status
    const { error: updateError } = await supabase
      .from('intel_metric_candidate')
      .update({
        status: newStatus,
        // If override, update the extracted value to the corrected one
        ...(decision === 'override' && override_value != null
          ? { extracted_value: override_value }
          : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', candidate_id)

    if (updateError) {
      console.error('Candidate update error:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // 4. Write review decision to audit trail
    const { data: decisionRecord, error: decisionError } = await supabase
      .from('intel_review_decision')
      .insert({
        candidate_id,
        decision,
        override_value: decision === 'override' ? override_value : null,
        override_reason: override_reason || null,
        decided_by,
        decided_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (decisionError) {
      console.error('Decision insert error:', decisionError)
      // Non-fatal — candidate is already updated
    }

    // 5. If accepted/overridden, publish to the appropriate fact table
    let publication = null
    if (decision === 'accept' || decision === 'override') {
      publication = await publishToFactTable(supabase, candidate, decisionRecord, decided_by, override_value)
    }

    return NextResponse.json({
      ok: true,
      candidate_id,
      decision,
      new_status: newStatus,
      decision_id: decisionRecord?.id || null,
      publication,
    })
  } catch (err: any) {
    console.error('Review API error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

async function publishToFactTable(
  supabase: any,
  candidate: any,
  decisionRecord: any,
  decidedBy: string,
  overrideValue?: number
) {
  try {
    // Load the metric definition to know where to write
    const { data: metric, error: metricError } = await supabase
      .from('intel_metric_definition')
      .select('target_table, target_column, target_filter, project_id')
      .eq('id', candidate.metric_id)
      .single()

    if (metricError || !metric) return null

    const publishedValue = overrideValue != null ? overrideValue : candidate.extracted_value

    // Upsert into the fact table (append-only snapshot pattern)
    const factRow: Record<string, any> = {
      project_id: metric.project_id,
      ...(metric.target_filter || {}),
      [metric.target_column]: publishedValue,
      source_file: `intel:${candidate.metric_id}`,
    }

    // Set the date field based on table type
    if (metric.target_table === 'fct_cash_13w') {
      factRow.week_start = candidate.period_date
    } else {
      factRow.period_end_date = candidate.period_date
    }

    const { data: factRowResult, error: factError } = await supabase
      .from(metric.target_table)
      .insert(factRow)
      .select('id')
      .single()

    if (factError) {
      console.error(`Fact publish error (${metric.target_table}):`, factError)
      return null
    }

    // Record the publication receipt
    const { data: pub } = await supabase
      .from('intel_fact_publication')
      .insert({
        target_table: metric.target_table,
        target_row_id: factRowResult.id,
        target_column: metric.target_column,
        published_value: publishedValue,
        candidate_id: candidate.id,
        decision_id: decisionRecord?.id || null,
        metric_id: candidate.metric_id,
        published_by: decidedBy,
        published_at: new Date().toISOString(),
      })
      .select()
      .single()

    return pub
  } catch (err: any) {
    console.error('Publish error:', err)
    return null
  }
}
