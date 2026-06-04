'use client'
import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { cn, formatCompact } from '@/lib/utils'
import {
  CheckCircle, XCircle, AlertTriangle, Clock, RefreshCw,
  ChevronDown, ChevronUp, FileText, Zap, Filter
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────

type ValidationNote = {
  code?: string
  message?: string
}

type Contradiction = {
  id: string
  metric_name?: string | null
  project_id?: string | null
  period_label?: string | null
  severity: string
  value_a?: number | null
  value_b?: number | null
  delta_pct?: number | null
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
  context_snippet: string | null
  authority_score: number | null
  status: string
  validation_status: string | null
  validation_notes: ValidationNote[] | null
  created_at: string
  intel_metric_definition: {
    display_name: string
    domain: string
    project_id: string
    unit: string
    target_table: string
    target_column: string
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

type Stats = {
  totals: {
    pending_review: number
    auto_accepted: number
    accepted: number
    rejected: number
    validation_failed: number
    total: number
  }
  contradictions: Contradiction[]
  latest_run: {
    status: string
    started_at: string
    completed_at: string | null
    candidates_created: number
    documents_scanned: number
  } | null
}

type StatusFilter = 'pending_review' | 'auto_accepted' | 'accepted' | 'rejected' | 'all'

// ─── Helpers ──────────────────────────────────────────────────────────────

const DOMAIN_LABELS: Record<string, string> = {
  capex: 'CapEx',
  cash_flow: 'Cash Flow',
  funding: 'Funding',
  commercial: 'Commercial',
  covenant: 'Covenants',
  risk: 'Risk',
  general: 'General',
}

const STATUS_CONFIG = {
  pending_review:  { label: 'Pending Review',  color: 'bg-amber-100 text-amber-800',  dot: 'bg-amber-500' },
  auto_accepted:   { label: 'Auto-Accepted',   color: 'bg-blue-100 text-blue-800',    dot: 'bg-blue-500' },
  accepted:        { label: 'Accepted',         color: 'bg-green-100 text-green-800',  dot: 'bg-green-500' },
  rejected:        { label: 'Rejected',         color: 'bg-red-100 text-red-800',      dot: 'bg-red-500' },
  validation_failed: { label: 'Failed',         color: 'bg-slate-100 text-slate-600',  dot: 'bg-slate-400' },
} as Record<string, { label: string; color: string; dot: string }>

function confidenceBar(confidence: number) {
  const pct = Math.round(confidence * 100)
  const color = confidence >= 0.8 ? 'bg-green-500' : confidence >= 0.6 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 rounded-full bg-slate-200">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-slate-500">{pct}%</span>
    </div>
  )
}

function authorityBadge(score: number | null) {
  if (score == null) return null
  const label = score >= 90 ? 'Executed' : score >= 80 ? 'Controller' : score >= 70 ? 'Board Pack' : score >= 60 ? 'DD Memo' : score >= 40 ? 'Internal' : 'Narrative'
  const color = score >= 80 ? 'text-green-700 bg-green-50' : score >= 60 ? 'text-amber-700 bg-amber-50' : 'text-slate-600 bg-slate-100'
  return (
    <span className={cn('rounded px-1.5 py-0.5 text-xs font-medium', color)}>
      Auth {score} · {label}
    </span>
  )
}

// ─── Candidate Card ───────────────────────────────────────────────────────

function CandidateCard({
  candidate,
  onDecision,
}: {
  candidate: Candidate
  onDecision: (id: string, decision: string, overrideValue?: number, overrideReason?: string) => Promise<void>
}) {
  const [expanded, setExpanded] = useState(false)
  const [overrideMode, setOverrideMode] = useState(false)
  const [overrideInput, setOverrideInput] = useState('')
  const [overrideReason, setOverrideReason] = useState('')
  const [loading, setLoading] = useState(false)

  const metric = candidate.intel_metric_definition
  const doc = candidate.rag_documents
  const statusCfg = STATUS_CONFIG[candidate.status] || STATUS_CONFIG.pending_review

  async function handle(decision: string) {
    setLoading(true)
    try {
      const overrideVal = decision === 'override' ? parseFloat(overrideInput) : undefined
      await onDecision(candidate.id, decision, overrideVal, overrideReason || undefined)
    } finally {
      setLoading(false)
      setOverrideMode(false)
    }
  }

  const valueFormatted = candidate.extracted_value != null
    ? formatCompact(candidate.extracted_value, candidate.currency === 'GBP' ? 'GBP' : 'EUR')
    : '—'

  const isReviewable = ['pending_review', 'auto_accepted', 'validation_failed'].includes(candidate.status)

  return (
    <div className={cn(
      'rounded-lg border bg-white p-4 shadow-sm transition-shadow hover:shadow-md',
      candidate.status === 'validation_failed' && 'border-slate-300 opacity-70',
      candidate.status === 'auto_accepted' && 'border-blue-200 bg-blue-50/30'
    )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', statusCfg.color)}>
              <span className={cn('h-1.5 w-1.5 rounded-full', statusCfg.dot)} />
              {statusCfg.label}
            </span>
            {candidate.status === 'auto_accepted' && (
              <span className="flex items-center gap-1 text-xs text-blue-600">
                <Zap className="h-3 w-3" /> Auto
              </span>
            )}
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
              {DOMAIN_LABELS[metric?.domain || ''] || metric?.domain}
            </span>
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-mono text-slate-600">
              {metric?.project_id}
            </span>
          </div>
          <p className="mt-1 text-sm font-semibold text-slate-900 truncate">
            {metric?.display_name || candidate.metric_id}
          </p>
          <p className="text-xs text-slate-500 truncate">{candidate.metric_id}</p>
        </div>

        {/* Value */}
        <div className="shrink-0 text-right">
          <p className="text-2xl font-bold text-slate-900">{valueFormatted}</p>
          <p className="text-xs text-slate-500">{candidate.period_label || '—'}</p>
        </div>
      </div>

      {/* Quality row */}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-500">Confidence</span>
          {confidenceBar(candidate.confidence)}
        </div>
        {authorityBadge(candidate.authority_score)}
        {candidate.validation_notes?.length && (
          <span className="flex items-center gap-1 text-xs text-amber-700">
            <AlertTriangle className="h-3 w-3" />
            {candidate.validation_notes.length} warning{candidate.validation_notes.length > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Source */}
      {doc && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
          <FileText className="h-3 w-3 shrink-0" />
          <span className="truncate">{doc.title || doc.source_file || 'Unknown source'}</span>
          {doc.doc_type && (
            <span className="ml-1 rounded bg-slate-100 px-1 py-0.5 text-xs">{doc.doc_type}</span>
          )}
        </div>
      )}

      {/* Expandable evidence */}
      {(candidate.extracted_text || candidate.context_snippet) && (
        <div className="mt-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600"
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            Evidence quote
          </button>
          {expanded && (
            <div className="mt-2 rounded bg-slate-50 p-2 text-xs text-slate-600 italic border-l-2 border-slate-300">
              {candidate.extracted_text || candidate.context_snippet}
            </div>
          )}
        </div>
      )}

      {/* Validation warnings */}
      {expanded && candidate.validation_notes?.length && (
        <div className="mt-2 space-y-1">
          {candidate.validation_notes.map((n, i) => (
            <div key={i} className="flex items-start gap-1.5 rounded bg-amber-50 p-2 text-xs text-amber-800">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
              <span>[{n.code || 'note'}] {n.message || String(n)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Override input */}
      {overrideMode && (
        <div className="mt-3 space-y-2 rounded-lg bg-slate-50 p-3">
          <p className="text-xs font-medium text-slate-700">Override value ({candidate.currency})</p>
          <input
            type="number"
            value={overrideInput}
            onChange={e => setOverrideInput(e.target.value)}
            placeholder={candidate.extracted_value?.toString() || '0'}
            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          />
          <input
            type="text"
            value={overrideReason}
            onChange={e => setOverrideReason(e.target.value)}
            placeholder="Reason for override (optional)"
            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          />
          <div className="flex gap-2">
            <button
              onClick={() => handle('override')}
              disabled={!overrideInput || loading}
              className="flex-1 rounded bg-slate-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              Confirm override
            </button>
            <button
              onClick={() => setOverrideMode(false)}
              className="rounded px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Actions */}
      {isReviewable && !overrideMode && (
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => handle('accept')}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            <CheckCircle className="h-3.5 w-3.5" />
            Accept
          </button>
          <button
            onClick={() => handle('reject')}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            <XCircle className="h-3.5 w-3.5" />
            Reject
          </button>
          <button
            onClick={() => setOverrideMode(true)}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Override
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Stats Bar ────────────────────────────────────────────────────────────

function StatsBar({ stats }: { stats: Stats }) {
  const { totals, contradictions } = stats

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {[
        { label: 'Pending Review', value: totals.pending_review, color: 'text-amber-600' },
        { label: 'Auto-Accepted', value: totals.auto_accepted,  color: 'text-blue-600' },
        { label: 'Accepted',       value: totals.accepted,       color: 'text-green-600' },
        { label: 'Rejected',       value: totals.rejected,       color: 'text-red-600' },
        { label: 'Failed',         value: totals.validation_failed, color: 'text-slate-500' },
        { label: 'Contradictions', value: contradictions.length,    color: contradictions.length > 0 ? 'text-red-600' : 'text-slate-500' },
      ].map(s => (
        <div key={s.label} className="rounded-lg border bg-white p-3 shadow-sm">
          <p className={cn('text-2xl font-bold', s.color)}>{s.value}</p>
          <p className="text-xs text-slate-500">{s.label}</p>
        </div>
      ))}
    </div>
  )
}

// ─── Contradictions Panel ─────────────────────────────────────────────────

function ContradictionsPanel({ contradictions }: { contradictions: Contradiction[] }) {
  if (!contradictions.length) return null

  const severityColor: Record<string, string> = {
    critical: 'border-red-400 bg-red-50',
    high: 'border-orange-400 bg-orange-50',
    medium: 'border-amber-300 bg-amber-50',
    low: 'border-slate-300 bg-slate-50',
  }

  return (
    <div className="rounded-lg border border-red-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-red-500" />
        <h3 className="text-sm font-semibold text-slate-900">Open Contradictions ({contradictions.length})</h3>
      </div>
      <div className="space-y-2">
        {contradictions.slice(0, 8).map(c => (
          <div key={c.id} className={cn('rounded border-l-4 p-2.5', severityColor[c.severity] || 'border-slate-300 bg-slate-50')}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-medium text-slate-900">{c.metric_name}</p>
                <p className="text-xs text-slate-600">{c.project_id} · {c.period_label}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xs font-mono text-slate-800">
                  {c.value_a?.toLocaleString()} vs {c.value_b?.toLocaleString()}
                </p>
                <p className="text-xs text-red-600">Δ {((c.delta_pct ?? 0) * 100).toFixed(1)}%</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────

export default function ReviewPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Filters
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending_review')
  const [projectFilter, setProjectFilter] = useState('all')
  const [domainFilter, setDomainFilter] = useState('all')

  const loadStats = useCallback(async () => {
    const res = await fetch('/api/intel/stats')
    if (res.ok) {
      const data = await res.json()
      setStats(data)
    }
  }, [])

  const loadCandidates = useCallback(async () => {
    const params = new URLSearchParams({
      status: statusFilter,
      project: projectFilter,
      domain: domainFilter,
      limit: '200',
    })
    const res = await fetch(`/api/intel/candidates?${params}`)
    if (res.ok) {
      const data = await res.json()
      setCandidates(data.candidates || [])
    }
  }, [statusFilter, projectFilter, domainFilter])

  const refresh = useCallback(async () => {
    setRefreshing(true)
    await Promise.all([loadStats(), loadCandidates()])
    setRefreshing(false)
  }, [loadStats, loadCandidates])

  useEffect(() => {
    async function init() {
      setLoading(true)
      await Promise.all([loadStats(), loadCandidates()])
      setLoading(false)
    }
    init()
  }, [loadStats, loadCandidates])

  async function handleDecision(
    candidateId: string,
    decision: string,
    overrideValue?: number,
    overrideReason?: string
  ) {
    const res = await fetch('/api/intel/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        candidate_id: candidateId,
        decision,
        override_value: overrideValue,
        override_reason: overrideReason,
      }),
    })

    if (res.ok) {
      const labels: Record<string, string> = {
        accept: 'Accepted ✓',
        reject: 'Rejected',
        override: 'Overridden ✓',
        defer: 'Deferred',
      }
      toast.success(labels[decision] || decision)
      // Remove from list immediately for responsive UX
      if (decision !== 'defer') {
        setCandidates(prev => prev.filter(c => c.id !== candidateId))
        loadStats() // Refresh counts
      }
    } else {
      const err = await res.json()
      toast.error(`Error: ${err.error}`)
    }
  }

  // Group candidates by domain
  const grouped = candidates.reduce<Record<string, Candidate[]>>((acc, c) => {
    const domain = c.intel_metric_definition?.domain || 'other'
    if (!acc[domain]) acc[domain] = []
    acc[domain].push(c)
    return acc
  }, {})

  const domains = Object.keys(grouped).sort()

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <RefreshCw className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Evidence Review</h1>
          <p className="text-sm text-slate-500">
            Layer 3 — Review extracted metric candidates before publishing to fact tables
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={refreshing}
          className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* Stats bar */}
      {stats && <StatsBar stats={stats} />}

      {/* Contradictions */}
      {stats?.contradictions?.length ? (
        <ContradictionsPanel contradictions={stats.contradictions} />
      ) : null}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-white p-3 shadow-sm">
        <Filter className="h-4 w-4 text-slate-400 shrink-0" />

        {/* Status tabs */}
        <div className="flex gap-1 rounded-md bg-slate-100 p-1">
          {(['pending_review', 'auto_accepted', 'accepted', 'rejected', 'all'] as StatusFilter[]).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                'rounded px-3 py-1 text-xs font-medium transition-colors',
                statusFilter === s
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-800'
              )}
            >
              {STATUS_CONFIG[s]?.label || 'All'}
              {stats && s !== 'all' && s in stats.totals && (
                <span className="ml-1 text-slate-400">
                  ({stats.totals[s as keyof typeof stats.totals]})
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="h-4 w-px bg-slate-200" />

        {/* Project filter */}
        <select
          value={projectFilter}
          onChange={e => setProjectFilter(e.target.value)}
          className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400"
        >
          <option value="all">All Projects</option>
          <option value="MAD">MAD — Madrid</option>
          <option value="BHX">BHX — Birmingham</option>
        </select>

        {/* Domain filter */}
        <select
          value={domainFilter}
          onChange={e => setDomainFilter(e.target.value)}
          className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400"
        >
          <option value="all">All Domains</option>
          {Object.entries(DOMAIN_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        <span className="ml-auto text-xs text-slate-500">
          {candidates.length} candidate{candidates.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Candidate grid */}
      {candidates.length === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-slate-300 bg-white">
          <Clock className="h-8 w-8 text-slate-300" />
          <p className="text-sm text-slate-500">
            {statusFilter === 'pending_review'
              ? 'No pending candidates — run the extraction engine to generate candidates'
              : 'No candidates match the current filter'}
          </p>
          {statusFilter === 'pending_review' && (
            <p className="text-xs text-slate-400 font-mono">
              node scripts/extraction-engine.mjs
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {domains.map(domain => (
            <div key={domain}>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700 uppercase tracking-wide">
                <span className="h-px flex-1 bg-slate-200" />
                <span>{DOMAIN_LABELS[domain] || domain}</span>
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-normal text-slate-600">
                  {grouped[domain].length}
                </span>
                <span className="h-px flex-1 bg-slate-200" />
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {grouped[domain].map(candidate => (
                  <CandidateCard
                    key={candidate.id}
                    candidate={candidate}
                    onDecision={handleDecision}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
