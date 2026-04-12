import { NextResponse } from 'next/server'
import { createApiClient } from '@/lib/supabase-server'

export async function GET() {
  try {
    const supabase = createApiClient()

    // 1. Candidate pipeline stats from the view
    const { data: pipeline, error: pipelineError } = await supabase
      .from('v_intel_candidate_pipeline')
      .select('*')

    if (pipelineError) {
      console.error('Pipeline stats error:', pipelineError)
    }

    // 2. Open contradictions
    const { data: contradictions, error: contrError } = await supabase
      .from('v_intel_contradictions_open')
      .select('*')
      .limit(20)

    if (contrError) {
      console.error('Contradictions error:', contrError)
    }

    // 3. Latest extraction run
    const { data: latestRun } = await supabase
      .from('intel_extraction_run')
      .select('id, status, started_at, completed_at, candidates_created, contradictions_found, documents_scanned')
      .order('started_at', { ascending: false })
      .limit(1)
      .single()

    // 4. Aggregate pipeline totals
    const totals = {
      pending_review: 0,
      auto_accepted: 0,
      accepted: 0,
      rejected: 0,
      validation_failed: 0,
      total: 0,
    }

    for (const row of pipeline || []) {
      const status = row.status as keyof typeof totals
      if (status in totals) {
        totals[status] += Number(row.candidate_count || 0)
        totals.total += Number(row.candidate_count || 0)
      }
    }

    return NextResponse.json({
      totals,
      pipeline: pipeline || [],
      contradictions: contradictions || [],
      latest_run: latestRun || null,
    })
  } catch (err: any) {
    console.error('Stats API error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
