'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, AlertTriangle, TrendingUp, Calendar } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { cn, formatCompact, formatPercent, varianceColor, type RAGColor } from '@/lib/utils'
import { KPICard } from '@/components/shared/KPICard'
import { RagChip, projectAccent } from '@/components/shared/terminal'

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

const COVENANT_LABEL: Record<string, string> = {
  Satisfied: 'Cumplido',
  Partially: 'Parcial',
  'Partially Satisfied': 'Parcial',
}

function covenantBadge(status: string | null) {
  if (!status) return <span className="text-slate-400 text-xs">—</span>
  const rag: RAGColor =
    status === 'Satisfied' ? 'Green' :
    status === 'Partially' || status === 'Partially Satisfied' ? 'Amber' :
    'Red'
  return <RagChip status={rag} label={COVENANT_LABEL[status] || status} />
}

function statusLabel(code: string) {
  const map: Record<string, string> = { NS: 'No iniciado', IP: 'En curso', BL: 'Base', DL: 'Retrasado', CP: 'Completado', AT: 'En riesgo' }
  return map[code] || code
}

function riskStatusLabel(code: string) {
  const map: Record<string, string> = { Open: 'Abierto', Closed: 'Cerrado', IP: 'En curso', CP: 'Cerrado', NS: 'Abierto', Mitigating: 'En mitigación' }
  return map[code] || code
}

function SectionTitle({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between border-b border-slate-200 pb-1.5 mb-3">
      <h2 className="flex items-center gap-2 text-[11px] font-bold tracking-[0.15em] uppercase text-slate-500">
        {icon}
        {children}
      </h2>
    </div>
  )
}

function daysToDate(dateStr: string): number {
  const target = new Date(dateStr)
  const today = new Date()
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

export default function ProjectPage() {
  const params = useParams()
  const projectId = params.projectId as string
  const ccy = 'EUR'

  const [project, setProject] = useState<Project | null>(null)
  const [tasks, setTasks] = useState<TaskRow[]>([])
  const [capex, setCapex] = useState<CapExRow[]>([])
  const [funding, setFunding] = useState<FundingRow[]>([])
  const [risks, setRisks] = useState<RiskRow[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [loadError, setLoadError] = useState(false)

  async function load() {
    setLoading(true)
    setLoadError(false)
    setNotFound(false)
    try {
      const supabase = createClient()
      const [
        { data: projData, error: projError },
        { data: taskData, error: taskError },
        { data: capexData, error: capexError },
        { data: fundingData, error: fundingError },
        { data: riskData, error: riskError },
      ] = await Promise.all([
        supabase.from('dim_project').select('*').eq('project_id', projectId).single(),
        supabase.from('fct_task_snapshot').select('task_id, project_id, forecast_finish, percent_complete, status_code, blocked_flag, impact_days_on_opening, dim_task(task_name, criticality_level, opening_gate_flag)').eq('project_id', projectId),
        supabase.from('fct_capex_snapshot').select('project_id, period_end_date, budget_baseline, budget_approved_current, committed_amount, invoiced_amount, paid_amount, eac, dim_capex_category(category_name)').eq('project_id', projectId).order('period_end_date', { ascending: false }),
        supabase.from('fct_funding_snapshot').select('project_id, period_end_date, committed_amount, drawn_to_date, undrawn_available, covenant_overall_status, default_risk_flag, dim_funding_instrument(instrument_name, instrument_type, currency)').eq('project_id', projectId).order('period_end_date', { ascending: false }),
        supabase.from('fct_risk_snapshot').select('project_id, risk_title, severity_score, status_code, escalation_flag, dim_risk_category(category_name)').eq('project_id', projectId),
      ])

      // Distinguish an auth/RLS/transient failure (error present) from a genuine 404.
      // A real "not found" returns no error and null data; an RLS-deny / 401 surfaces an error.
      if (taskError || capexError || fundingError || riskError || (projError && projError.code !== 'PGRST116')) {
        throw projError || taskError || capexError || fundingError || riskError
      }

      if (!projData) { setNotFound(true); return }
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
    } catch (e) {
      console.error(e)
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  if (loading) return (
    <div className="flex h-64 flex-col items-center justify-center gap-3">
      <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
      <p className="font-mono text-xs text-slate-400">Cargando proyecto...</p>
    </div>
  )

  if (loadError) return (
    <div className="space-y-4">
      <Link href="/portfolio" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Volver al portfolio
      </Link>
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm space-y-4">
        <div className="flex justify-center">
          <AlertTriangle className="h-8 w-8 text-amber-500" />
        </div>
        <p className="text-slate-700 font-medium">No se pudo cargar el proyecto</p>
        <p className="text-sm text-slate-500">La sesión pudo expirar. Vuelve a intentarlo o inicia sesión de nuevo.</p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => { load() }}
            className="inline-flex items-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Reintentar
          </button>
          <a
            href="/login"
            className="inline-flex items-center rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Iniciar sesión
          </a>
        </div>
      </div>
    </div>
  )

  if (notFound || !project) return (
    <div className="space-y-4">
      <Link href="/portfolio" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Volver al portfolio
      </Link>
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-slate-500">Proyecto no encontrado: <span className="font-mono font-medium">{projectId}</span></p>
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
  const accent = projectAccent(project.project_id)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <Link href="/portfolio" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 mb-4">
          <ArrowLeft className="h-4 w-4" /> Volver al portfolio
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="rounded-[2px] px-1.5 py-0.5 font-mono text-[11px] font-bold text-white" style={{ backgroundColor: projectAccent(project.project_id) }}>
                {project.project_id}
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">{project.project_name}</h1>
              <RagChip status={project.status_rag} />
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide text-slate-700">
                {project.stage}
              </span>
            </div>
            <p className="mt-1 text-slate-500">{project.city}, {project.country}</p>
          </div>
          <div className="flex items-center gap-6">
            {project.opening_target && (
              <div className="text-right">
                <div className="flex items-center gap-1.5 text-slate-500 text-xs mb-0.5">
                  <Calendar className="h-3.5 w-3.5" /> Apertura objetivo
                </div>
                <p className="font-mono font-semibold tabular-nums text-slate-900">
                  {new Date(project.opening_target).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
            )}
            {project.stage === 'Construction' && daysToOpening !== null && (
              <div className={cn('rounded-lg border px-4 py-2 text-center',
                daysToOpening < 0 ? 'border-red-200 bg-red-50' : daysToOpening < 90 ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50'
              )}>
                <p className="font-mono text-3xl font-bold tabular-nums text-slate-900">{Math.abs(daysToOpening)}</p>
                <p className="text-xs text-slate-500">{daysToOpening < 0 ? 'días de retraso' : 'días a apertura'}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Section 1: Schedule Overview */}
      <section>
        <SectionTitle icon={<TrendingUp className="h-3.5 w-3.5 text-slate-400" />}>Resumen de planning</SectionTitle>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mb-6">
          <KPICard title="Tareas totales" value={totalTasks} subtitle="en seguimiento" />
          <KPICard
            title="En plazo %"
            value={formatPercent(onTrackPct)}
            subtitle={`${onTrackTasks} de ${totalTasks} tareas`}
            rag={onTrackPct >= 80 ? 'Green' : onTrackPct >= 60 ? 'Amber' : 'Red'}
          />
          <KPICard
            title="Bloqueadas"
            value={blockedCount}
            subtitle="tareas con bloqueos"
            rag={blockedCount === 0 ? 'Green' : blockedCount <= 3 ? 'Amber' : 'Red'}
          />
          <KPICard
            title="Desvío camino crítico"
            value={`${criticalSlip}d`}
            subtitle="impacto en apertura"
            rag={criticalSlip === 0 ? 'Green' : criticalSlip <= 14 ? 'Amber' : 'Red'}
          />
        </div>

        {gates.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">Gates de apertura L0</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left">
                    <th className="px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">Gate</th>
                    <th className="px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400 text-right">Forecast fin</th>
                    <th className="px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400 text-right">Avance %</th>
                    <th className="px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">Estado</th>
                    <th className="px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400 text-right">Desvío (días)</th>
                  </tr>
                </thead>
                <tbody>
                  {gates.map(t => (
                    <tr key={t.task_id} className="border-b border-slate-100 odd:bg-slate-50/30 hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {t.dim_task?.task_name || t.task_id}
                        {t.blocked_flag && <AlertTriangle className="inline h-3.5 w-3.5 text-red-500 ml-1.5" />}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-700">
                        {t.forecast_finish ? new Date(t.forecast_finish).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="h-2 w-16 rounded-full bg-slate-100 overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${Math.min(t.percent_complete, 100)}%`, backgroundColor: accent }} />
                          </div>
                          <span className="font-mono tabular-nums text-slate-700">{formatPercent(t.percent_complete)}</span>
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
                      <td className={cn('px-4 py-3 text-right font-mono tabular-nums',
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
        <SectionTitle>Resumen CAPEX</SectionTitle>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mb-6">
          <KPICard title="Presupuesto" value={formatCompact(budgetTotal, ccy)} subtitle="aprobado vigente" />
          <KPICard title="Comprometido" value={formatCompact(committedTotal, ccy)} subtitle={formatPercent(committedPct * 100) + ' del presupuesto'} />
          <KPICard title="Pagado a la fecha" value={formatCompact(paidTotal, ccy)} subtitle={formatPercent(paidPct * 100) + ' ejecutado'} />
          <KPICard
            title="EAC"
            value={formatCompact(eacTotal, ccy)}
            subtitle={`Desviación: ${eacVariance > 0 ? '+' : ''}${formatPercent(eacVariance * 100)}`}
            rag={eacVariance > 0.05 ? 'Red' : eacVariance > 0.02 ? 'Amber' : 'Green'}
          />
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <div>
            <div className="flex justify-between text-xs text-slate-500 mb-1">
              <span>Pagado / Presupuesto</span>
              <span className="font-mono tabular-nums">{formatPercent(paidPct * 100)}</span>
            </div>
            <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(paidPct * 100, 100)}%`, backgroundColor: accent }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs text-slate-500 mb-1">
              <span>Comprometido / Presupuesto</span>
              <span className="font-mono tabular-nums">{formatPercent(committedPct * 100)}</span>
            </div>
            <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full rounded-full transition-all opacity-50" style={{ width: `${Math.min(committedPct * 100, 100)}%`, backgroundColor: accent }} />
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Desviación EAC vs presupuesto: <span className={cn('font-semibold font-mono tabular-nums', varianceColor(eacVariance))}>
              {eacVariance > 0 ? '+' : ''}{formatPercent(eacVariance * 100)}
            </span>
          </p>
        </div>
      </section>

      {/* Section 3: Funding Status */}
      {funding.length > 0 && (
        <section>
          <SectionTitle>Estado de financiación</SectionTitle>
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left">
                    <th className="px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">Instrumento</th>
                    <th className="px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">Tipo</th>
                    <th className="px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400 text-right">Comprometido</th>
                    <th className="px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400 text-right">Dispuesto</th>
                    <th className="px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400 text-right">No dispuesto</th>
                    <th className="px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">Covenant</th>
                  </tr>
                </thead>
                <tbody>
                  {funding.map((row, i) => (
                    <tr key={i} className="border-b border-slate-100 odd:bg-slate-50/30 hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {row.dim_funding_instrument?.instrument_name || '—'}
                        {row.default_risk_flag && (
                          <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-red-100 px-1.5 py-0.5 text-xs text-red-700">
                            <AlertTriangle className="h-3 w-3" /> Riesgo de impago
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[10px] tracking-wide text-slate-700">
                          {row.dim_funding_instrument?.instrument_type || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums">{formatCompact(row.committed_amount || 0, ccy)}</td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums">{formatCompact(row.drawn_to_date || 0, ccy)}</td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums">{formatCompact(row.undrawn_available || 0, ccy)}</td>
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
          <SectionTitle icon={<AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}>Riesgos principales</SectionTitle>
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left">
                    <th className="px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">Título</th>
                    <th className="px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">Categoría</th>
                    <th className="px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400 text-right">Severidad</th>
                    <th className="px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {risks.map((r, i) => (
                    <tr key={i} className="border-b border-slate-100 odd:bg-slate-50/30 hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {r.risk_title}
                        {r.escalation_flag && (
                          <span className="ml-2 inline-flex items-center rounded-full bg-red-100 px-1.5 py-0.5 text-xs text-red-700">Escalado</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{r.dim_risk_category?.category_name || '—'}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={cn('font-mono font-semibold tabular-nums',
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
                          {riskStatusLabel(r.status_code)}
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
