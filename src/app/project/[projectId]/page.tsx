'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, AlertTriangle, TrendingUp, Calendar } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { cn, formatCompact, formatPercent, varianceColor, type RAGColor } from '@/lib/utils'
import { KPICard } from '@/components/shared/KPICard'
import { RAGBadge } from '@/components/shared/RAGBadge'

type Project = {
  project_id: string
  project_name: string
  city: string
  country: string
  stage: string
  opening_baseline: string
  opening_target: string
  status_rag: RAGColor
  active: boolean
}

type TaskRow = {
  task_id: string
  project_id: string
  forecast_finish: string | null
  percent_complete: number
  status_code: string
  blocked_flag: boolean
  impact_days_on_opening: number | null
  dim_task: { task_name: string; criticality_level: string; opening_gate_flag: boolean } | null
}

type CapExRow = {
  project_id: string
  period_end_date: string
  budget_baseline: number
  budget_approved_current: number
  committed_amount: number
  invoiced_amount: number
  paid_amount: number
  eac: number
  dim_capex_category: { category_name: string } | null
}

type FundingRow = {
  id?: string
  project_id: string
  period_end_date: string
  committed_amount: number
  drawn_to_date: number
  undrawn_available: number
  covenant_overall_status: string | null
  default_risk_flag: boolean
  dim_funding_instrument: { instrument_name: string; instrument_type: string; currency: string } | null
}

type RiskRow = {
  risk_id?: string
  project_id: string
  risk_title: string
  severity_score: number
  status_code: string
  escalation_flag: boolean
  dim_risk_category: { category_name: string } | null
}

function covenantBadge(status: string | null) {
  if (!status) return <span className="text-slate-400 text-xs">—</span>
  const cls =
    status === 'Satisfied' ? 'bg-green-50 text-green-700' :
    status === 'Partially' || status === 'Partially Satisfied' ? 'bg-amber-50 text-amber-700' :
    'bg-red-50 text-red-700'
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{status}</span>
}

function statusLabel(code: string) {
  const map: Record<string, string> = { NS: 'Not Started', IP: 'In Progress', BL: 'Baseline', DL: 'Delayed', CP: 'Complete', AT: 'At Risk' }
  return map[code] || code
}

function daysToDate(dateStr: string): number {
  const target = new Date(dateStr)
  const today = new Date()
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

export default function ProjectPage() {
  const params = useParams()
  const projectId = params.projectId as string
  const ccy = projectId === 'BHX' ? 'GBP' : 'EUR'

  const [project, setProject] = useState<Project | null>(null)
  const [tasks, setTasks] = useState<TaskRow[]>([])
  const [capex, setCapex] = useState<CapExRow[]>([])
  const [funding, setFunding] = useState<FundingRow[]>([])
  const [risks, setRisks] = useState<RiskRow[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const [
        { data: projData },
        { data: taskData },
        { data: capexData },
        { data: fundingData },
        { data: riskData },
      ] = await Promise.all([
        supabase.from('dim_project').select('*').eq('project_id', projectId).single(),
        supabase.from('fct_task_snapshot').select('task_id, project_id, forecast_finish, percent_complete, status_code, blocked_flag, impact_days_on_opening, dim_task(task_name, criticality_level, opening_gate_flag)').eq('project_id', projectId),
        supabase.from('fct_capex_snapshot').select('project_id, period_end_date, budget_baseline, budget_approved_current, committed_amount, invoiced_amount, paid_amount, eac, dim_capex_category(category_name)').eq('project_id', projectId).order('period_end_date', { ascending: false }),
        supabase.from('fct_funding_snapshot').select('project_id, period_end_date, committed_amount, drawn_to_date, undrawn_available, covenant_overall_status, default_risk_flag, dim_funding_instrument(instrument_name, instrument_type, currency)').eq('project_id', projectId).order('period_end_date', { ascending: false }),
        supabase.from('fct_risk_snapshot').select('project_id, risk_title, severity_score, status_code, escalation_flag, dim_risk_category(category_name)').eq('project_id', projectId),
      ])

      if (!projData) { setNotFound(true); setLoading(false); return }
      setProject(projData)
      setTasks((taskData || []) as unknown as TaskRow[])

      // Latest capex: group by category, take first (most recent) per category
      const latestCapex: Record<string, CapExRow> = {}
      for (const row of (capexData || []) as unknown as CapExRow[]) {
        const key = row.dim_capex_category?.category_name || '__total'
        if (!latestCapex[key]) latestCapex[key] = row
      }
      setCapex(Object.values(latestCapex))

      // Latest funding: group by instrument, take first (most recent)
      const latestFunding: Record<string, FundingRow> = {}
      for (const row of (fundingData || []) as unknown as FundingRow[]) {
        const key = row.dim_funding_instrument?.instrument_name || String(Object.keys(latestFunding).length)
        if (!latestFunding[key]) latestFunding[key] = row
      }
      setFunding(Object.values(latestFunding))

      // Risks: top by severity or escalation
      const filteredRisks = ((riskData || []) as unknown as RiskRow[])
        .filter(r => r.severity_score >= 10 || r.escalation_flag)
        .sort((a, b) => b.severity_score - a.severity_score)
        .slice(0, 5)
      setRisks(filteredRisks)
      setLoading(false)
    }
    load()
  }, [projectId])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <p className="text-slate-400">Loading project...</p>
    </div>
  )

  if (notFound || !project) return (
    <div className="space-y-4">
      <Link href="/portfolio" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Back to Portfolio
      </Link>
      <div className="rounded-lg border bg-white p-8 text-center">
        <p className="text-slate-500">Project not found: <span className="font-mono font-medium">{projectId}</span></p>
      </div>
    </div>
  )

  // --- Schedule KPIs ---
  const totalTasks = tasks.length
  const onTrackTasks = tasks.filter(t => ['NS', 'IP'].includes(t.status_code) && !t.blocked_flag).length
  const onTrackPct = totalTasks > 0 ? (onTrackTasks / totalTasks) * 100 : 0
  const blockedCount = tasks.filter(t => t.blocked_flag).length
  const criticalSlip = tasks.filter(t => t.blocked_flag && t.impact_days_on_opening).reduce((s, t) => s + (t.impact_days_on_opening || 0), 0)

  // L0 gates
  const gates = tasks
    .filter(t => t.dim_task?.opening_gate_flag || t.dim_task?.criticality_level === 'L0')
    .sort((a, b) => {
      const da = a.forecast_finish ? new Date(a.forecast_finish).getTime() : Infinity
      const db = b.forecast_finish ? new Date(b.forecast_finish).getTime() : Infinity
      return da - db
    })

  // --- CapEx KPIs ---
  const budgetTotal = capex.reduce((s, r) => s + (r.budget_approved_current || r.budget_baseline || 0), 0)
  const committedTotal = capex.reduce((s, r) => s + (r.committed_amount || 0), 0)
  const paidTotal = capex.reduce((s, r) => s + (r.paid_amount || 0), 0)
  const eacTotal = capex.reduce((s, r) => s + (r.eac || 0), 0)
  const eacVariance = budgetTotal > 0 ? (eacTotal - budgetTotal) / budgetTotal : 0
  const paidPct = budgetTotal > 0 ? paidTotal / budgetTotal : 0
  const committedPct = budgetTotal > 0 ? committedTotal / budgetTotal : 0

  const daysToOpening = project.opening_target ? daysToDate(project.opening_target) : null

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <Link href="/portfolio" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 mb-4">
          <ArrowLeft className="h-4 w-4" /> Back to Portfolio
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl font-bold text-slate-900">{project.project_name}</h1>
              <RAGBadge status={project.status_rag} label={project.status_rag} />
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                {project.stage}
              </span>
            </div>
            <p className="mt-1 text-slate-500">{project.city}, {project.country}</p>
          </div>
          <div className="flex items-center gap-6">
            {project.opening_target && (
              <div className="text-right">
                <div className="flex items-center gap-1.5 text-slate-500 text-xs mb-0.5">
                  <Calendar className="h-3.5 w-3.5" /> Opening Target
                </div>
                <p className="font-semibold text-slate-900">
                  {new Date(project.opening_target).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
            )}
            {project.stage === 'Construction' && daysToOpening !== null && (
              <div className={cn('rounded-lg border px-4 py-2 text-center', daysToOpening < 0 ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50')}>
                <p className="text-2xl font-bold text-slate-900">{Math.abs(daysToOpening)}</p>
                <p className="text-xs text-slate-500">{daysToOpening < 0 ? 'days overdue' : 'days to opening'}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Section 1: Schedule Overview */}
      <section>
        <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-slate-400" /> Schedule Overview
        </h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mb-6">
          <KPICard title="Total Tasks" value={totalTasks} subtitle="tracked in schedule" />
          <KPICard
            title="On Track %"
            value={formatPercent(onTrackPct)}
            subtitle={`${onTrackTasks} of ${totalTasks} tasks`}
            rag={onTrackPct >= 80 ? 'Green' : onTrackPct >= 60 ? 'Amber' : 'Red'}
          />
          <KPICard
            title="Blocked"
            value={blockedCount}
            subtitle="tasks with blockers"
            rag={blockedCount === 0 ? 'Green' : blockedCount <= 3 ? 'Amber' : 'Red'}
          />
          <KPICard
            title="Critical Path Slip"
            value={`${criticalSlip}d`}
            subtitle="impact on opening"
            rag={criticalSlip === 0 ? 'Green' : criticalSlip <= 14 ? 'Amber' : 'Red'}
          />
        </div>

        {gates.length > 0 && (
          <div className="rounded-lg border bg-white overflow-hidden">
            <div className="px-6 py-4 border-b">
              <h3 className="text-sm font-medium text-slate-700">L0 Opening Gates</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-left">
                    <th className="px-4 py-3 font-medium text-slate-600">Gate</th>
                    <th className="px-4 py-3 font-medium text-slate-600 text-right">Forecast Finish</th>
                    <th className="px-4 py-3 font-medium text-slate-600 text-right">Complete %</th>
                    <th className="px-4 py-3 font-medium text-slate-600">Status</th>
                    <th className="px-4 py-3 font-medium text-slate-600 text-right">Slip (days)</th>
                  </tr>
                </thead>
                <tbody>
                  {gates.map(t => (
                    <tr key={t.task_id} className="border-b hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {t.dim_task?.task_name || t.task_id}
                        {t.blocked_flag && <AlertTriangle className="inline h-3.5 w-3.5 text-red-500 ml-1.5" />}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700">
                        {t.forecast_finish ? new Date(t.forecast_finish).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="h-2 w-16 rounded-full bg-slate-100 overflow-hidden">
                            <div className="h-full bg-blue-500" style={{ width: `${Math.min(t.percent_complete, 100)}%` }} />
                          </div>
                          <span className="font-mono text-slate-700">{formatPercent(t.percent_complete)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                          t.status_code === 'CP' ? 'bg-green-50 text-green-700' :
                          t.status_code === 'DL' ? 'bg-red-50 text-red-700' :
                          t.status_code === 'AT' ? 'bg-amber-50 text-amber-700' :
                          'bg-slate-50 text-slate-600'
                        )}>
                          {statusLabel(t.status_code)}
                        </span>
                      </td>
                      <td className={cn('px-4 py-3 text-right font-mono',
                        (t.impact_days_on_opening || 0) > 0 ? 'text-red-600 font-medium' : 'text-slate-400'
                      )}>
                        {t.impact_days_on_opening ? `+${t.impact_days_on_opening}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* Section 2: CapEx Summary */}
      <section>
        <h2 className="text-lg font-semibold text-slate-800 mb-4">CapEx Summary</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mb-6">
          <KPICard title="Budget" value={formatCompact(budgetTotal, ccy)} subtitle="approved current" />
          <KPICard title="Committed" value={formatCompact(committedTotal, ccy)} subtitle={formatPercent(committedPct * 100) + ' of budget'} />
          <KPICard title="Paid to Date" value={formatCompact(paidTotal, ccy)} subtitle={formatPercent(paidPct * 100) + ' executed'} />
          <KPICard
            title="EAC"
            value={formatCompact(eacTotal, ccy)}
            subtitle={`Variance: ${eacVariance > 0 ? '+' : ''}${formatPercent(eacVariance * 100)}`}
            rag={eacVariance > 0.05 ? 'Red' : eacVariance > 0.02 ? 'Amber' : 'Green'}
          />
        </div>
        <div className="rounded-lg border bg-white p-6 space-y-4">
          <div>
            <div className="flex justify-between text-xs text-slate-500 mb-1">
              <span>Paid / Budget</span>
              <span className="font-mono">{formatPercent(paidPct * 100)}</span>
            </div>
            <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${Math.min(paidPct * 100, 100)}%` }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs text-slate-500 mb-1">
              <span>Committed / Budget</span>
              <span className="font-mono">{formatPercent(committedPct * 100)}</span>
            </div>
            <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full bg-blue-400 rounded-full transition-all" style={{ width: `${Math.min(committedPct * 100, 100)}%` }} />
            </div>
          </div>
          <p className="text-xs text-slate-500">
            EAC vs Budget variance: <span className={cn('font-semibold font-mono', varianceColor(eacVariance))}>
              {eacVariance > 0 ? '+' : ''}{formatPercent(eacVariance * 100)}
            </span>
          </p>
        </div>
      </section>

      {/* Section 3: Funding Status */}
      {funding.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Funding Status</h2>
          <div className="rounded-lg border bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-left">
                    <th className="px-4 py-3 font-medium text-slate-600">Instrument</th>
                    <th className="px-4 py-3 font-medium text-slate-600">Type</th>
                    <th className="px-4 py-3 font-medium text-slate-600 text-right">Committed</th>
                    <th className="px-4 py-3 font-medium text-slate-600 text-right">Drawn</th>
                    <th className="px-4 py-3 font-medium text-slate-600 text-right">Undrawn</th>
                    <th className="px-4 py-3 font-medium text-slate-600">Covenant</th>
                  </tr>
                </thead>
                <tbody>
                  {funding.map((row, i) => (
                    <tr key={i} className="border-b hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {row.dim_funding_instrument?.instrument_name || '—'}
                        {row.default_risk_flag && (
                          <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-red-100 px-1.5 py-0.5 text-xs text-red-700">
                            <AlertTriangle className="h-3 w-3" /> Default Risk
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                          {row.dim_funding_instrument?.instrument_type || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono">{formatCompact(row.committed_amount || 0, ccy)}</td>
                      <td className="px-4 py-3 text-right font-mono">{formatCompact(row.drawn_to_date || 0, ccy)}</td>
                      <td className="px-4 py-3 text-right font-mono">{formatCompact(row.undrawn_available || 0, ccy)}</td>
                      <td className="px-4 py-3">{covenantBadge(row.covenant_overall_status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* Section 4: Top Risks */}
      {risks.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-400" /> Top Risks
          </h2>
          <div className="rounded-lg border bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-left">
                    <th className="px-4 py-3 font-medium text-slate-600">Title</th>
                    <th className="px-4 py-3 font-medium text-slate-600">Category</th>
                    <th className="px-4 py-3 font-medium text-slate-600 text-right">Severity</th>
                    <th className="px-4 py-3 font-medium text-slate-600">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {risks.map((r, i) => (
                    <tr key={i} className="border-b hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {r.risk_title}
                        {r.escalation_flag && (
                          <span className="ml-2 inline-flex items-center rounded-full bg-red-100 px-1.5 py-0.5 text-xs text-red-700">Escalated</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{r.dim_risk_category?.category_name || '—'}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={cn('font-mono font-semibold',
                          r.severity_score >= 20 ? 'text-red-600' :
                          r.severity_score >= 12 ? 'text-amber-600' :
                          'text-slate-600'
                        )}>
                          {r.severity_score}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                          r.status_code === 'CP' || r.status_code === 'Closed' ? 'bg-green-50 text-green-700' :
                          r.status_code === 'Open' || r.status_code === 'IP' ? 'bg-amber-50 text-amber-700' :
                          'bg-slate-50 text-slate-600'
                        )}>
                          {r.status_code}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
