'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { cn, formatCompact } from '@/lib/utils'
import {
  FileText, ChevronDown, ChevronUp, AlertTriangle,
  CheckCircle, Clock, ArrowLeft, BookOpen,
  GitMerge, CircleDot, Ban, Hourglass, Link2
} from 'lucide-react'
import Link from 'next/link'

// ─── Types ────────────────────────────────────────────────────────────────────

type Pack = {
  pack_id: string
  project_id: string
  area: string
  status: string
  completeness_score: number
  freshness_score: number
  submitted_at: string | null
  due_at: string | null
  notes: string | null
  is_critical: boolean
}

type Candidate = {
  id: string
  metric_id: string
  extracted_value: number | null
  extracted_text: string | null
  period_label: string | null
  period_date: string | null
  currency: string
  confidence: number
  authority_score: number | null
  status: string
  validation_notes: ValidationNotes
  context_snippet: string | null
  intel_metric_definition: {
    display_name: string
    domain: string
    unit: string
  } | null
  rag_documents: {
    title: string | null
    doc_type: string | null
    source_file: string | null
    project_id?: string | null
    dms_path?: string | null
    authority?: number | null
  } | null
}

type ValidationNotes = string | Array<{ code?: string; message?: string } | string> | null

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DOMAIN_LABELS: Record<string, string> = {
  capex:    'CapEx & Budget',
  funding:  'Funding & Facility',
  cash:     'Cash Position',
  cash_flow:'Cash Flow',
  revenue:  'Revenue & Commercial',
  covenant: 'Covenants',
}

const DOMAIN_ORDER = ['capex', 'funding', 'cash', 'cash_flow', 'revenue', 'covenant']

const STATUS_STYLES: Record<string, string> = {
  accepted:          'bg-green-50 text-green-700 border-green-200',
  rejected:          'bg-red-50 text-red-600 border-red-200',
  pending_review:    'bg-amber-50 text-amber-700 border-amber-200',
  validation_failed: 'bg-slate-100 text-slate-500 border-slate-200',
}

function confBar(confidence: number) {
  const pct = Math.round(confidence * 100)
  const color = confidence >= 0.85 ? 'bg-green-500' : confidence >= 0.7 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <div className="h-1.5 w-16 rounded-full bg-slate-200">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums text-slate-500">{pct}%</span>
    </div>
  )
}

function AuthBadge({ score }: { score: number | null }) {
  if (score == null) return null
  const label = score >= 90 ? 'Ejecutado' : score >= 80 ? 'Controlling' : score >= 70 ? 'Board' : score >= 60 ? 'DD Memo' : 'Interno'
  const color = score >= 80 ? 'text-green-700 bg-green-50' : score >= 60 ? 'text-amber-700 bg-amber-50' : 'text-slate-600 bg-slate-100'
  return (
    <span className={cn('rounded px-1.5 py-0.5 text-xs font-medium shrink-0', color)}>
      {label} {score}
    </span>
  )
}

function isProvisional(c: Candidate) {
  return validationNotesText(c.validation_notes).toLowerCase().includes('provisional') || c.confidence < 0.75
}

function validationNotesText(notes: ValidationNotes) {
  if (Array.isArray(notes)) {
    return notes
      .map(note => typeof note === 'string' ? note : note.message || note.code || '')
      .filter(Boolean)
      .join('; ')
  }
  return notes || ''
}

function fmtValue(c: Candidate) {
  const v = c.extracted_value
  if (v == null) return '—'
  const unit = c.intel_metric_definition?.unit || c.currency
  if (unit === 'EUR' || unit === '€') return formatCompact(v, 'EUR')
  if (unit === 'GBP' || unit === '£') return formatCompact(v, 'GBP')
  if (unit === '%') return `${v.toFixed(1)}%`
  return v.toLocaleString('es-ES')
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
}

function sourceLabel(doc: Candidate['rag_documents']) {
  if (!doc) return null
  return doc.title || doc.source_file?.split('/').pop() || 'Fuente desconocida'
}

// ─── Evidence Row ─────────────────────────────────────────────────────────────

function MetricRow({ candidate, index }: { candidate: Candidate; index: number }) {
  const [open, setOpen] = useState(false)
  const def = candidate.intel_metric_definition
  const doc = candidate.rag_documents
  const prov = isProvisional(candidate)
  const isAccepted = candidate.status === 'accepted'

  const evidence = candidate.extracted_text || candidate.context_snippet

  return (
    <>
      <tr className={cn(
        'border-b transition-colors',
        !isAccepted && 'opacity-50',
        open && 'bg-slate-50'
      )}>
        {/* # */}
        <td className="py-3 pl-4 pr-2 text-xs text-slate-400 tabular-nums w-8">{index + 1}</td>

        {/* Metric name */}
        <td className="py-3 pr-4">
          <p className="text-sm font-medium text-slate-900">{def?.display_name || candidate.metric_id}</p>
          <p className="text-xs text-slate-400 font-mono">{candidate.metric_id}</p>
        </td>

        {/* Value */}
        <td className="py-3 pr-4 text-right">
          <p className={cn(
            'text-lg font-bold tabular-nums',
            prov ? 'text-amber-600' : 'text-slate-900'
          )}>
            {fmtValue(candidate)}
          </p>
          <p className="text-xs text-slate-500">{candidate.period_label || candidate.period_date?.slice(0, 7) || '—'}</p>
        </td>

        {/* Status badge */}
        <td className="py-3 pr-4">
          {prov ? (
            <span className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs font-medium bg-amber-50 text-amber-700 border-amber-200">
              <AlertTriangle className="h-3 w-3" /> Provisional
            </span>
          ) : isAccepted ? (
            <span className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs font-medium bg-green-50 text-green-700 border-green-200">
              <CheckCircle className="h-3 w-3" /> Aceptado
            </span>
          ) : (
            <span className={cn('rounded border px-1.5 py-0.5 text-xs', STATUS_STYLES[candidate.status] || 'bg-slate-100 text-slate-500 border-slate-200')}>
              {candidate.status}
            </span>
          )}
        </td>

        {/* Confidence */}
        <td className="py-3 pr-4">{confBar(candidate.confidence)}</td>

        {/* Authority */}
        <td className="py-3 pr-4"><AuthBadge score={candidate.authority_score} /></td>

        {/* Source */}
        <td className="py-3 pr-4 max-w-[180px]">
          {doc && (
            <div className="flex items-start gap-1.5 text-xs text-slate-600">
              <FileText className="h-3.5 w-3.5 shrink-0 mt-0.5 text-slate-400" />
              <span className="truncate">{sourceLabel(doc)}</span>
            </div>
          )}
          {doc?.doc_type && (
            <span className="mt-0.5 inline-block rounded bg-slate-100 px-1 py-0.5 text-xs text-slate-500">
              {doc.doc_type}
            </span>
          )}
        </td>

        {/* Evidence toggle */}
        <td className="py-3 pl-2 pr-4 text-right">
          {evidence && (
            <button
              onClick={() => setOpen(o => !o)}
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            >
              <BookOpen className="h-3.5 w-3.5" />
              {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
          )}
        </td>
      </tr>

      {/* Evidence panel */}
      {open && evidence && (
        <tr className="bg-slate-50 border-b">
          <td colSpan={8} className="px-4 pb-3 pt-0">
            <div className="ml-8 space-y-2">
              {/* Context (model reasoning) */}
              {candidate.context_snippet && (
                <div className="rounded bg-blue-50 border border-blue-100 p-2.5">
                  <p className="text-xs font-medium text-blue-700 mb-1">Razonamiento de extracción</p>
                  <p className="text-xs text-blue-800 leading-relaxed">{candidate.context_snippet}</p>
                </div>
              )}
              {/* Raw evidence */}
              {candidate.extracted_text && (
                <div className="rounded bg-slate-100 border-l-4 border-slate-300 p-2.5">
                  <p className="text-xs font-medium text-slate-600 mb-1">Texto fuente</p>
                  <p className="text-xs text-slate-700 font-mono leading-relaxed break-all whitespace-pre-wrap line-clamp-6">
                    {candidate.extracted_text}
                  </p>
                </div>
              )}
              {/* Notes */}
              {candidate.validation_notes && (
                <p className="text-xs text-slate-500 italic">{validationNotesText(candidate.validation_notes)}</p>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ─── Reconciliation types ─────────────────────────────────────────────────────

type Contradiction = {
  id: string
  metric_id: string
  value_a: number
  value_b: number
  delta_pct: number
  severity: string
  resolution_note: string | null
  period_label: string | null
}

type MissingMetric = {
  id: string
  display_name: string
  domain: string
}

type Publication = {
  metric_id: string
  target_table: string
  target_column: string
  published_value: number
  published_at: string
}

type Reconciliation = {
  contradictions: Contradiction[]
  provisional: Candidate[]
  missing_metrics: MissingMetric[]
  stale: Candidate[]
  publications: Publication[]
  summary: {
    total_items: number
    contradictions_open: number
    provisional_count: number
    missing_count: number
    stale_count: number
    published_count: number
  }
}

// ─── Reconciliation Panel ─────────────────────────────────────────────────────

const SEV_STYLES: Record<string, string> = {
  high:   'border-red-400 bg-red-50 text-red-800',
  medium: 'border-amber-400 bg-amber-50 text-amber-800',
  low:    'border-slate-300 bg-slate-50 text-slate-700',
}

const SEV_DOT: Record<string, string> = {
  high: 'bg-red-500', medium: 'bg-amber-500', low: 'bg-slate-400',
}

function ReconciliationPanel({ rec }: { rec: Reconciliation }) {
  const [open, setOpen] = useState(true)
  const [now] = useState(() => Date.now())
  const { summary } = rec
  if (summary.total_items === 0 && summary.published_count > 0) return null

  return (
    <div className="rounded-lg border border-amber-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-amber-50 hover:bg-amber-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <GitMerge className="h-4 w-4 text-amber-600" />
          <span className="text-sm font-semibold text-amber-900">
            Puntos de Reconciliación
          </span>
          {summary.total_items > 0 && (
            <span className="rounded-full bg-amber-200 px-2 py-0.5 text-xs font-medium text-amber-800">
              {summary.total_items}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4 text-xs text-amber-700">
          {summary.contradictions_open > 0 && (
            <span className="flex items-center gap-1"><AlertTriangle className="h-3 w-3" />{summary.contradictions_open} contradicciones</span>
          )}
          {summary.provisional_count > 0 && (
            <span className="flex items-center gap-1"><CircleDot className="h-3 w-3" />{summary.provisional_count} provisionales</span>
          )}
          {summary.missing_count > 0 && (
            <span className="flex items-center gap-1"><Ban className="h-3 w-3" />{summary.missing_count} sin datos</span>
          )}
          {summary.stale_count > 0 && (
            <span className="flex items-center gap-1"><Hourglass className="h-3 w-3" />{summary.stale_count} obsoletos</span>
          )}
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      {open && (
        <div className="divide-y">

          {/* Contradictions */}
          {rec.contradictions.length > 0 && (
            <div className="p-4">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-red-700">
                <AlertTriangle className="h-3.5 w-3.5" /> Contradicciones entre fuentes
              </p>
              <div className="space-y-2">
                {rec.contradictions.map(c => (
                  <div key={c.id} className={cn('rounded border-l-4 p-3', SEV_STYLES[c.severity] || SEV_STYLES.low)}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={cn('h-2 w-2 rounded-full shrink-0', SEV_DOT[c.severity] || SEV_DOT.low)} />
                          <p className="text-xs font-mono font-medium">{c.metric_id}</p>
                          {c.period_label && <span className="text-xs opacity-70">{c.period_label}</span>}
                        </div>
                        {c.resolution_note && (
                          <p className="mt-1 text-xs opacity-80 leading-relaxed">{c.resolution_note}</p>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xs font-mono">
                          {(c.value_a / 1e6).toFixed(2)}M vs {(c.value_b / 1e6).toFixed(2)}M
                        </p>
                        <p className="text-xs font-semibold">
                          Δ {(c.delta_pct * 100).toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Provisional */}
          {rec.provisional.length > 0 && (
            <div className="p-4">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-700">
                <CircleDot className="h-3.5 w-3.5" /> Valores provisionales (requieren confirmación)
              </p>
              <div className="space-y-1.5">
                {rec.provisional.map(c => {
                  const def = c.intel_metric_definition
                  return (
                    <div key={c.id} className="flex items-center justify-between rounded bg-amber-50 border border-amber-200 px-3 py-2">
                      <div>
                        <p className="text-xs font-medium text-slate-800">{def?.display_name || c.metric_id}</p>
                        <p className="text-xs text-slate-500">{validationNotesText(c.validation_notes)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-amber-700 tabular-nums">
                          {c.extracted_value != null ? formatCompact(c.extracted_value, c.currency === 'GBP' ? 'GBP' : 'EUR') : '—'}
                        </p>
                        <p className="text-xs text-slate-500">{c.period_label || '—'}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Missing metrics */}
          {rec.missing_metrics.length > 0 && (
            <div className="p-4">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600">
                <Ban className="h-3.5 w-3.5" /> Métricas sin evidencia documental
              </p>
              <div className="flex flex-wrap gap-2">
                {rec.missing_metrics.map(m => (
                  <span key={m.id} className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600">
                    <span className="font-mono">{m.id.replace(/^[A-Z]+\./,'')}</span>
                    <span className="ml-1 text-slate-400">({m.domain})</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Stale */}
          {rec.stale.length > 0 && (
            <div className="p-4">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600">
                <Hourglass className="h-3.5 w-3.5" /> Datos con antigüedad &gt;90 días
              </p>
              <div className="space-y-1.5">
                {rec.stale.map(c => {
                  const def = c.intel_metric_definition
                  const ageMonths = c.period_date
                    ? Math.round((now - new Date(c.period_date).getTime()) / (1000 * 3600 * 24 * 30))
                    : null
                  return (
                    <div key={c.id} className="flex items-center justify-between rounded bg-slate-50 border border-slate-200 px-3 py-2">
                      <div>
                        <p className="text-xs font-medium text-slate-700">{def?.display_name || c.metric_id}</p>
                        <p className="text-xs text-slate-500">Período: {c.period_label || c.period_date?.slice(0,7) || '—'}</p>
                      </div>
                      {ageMonths !== null && (
                        <span className="rounded bg-slate-200 px-2 py-0.5 text-xs text-slate-600 font-medium">
                          {ageMonths}m de antigüedad
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Publication trail */}
          {rec.publications.length > 0 && (
            <div className="p-4">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-green-700">
                <Link2 className="h-3.5 w-3.5" /> Publicaciones en fact tables ({rec.publications.length})
              </p>
              <div className="space-y-1">
                {rec.publications.map((p, i) => (
                  <div key={i} className="flex items-center gap-3 text-xs text-slate-600">
                    <CheckCircle className="h-3 w-3 text-green-500 shrink-0" />
                    <span className="font-mono">{p.metric_id.replace(/^[A-Z]+\./,'')}</span>
                    <span className="text-slate-400">→</span>
                    <span className="text-slate-500">{p.target_table}.{p.target_column}</span>
                    <span className="ml-auto tabular-nums text-slate-400">
                      {new Date(p.published_at).toLocaleDateString('es-ES', {day:'numeric',month:'short'})}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  )
}

// ─── Pack Header ──────────────────────────────────────────────────────────────

function PackHeader({ pack }: { pack: Pack }) {
  const statusColor = pack.status === 'submitted' ? 'text-blue-600 bg-blue-50' :
                      pack.status === 'published'  ? 'text-green-700 bg-green-50' :
                                                     'text-amber-700 bg-amber-50'
  return (
    <div className="rounded-lg border bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono text-slate-400">{pack.project_id}</span>
            <span className="text-slate-300">·</span>
            <span className="text-xs text-slate-500 capitalize">{pack.area}</span>
            {pack.is_critical && (
              <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700">Crítico</span>
            )}
          </div>
          <h1 className="text-xl font-bold text-slate-900">
            {pack.project_id} Finance Pack
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {pack.submitted_at ? `Enviado ${fmtDate(pack.submitted_at)}` : 'Borrador'} · Due {fmtDate(pack.due_at)}
          </p>
        </div>
        <span className={cn('rounded-full px-3 py-1 text-sm font-medium', statusColor)}>
          {pack.status}
        </span>
      </div>

      {/* Completeness bar */}
      <div className="mt-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-slate-500">Completeness</span>
          <span className="text-xs font-medium text-slate-700">{pack.completeness_score}%</span>
        </div>
        <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all', pack.completeness_score >= 80 ? 'bg-green-500' : pack.completeness_score >= 60 ? 'bg-amber-500' : 'bg-red-500')}
            style={{ width: `${pack.completeness_score}%` }}
          />
        </div>
      </div>

      {pack.notes && (
        <p className="mt-3 text-xs text-slate-500 italic border-t pt-3">{pack.notes}</p>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PackGroundingPage() {
  const params = useParams<{ id: string }>()
  const [pack, setPack] = useState<Pack | null>(null)
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [reconciliation, setReconciliation] = useState<Reconciliation | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/intel/packs/${params.id}`)
      if (!res.ok) {
        const d = await res.json()
        setError(d.error || 'Pack not found')
        setLoading(false)
        return
      }
      const data = await res.json()
      setPack(data.pack)
      setCandidates(data.candidates)
      setReconciliation(data.reconciliation ?? null)
      setLoading(false)
    }
    load()
  }, [params.id])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Clock className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    )
  }

  if (error || !pack) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3">
        <AlertTriangle className="h-8 w-8 text-red-400" />
        <p className="text-sm text-slate-600">{error || 'Pack no encontrado'}</p>
        <Link href="/admin/packs" className="text-sm text-blue-600 hover:underline">← Volver</Link>
      </div>
    )
  }

  // Group by domain/status
  const accepted  = candidates.filter(c => c.status === 'accepted')
  const rejected  = candidates.filter(c => c.status === 'rejected')
  const failed    = candidates.filter(c => c.status === 'validation_failed')
  const pending   = candidates.filter(c => c.status === 'pending_review')

  // Group accepted by domain
  const byDomain: Record<string, Candidate[]> = {}
  for (const c of accepted) {
    const d = c.intel_metric_definition?.domain || 'other'
    if (!byDomain[d]) byDomain[d] = []
    byDomain[d].push(c)
  }
  const orderedDomains = [
    ...DOMAIN_ORDER.filter(d => byDomain[d]),
    ...Object.keys(byDomain).filter(d => !DOMAIN_ORDER.includes(d)),
  ]

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link href="/admin/packs" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-3.5 w-3.5" /> Todos los packs
      </Link>

      {/* Pack header */}
      <PackHeader pack={pack} />

      {/* Summary counts */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Aceptados',  value: accepted.length,  color: 'text-green-600' },
          { label: 'Rechazados', value: rejected.length,  color: 'text-red-500' },
          { label: 'Fallidos',   value: failed.length,    color: 'text-slate-400' },
          { label: 'Pendientes', value: pending.length,   color: 'text-amber-600' },
        ].map(s => (
          <div key={s.label} className="rounded-lg border bg-white p-3 shadow-sm text-center">
            <p className={cn('text-2xl font-bold', s.color)}>{s.value}</p>
            <p className="text-xs text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Reconciliation panel */}
      {reconciliation && <ReconciliationPanel rec={reconciliation} />}

      {/* Accepted metrics with grounding — grouped by domain */}
      {orderedDomains.map(domain => (
        <div key={domain} className="rounded-lg border bg-white shadow-sm overflow-hidden">
          <div className="border-b bg-slate-50 px-4 py-2.5 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">
              {DOMAIN_LABELS[domain] || domain}
            </h2>
            <span className="text-xs text-slate-400">{byDomain[domain].length} métricas</span>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs text-slate-500 uppercase tracking-wide">
                <th className="py-2 pl-4 pr-2 text-left w-8">#</th>
                <th className="py-2 pr-4 text-left">Métrica</th>
                <th className="py-2 pr-4 text-right">Valor</th>
                <th className="py-2 pr-4 text-left">Estado</th>
                <th className="py-2 pr-4 text-left">Confianza</th>
                <th className="py-2 pr-4 text-left">Autoridad</th>
                <th className="py-2 pr-4 text-left">Fuente</th>
                <th className="py-2 pr-4 text-right">Evidencia</th>
              </tr>
            </thead>
            <tbody>
              {byDomain[domain].map((c, i) => (
                <MetricRow key={c.id} candidate={c} index={i} />
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {/* Rejected / failed — collapsed summary */}
      {(rejected.length > 0 || failed.length > 0) && (
        <details className="rounded-lg border bg-white shadow-sm">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50">
            Candidatos no aceptados ({rejected.length + failed.length})
          </summary>
          <table className="w-full text-sm border-t">
            <thead>
              <tr className="border-b text-xs text-slate-500 uppercase tracking-wide">
                <th className="py-2 pl-4 pr-4 text-left">Métrica</th>
                <th className="py-2 pr-4 text-left">Estado</th>
                <th className="py-2 pr-4 text-left">Notas</th>
              </tr>
            </thead>
            <tbody>
              {[...rejected, ...failed].map(c => (
                <tr key={c.id} className="border-b opacity-70">
                  <td className="py-2.5 pl-4 pr-4">
                    <p className="text-xs font-medium text-slate-700">{c.intel_metric_definition?.display_name || c.metric_id}</p>
                    <p className="text-xs text-slate-400 font-mono">{c.metric_id}</p>
                  </td>
                  <td className="py-2.5 pr-4">
                    <span className={cn('rounded border px-1.5 py-0.5 text-xs', STATUS_STYLES[c.status] || 'bg-slate-100 text-slate-500 border-slate-200')}>
                      {c.status}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4 text-xs text-slate-500">{validationNotesText(c.validation_notes) || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </div>
  )
}
