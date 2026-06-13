import { NextRequest, NextResponse } from 'next/server'
import { createApiClient, requireUser } from '@/lib/supabase-server'

type DocEventRow = {
  id: string
  document_id: string
  action: string
  field: string | null
  old_value: string | null
  new_value: string | null
  actor: string
  reason: string | null
  created_at: string
}

type DocHeader = {
  id: string
  title: string | null
  project_id: string | null
  doc_type: string | null
}

type MetricDecisionRow = {
  id: string
  candidate_id: string
  decision: string
  override_value: number | null
  override_reason: string | null
  decided_by: string
  decided_at: string | null
  created_at: string
}

type MaybeJoined<T> = T | T[] | null | undefined
type CandidateHeader = {
  id: string
  metric_id: string
  extracted_value: number | null
  period_label: string | null
  currency: string | null
  status: string
  intel_metric_definition?: MaybeJoined<{
    display_name: string | null
    project_id: string | null
    domain: string | null
  }>
}

function firstJoined<T>(value: MaybeJoined<T>): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function clampLimit(value: string | null): number {
  const n = value == null ? NaN : parseInt(value, 10)
  if (!Number.isFinite(n)) return 40
  return Math.max(5, Math.min(100, n))
}

function internalError(context: string, err: unknown): NextResponse {
  console.error(`[intel/review/history] ${context}:`, err instanceof Error ? err.message : err)
  return NextResponse.json({ error: 'Error interno al cargar el historial.' }, { status: 500 })
}

export async function GET(request: NextRequest) {
  try {
    if (!(await requireUser())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    const limit = clampLimit(request.nextUrl.searchParams.get('limit'))
    const supabase = createApiClient()
    const warnings: string[] = []

    const [docEventsRes, metricDecisionsRes] = await Promise.all([
      supabase
        .from('rag_document_events')
        .select('id, document_id, action, field, old_value, new_value, actor, reason, created_at')
        .order('created_at', { ascending: false })
        .limit(limit),
      supabase
        .from('intel_review_decision')
        .select('id, candidate_id, decision, override_value, override_reason, decided_by, decided_at, created_at')
        .order('decided_at', { ascending: false, nullsFirst: false })
        .limit(limit),
    ])

    const docEvents = (docEventsRes.error ? [] : (docEventsRes.data ?? [])) as DocEventRow[]
    const metricDecisions = (metricDecisionsRes.error ? [] : (metricDecisionsRes.data ?? [])) as MetricDecisionRow[]
    if (docEventsRes.error) warnings.push('document_events_unavailable')
    if (metricDecisionsRes.error) warnings.push('metric_decisions_unavailable')

    const docIds = Array.from(new Set(docEvents.map(e => e.document_id)))
    const candidateIds = Array.from(new Set(metricDecisions.map(d => d.candidate_id)))

    const [docsRes, candidatesRes] = await Promise.all([
      docIds.length
        ? supabase.from('rag_documents').select('id, title, project_id, doc_type').in('id', docIds)
        : Promise.resolve({ data: [], error: null }),
      candidateIds.length
        ? supabase
          .from('intel_metric_candidate')
          .select(`
            id,
            metric_id,
            extracted_value,
            period_label,
            currency,
            status,
            intel_metric_definition!metric_id (
              display_name,
              project_id,
              domain
            )
          `)
          .in('id', candidateIds)
        : Promise.resolve({ data: [], error: null }),
    ])

    if (docsRes.error) warnings.push('document_headers_unavailable')
    if (candidatesRes.error) warnings.push('candidate_headers_unavailable')

    const docHeaders = (docsRes.data ?? []) as DocHeader[]
    const candidateHeaders = (candidatesRes.data ?? []) as CandidateHeader[]
    const docs = new Map(docHeaders.map(d => [d.id, d]))
    const candidates = new Map(candidateHeaders.map(c => [c.id, c]))

    const documentItems = docEvents.map(e => {
      const doc = docs.get(e.document_id)
      const field = e.field ? ` · ${e.field}` : ''
      const change = e.field ? `${e.old_value ?? '—'} → ${e.new_value ?? '—'}` : null
      return {
        id: `doc:${e.id}`,
        kind: 'document' as const,
        occurred_at: e.created_at,
        action: e.action,
        actor: e.actor,
        title: doc?.title ?? 'Documento',
        subtitle: `${doc?.project_id ?? '—'} · ${doc?.doc_type ?? '—'}${field}`,
        detail: change,
        reason: e.reason,
        href: `/admin/documents?doc=${encodeURIComponent(e.document_id)}`,
      }
    })

    const metricItems = metricDecisions.map(d => {
      const candidate = candidates.get(d.candidate_id)
      const metric = firstJoined(candidate?.intel_metric_definition)
      const value = candidate?.extracted_value == null
        ? null
        : `${candidate.currency ?? ''} ${Number(candidate.extracted_value).toLocaleString('en-US')}`.trim()
      return {
        id: `metric:${d.id}`,
        kind: 'metric' as const,
        occurred_at: d.decided_at ?? d.created_at,
        action: d.decision,
        actor: d.decided_by,
        title: metric?.display_name ?? candidate?.metric_id ?? 'Métrica candidata',
        subtitle: `${metric?.project_id ?? '—'} · ${metric?.domain ?? '—'}${candidate?.period_label ? ` · ${candidate.period_label}` : ''}`,
        detail: d.decision === 'override'
          ? `Valor corregido: ${d.override_value ?? '—'}`
          : value ? `Valor: ${value}` : null,
        reason: d.override_reason,
        href: `/admin/review`,
      }
    })

    const items = [...documentItems, ...metricItems]
      .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())
      .slice(0, limit)

    return NextResponse.json({ items, partial: warnings.length > 0, warnings })
  } catch (err: unknown) {
    return internalError('handler', err)
  }
}
