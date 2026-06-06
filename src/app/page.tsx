'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { getCapexSummary, getCashFlowSummary } from '@/lib/queries-financial'
import { cn, formatCompact, type RAGColor } from '@/lib/utils'
import { AlertTriangle, ArrowRight, CheckCircle, Clock } from 'lucide-react'

// ─── Helpers ──────────────────────────────────────────────────────────────

function isoWeek(d: Date): number {
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1))
  return Math.ceil((((tmp.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

function daysTo(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000)
}

function fmtDate(s: string | null | undefined): string {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

function slipColor(d: number): string {
  if (d < 0) return 'text-red-600 font-bold'
  if (d > 0) return 'text-green-600 font-bold'
  return 'text-slate-400'
}

const STATUS_RAG: Record<string, { bg: string; text: string; label: string }> = {
  Green: { bg: 'bg-[#DCFCE7]', text: 'text-[#14532D]', label: 'Green' },
  Amber: { bg: 'bg-[#FEF3C7]', text: 'text-[#78350F]', label: 'Amber' },
  Red:   { bg: 'bg-[#FEE2E2]', text: 'text-[#7F1D1D]', label: 'Red'   },
  Blue:  { bg: 'bg-[#DBEAFE]', text: 'text-[#1E3A8A]', label: 'Done'  },
  Grey:  { bg: 'bg-[#F1F5F9]', text: 'text-[#475569]', label: 'N/A'   },
}

const STATUS_DOT: Record<string, string> = {
  Green: 'bg-green-500', Amber: 'bg-amber-500',
  Red: 'bg-red-500', Blue: 'bg-blue-500', Grey: 'bg-slate-400',
}

const STATUS_CODE_RAG: Record<string, RAGColor> = {
  NS: 'Grey', IP: 'Amber', BL: 'Red', DL: 'Red', CP: 'Blue', AT: 'Amber', NA: 'Grey',
}

// Project visual identity
const PROJECT_ACCENT: Record<string, string> = {
  MAD: '#0B4A6F',
  BHX: '#166534',
}

// ─── Types ────────────────────────────────────────────────────────────────

type Project = {
  project_id: string; project_name: string; city: string
  stage: string; status_rag: RAGColor; opening_target: string
}
type CapexSum = Record<string, { budget: number; approved: number; committed: number; invoiced: number; paid: number; eac: number }>
type CashFlowSummary = Awaited<ReturnType<typeof getCashFlowSummary>>

type MaybeJoined<T> = T | T[] | null | undefined

type OwnerJoin = MaybeJoined<{
  full_name: string | null
}>

type DashboardTask = {
  id: string
  project_id: string
  task_id: string
  as_of_week_ending: string
  forecast_finish: string | null
  percent_complete: number | null
  status_code: string
  blocked_flag: boolean
  blocker_reason: string | null
  impact_days_on_opening: number | null
  dim_task?: MaybeJoined<{
    task_name: string | null
    criticality_level: string | null
    opening_gate_flag: boolean | null
    baseline_finish: string | null
  }>
}

type DashboardDecision = {
  id: string
  decision_id: string | null
  project_id: string
  decision_topic: string | null
  decision_text: string | null
  meeting_type: string | null
  implementation_due: string | null
  status_code: string
  dim_owner?: OwnerJoin
}

type DashboardAction = {
  id: string
  action_id: string | null
  project_id: string
  action_title: string | null
  due_date: string | null
  action_status_id: string
  dim_owner?: OwnerJoin
}

function firstJoined<T>(value: MaybeJoined<T>): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function ownerName(owner: OwnerJoin): string {
  return firstJoined(owner)?.full_name || 'Sin asignar'
}

// ─── Sub-components ───────────────────────────────────────────────────────

function SectionTitle({ children, hint, href }: { children: React.ReactNode; hint?: string; href?: string }) {
  return (
    <div className="flex items-baseline justify-between border-b border-slate-200 pb-1.5 mb-3">
      <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-slate-500">
        {children}
        {hint && <span className="ml-2 text-[11px] font-normal tracking-normal normal-case text-slate-400">{hint}</span>}
      </h3>
      {href && (
        <Link href={href} className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-700 transition-colors">
          Ver todo <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  )
}

function RagChip({ status }: { status: RAGColor }) {
  const s = STATUS_RAG[status] || STATUS_RAG.Grey
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-[2px] px-2 py-0.5 font-mono text-[10px] font-bold tracking-wide uppercase', s.bg, s.text)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT[status])} />
      {s.label}
    </span>
  )
}

function RagDot({ status }: { status: RAGColor }) {
  return <span className={cn('inline-block h-2 w-2 rounded-full', STATUS_DOT[status])} />
}

function ProgressBar({ pct, color = '#0B4A6F', thin = false }: { pct: number; color?: string; thin?: boolean }) {
  return (
    <div className={cn('w-full rounded-full bg-slate-100 overflow-hidden', thin ? 'h-1.5' : 'h-2.5')}>
      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(Math.max(pct, 0), 100)}%`, backgroundColor: color }} />
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────

export default function CEODashboard() {
  const [projects,  setProjects]  = useState<Project[]>([])
  const [capex,     setCapex]     = useState<CapexSum>({})
  const [cashFlow,  setCashFlow]  = useState<CashFlowSummary>({})
  const [tasks,     setTasks]     = useState<DashboardTask[]>([])
  const [decisions, setDecisions] = useState<DashboardDecision[]>([])
  const [actions,   setActions]   = useState<DashboardAction[]>([])
  const [freshness, setFreshness] = useState<Record<string, string>>({})
  const [loading,   setLoading]   = useState(true)
  const [loadError, setLoadError] = useState(false)

  const load = useCallback(async () => {
    setLoadError(false)
    setLoading(true)
    try {
      const supabase = createClient()
      const [
        projRes, capexData, cfData, taskRes, decRes, actRes,
      ] = await Promise.all([
        supabase.from('dim_project')
          .select('project_id, project_name, city, stage, status_rag, opening_target')
          .eq('active', true),
        getCapexSummary(),
        getCashFlowSummary(),
        supabase.from('fct_task_snapshot')
          .select('id, project_id, task_id, as_of_week_ending, forecast_finish, percent_complete, status_code, blocked_flag, blocker_reason, impact_days_on_opening, dim_task!inner(task_name, criticality_level, opening_gate_flag, baseline_finish)')
          .order('as_of_week_ending', { ascending: false })
          .limit(500),
        supabase.from('fct_decision_log')
          .select('id, decision_id, project_id, decision_topic, decision_text, meeting_type, implementation_due, status_code, dim_owner:decision_owner_id(full_name)')
          .in('status_code', ['AS_OPEN', 'AS_PROG'])  // real open codes (were 'NS','IP' → matched nothing)
          .order('implementation_due', { ascending: true })
          .limit(6),
        supabase.from('fct_action_snapshot')
          .select('id, action_id, project_id, action_title, due_date, action_status_id, dim_owner!owner_id(full_name)')
          .not('action_status_id', 'in', '("AS_DONE","AS_CANC")')
          .order('due_date', { ascending: true })
          .limit(6),
      ])
      // surface RLS-deny / auth errors instead of silently rendering an empty dashboard
      for (const r of [projRes, taskRes, decRes, actRes]) { if (r.error) throw r.error }
      const taskData = taskRes.data

      // Deduplicate tasks → latest snapshot per task_id; track real data freshness per project
      const byTask: Record<string, DashboardTask> = {}
      const fresh: Record<string, string> = {}
      for (const t of (taskData || []) as unknown as DashboardTask[]) {
        if (!byTask[t.task_id] || t.as_of_week_ending > byTask[t.task_id].as_of_week_ending) {
          byTask[t.task_id] = t
        }
        if (!fresh[t.project_id] || t.as_of_week_ending > fresh[t.project_id]) {
          fresh[t.project_id] = t.as_of_week_ending
        }
      }
      const latest = Object.values(byTask)
      // Critical tasks: L0 gates + blocked, sorted by impact
      const critical = latest
        .filter(t => {
          const task = firstJoined(t.dim_task)
          return task?.opening_gate_flag || task?.criticality_level === 'L0' || t.blocked_flag
        })
        .sort((a, b) => (b.impact_days_on_opening || 0) - (a.impact_days_on_opening || 0))
        .slice(0, 8)

      setProjects((projRes.data || []) as Project[])
      setCapex(capexData)
      setCashFlow(cfData)
      setTasks(critical)
      setFreshness(fresh)
      setDecisions((decRes.data || []) as DashboardDecision[])
      setActions((actRes.data || []) as DashboardAction[])
    } catch (e) {
      console.error('[dashboard] load failed', e)
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (loadError) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="max-w-md space-y-3 rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <p className="text-sm font-medium text-slate-800">No se pudo cargar el dashboard</p>
          <p className="text-xs text-slate-500">La sesión pudo expirar. Reintenta o vuelve a iniciar sesión.</p>
          <div className="flex justify-center gap-2">
            <button onClick={() => load()} className="rounded bg-slate-800 px-4 py-2 text-xs font-medium text-white hover:bg-slate-700">Reintentar</button>
            <a href="/login" className="rounded border px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50">Iniciar sesión</a>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="space-y-2 text-center">
          <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
          <p className="font-mono text-xs text-slate-400">Cargando dashboard...</p>
        </div>
      </div>
    )
  }

  const now = new Date()
  const week = isoWeek(now)
  const year = now.getFullYear()
  const dateLabel = now.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

  // Separate tasks by project for the two tables
  const tasksMad = tasks.filter(t => t.project_id === 'MAD').slice(0, 5)
  const tasksBhx = tasks.filter(t => t.project_id === 'BHX').slice(0, 5)

  return (
    <div className="space-y-6 pb-8">

      {/* ── HEADER BAND ─────────────────────────────────────────────────── */}
      <header className="rounded-xl bg-slate-900 px-6 py-4 shadow-lg">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] font-bold tracking-[0.2em] text-slate-400 uppercase">
              Gemswell Ventures · MIS
            </p>
            <h1 className="mt-1 text-[20px] font-bold tracking-tight text-white">
              CEO Dashboard — Portfolio View
            </h1>
            <p className="mt-0.5 font-mono text-[11px] text-slate-400">
              Schedule & Critical Path · CAPEX & Funding · Governance
            </p>
          </div>
          <div className="text-right font-mono text-[11px] text-slate-400 leading-relaxed">
            <div><span className="font-semibold text-white">Semana</span>&nbsp;&nbsp;{week} · {year}</div>
            <div><span className="font-semibold text-white">Datos</span>&nbsp;&nbsp;&nbsp;{dateLabel}</div>
            <div><span className="font-semibold text-white">Proyectos</span>&nbsp;{projects.length} activos</div>
          </div>
        </div>
      </header>

      {/* ── ROW 1: PROJECT CARDS ────────────────────────────────────────── */}
      <div>
        <SectionTitle hint="· Estado global de los dos proyectos">Portfolio</SectionTitle>
        <div className="grid gap-4 lg:grid-cols-2">
          {projects.map(project => {
            const pid    = project.project_id
            const ccy    = pid === 'BHX' ? 'GBP' : 'EUR'
            const accent = PROJECT_ACCENT[pid] || '#334155'
            const pCap   = capex[pid]
            const pCF    = cashFlow[pid]
            const days   = project.opening_target ? daysTo(project.opening_target) : null
            const paidPct = pCap && pCap.budget > 0 ? (pCap.paid / pCap.budget * 100) : 0
            const commPct = pCap && pCap.budget > 0 ? (pCap.committed / pCap.budget * 100) : 0
            const eacVar  = pCap && pCap.budget > 0 ? ((pCap.eac - pCap.budget) / pCap.budget * 100) : 0
            // totalOutflow is stored NEGATIVE (queries-financial), so net = inflow + outflow
            const netCash = pCF ? pCF.totalInflow + pCF.totalOutflow : null
            const ptasks  = tasks.filter(t => t.project_id === pid)
            const redTasks = ptasks.filter(t => STATUS_CODE_RAG[t.status_code] === 'Red').length
            const blocked  = ptasks.filter(t => t.blocked_flag).length

            return (
              <div key={pid} className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                {/* Color bar */}
                <div className="h-1" style={{ backgroundColor: accent }} />

                <div className="p-5">
                  {/* Card header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span className="rounded-[2px] px-2 py-0.5 font-mono text-[10px] font-bold text-white" style={{ backgroundColor: accent }}>
                        {pid}
                      </span>
                      <div>
                        <p className="text-[15px] font-bold text-slate-900 leading-tight">{project.project_name}</p>
                        <p className="font-mono text-[10px] font-bold tracking-widest text-slate-400 uppercase">
                          {project.stage}
                        </p>
                      </div>
                    </div>
                    <RagChip status={project.status_rag as RAGColor} />
                  </div>

                  {/* Hero metric */}
                  <div className="flex items-baseline gap-4 border-b border-dashed border-slate-200 pb-4 mb-4">
                    <div>
                      <p className="font-mono text-[10px] font-bold tracking-widest text-slate-400 uppercase mb-0.5">
                        {pid === 'MAD' ? 'Días a apertura' : 'Días a NTP'}
                      </p>
                      <p className={cn('font-mono text-[42px] font-bold leading-none tabular-nums tracking-tight', days == null ? 'text-slate-400' : days < 0 ? 'text-red-600' : days < 90 ? 'text-amber-600' : 'text-slate-900')}>
                        {days == null ? '—' : Math.abs(days)}
                        <span className="text-[16px] font-normal text-slate-400 ml-1">d</span>
                      </p>
                    </div>
                    <div className="ml-auto text-right">
                      <p className="text-[12px] font-semibold text-slate-900">
                        {new Date(project.opening_target).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                      <p className="font-mono text-[10px] text-slate-400">Target apertura</p>
                    </div>
                  </div>

                  {/* KPI 2×2 */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3 mb-4">
                    <div>
                      <p className="font-mono text-[10px] font-bold tracking-widest text-slate-400 uppercase">CAPEX comprometido</p>
                      <p className="font-mono text-[18px] font-bold text-slate-900 tabular-nums">{pCap ? formatCompact(pCap.committed, ccy) : '—'}</p>
                      <p className="font-mono text-[11px] text-slate-400">{pCap ? `de ${formatCompact(pCap.budget, ccy)} · ${commPct.toFixed(0)}%` : ''}</p>
                    </div>
                    <div>
                      <p className="font-mono text-[10px] font-bold tracking-widest text-slate-400 uppercase">EAC Variance</p>
                      <p className={cn('font-mono text-[18px] font-bold tabular-nums', eacVar > 2 ? 'text-red-600' : eacVar < -2 ? 'text-green-600' : 'text-slate-900')}>
                        {eacVar > 0 ? '+' : ''}{eacVar.toFixed(1)}%
                      </p>
                      <p className="font-mono text-[11px] text-slate-400">{pCap ? `EAC ${formatCompact(pCap.eac, ccy)}` : ''}</p>
                    </div>
                    <div>
                      <p className="font-mono text-[10px] font-bold tracking-widest text-slate-400 uppercase">Hitos críticos en rojo</p>
                      <p className={cn('font-mono text-[18px] font-bold tabular-nums', redTasks > 0 ? 'text-red-600' : 'text-slate-900')}>{redTasks}</p>
                      <p className="font-mono text-[11px] text-slate-400">{blocked > 0 ? `${blocked} bloqueados` : 'sin bloqueos'}</p>
                    </div>
                    <div>
                      <p className="font-mono text-[10px] font-bold tracking-widest text-slate-400 uppercase">Cash neto 13W</p>
                      <p className={cn('font-mono text-[18px] font-bold tabular-nums', netCash != null && netCash < 0 ? 'text-red-600' : 'text-slate-900')}>
                        {netCash != null ? formatCompact(netCash, ccy) : '—'}
                      </p>
                      <p className="font-mono text-[11px] text-slate-400">forecast 13 semanas</p>
                    </div>
                  </div>

                  {/* CAPEX progress bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between font-mono text-[10px] text-slate-400">
                      <span>Pagado {paidPct.toFixed(0)}%</span>
                      <span>Comprometido {commPct.toFixed(0)}%</span>
                    </div>
                    <div className="relative h-2.5 rounded-full bg-slate-100 overflow-hidden">
                      {/* Committed layer (lighter) */}
                      <div className="absolute inset-0 rounded-full opacity-30" style={{ width: `${Math.min(commPct, 100)}%`, backgroundColor: accent }} />
                      {/* Paid layer */}
                      <div className="absolute inset-0 h-full rounded-full" style={{ width: `${Math.min(paidPct, 100)}%`, backgroundColor: accent }} />
                    </div>
                  </div>

                  {/* Links */}
                  <div className="mt-3 flex gap-3">
                    <Link href={`/project/${pid}`} className="font-mono text-[11px] font-semibold hover:underline" style={{ color: accent }}>
                      Ver proyecto →
                    </Link>
                    <Link href="/critical-path" className="font-mono text-[11px] text-slate-400 hover:text-slate-700">
                      Critical path
                    </Link>
                    <Link href="/funding" className="font-mono text-[11px] text-slate-400 hover:text-slate-700">
                      Funding
                    </Link>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── ROW 2: CRITICAL PATH TABLES ─────────────────────────────────── */}
      <div className="grid gap-6 xl:grid-cols-2">

        {/* MPS Critical Path */}
        <div>
          <SectionTitle hint="· Top hitos que marcan la apertura MAD" href="/critical-path">
            MPS · Camino crítico
          </SectionTitle>
          <TaskTable tasks={tasksMad} emptyMsg="Sin datos de schedule MAD. Ejecuta ingest-worker." />
        </div>

        {/* BHX Gates */}
        <div>
          <SectionTitle hint="· Gates que desbloquean el NTP BHX" href="/critical-path">
            BHX · Gates de readiness
          </SectionTitle>
          <TaskTable tasks={tasksBhx} emptyMsg="Sin datos de schedule BHX." />
        </div>

      </div>

      {/* ── ROW 3: CAPEX BARS ──────────────────────────────────────────── */}
      <div>
        <SectionTitle hint="· Compromiso vs presupuesto portfolio" href="/bp-budget">CAPEX</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {(['MAD', 'BHX'] as const).map(pid => {
            const pCap = capex[pid]
            const ccy  = pid === 'BHX' ? 'GBP' : 'EUR'
            const accent = PROJECT_ACCENT[pid]
            const paidPct = pCap && pCap.budget > 0 ? pCap.paid / pCap.budget * 100 : 0
            return (
              <div key={pid} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="font-mono text-[10px] font-bold tracking-widest text-slate-400 uppercase mb-3">
                  {pid} · CAPEX comprometido
                </p>
                <ProgressBar pct={paidPct} color={accent} />
                <div className="mt-2 flex justify-between font-mono text-[12px]">
                  <span className="font-semibold text-slate-800">{pCap ? formatCompact(pCap.committed, ccy) : '—'}</span>
                  <span className="text-slate-400">{pCap ? `de ${formatCompact(pCap.budget, ccy)} · ${paidPct.toFixed(0)}%` : ''}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── ROW 4: DECISIONS + ACTIONS ──────────────────────────────────── */}
      <div>
        <SectionTitle hint="· Lo que cierra el CEO Review del lunes">
          Decisiones abiertas & acciones de la semana
        </SectionTitle>
        <div className="grid gap-4 lg:grid-cols-2">

          {/* Decisions */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <h4 className="font-mono text-[11px] font-bold tracking-widest text-slate-500 uppercase">
                Decisiones abiertas
                {decisions.length > 0 && <span className="ml-2 rounded-full bg-amber-100 px-1.5 py-0.5 text-amber-700">{decisions.length}</span>}
              </h4>
              <Link href="/decisions" className="font-mono text-[11px] text-slate-400 hover:text-slate-700">ver todas →</Link>
            </div>
            {decisions.length === 0 ? (
              <div className="flex items-center gap-2 px-4 py-6 text-slate-400">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="font-mono text-[12px]">Sin decisiones pendientes</span>
              </div>
            ) : (
              <ul>
                {decisions.map((d, i) => {
                  const isOverdue = d.implementation_due && new Date(d.implementation_due) < now
                  return (
                    <li key={d.id} className={cn('border-b border-slate-50 px-4 py-3 last:border-0', i % 2 === 0 ? '' : 'bg-slate-50/50')}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="rounded-[2px] bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-700 shrink-0">
                              {d.decision_id || 'DEC'}
                            </span>
                            <span className="rounded-[2px] bg-slate-100 px-1 py-0.5 font-mono text-[9px] text-slate-500 shrink-0">
                              {d.meeting_type}
                            </span>
                            <span className="rounded-[2px] px-1 py-0.5 font-mono text-[9px] font-bold text-white shrink-0" style={{ backgroundColor: PROJECT_ACCENT[d.project_id] || '#475569' }}>
                              {d.project_id}
                            </span>
                          </div>
                          <p className="text-[12px] text-slate-800 leading-snug">{d.decision_topic}</p>
                          <p className="font-mono text-[10px] text-slate-400 mt-0.5">{ownerName(d.dim_owner)}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <span className={cn('font-mono text-[10px]', isOverdue ? 'text-red-600 font-bold' : 'text-slate-400')}>
                            {isOverdue ? '⚠ ' : ''}due {fmtDate(d.implementation_due)}
                          </span>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {/* Actions */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <h4 className="font-mono text-[11px] font-bold tracking-widest text-slate-500 uppercase">
                Acciones esta semana
                {actions.length > 0 && <span className="ml-2 rounded-full bg-blue-100 px-1.5 py-0.5 text-blue-700">{actions.length}</span>}
              </h4>
              <Link href="/risks" className="font-mono text-[11px] text-slate-400 hover:text-slate-700">ver todas →</Link>
            </div>
            {actions.length === 0 ? (
              <div className="flex items-center gap-2 px-4 py-6 text-slate-400">
                <Clock className="h-4 w-4" />
                <span className="font-mono text-[12px]">Sin acciones pendientes esta semana</span>
              </div>
            ) : (
              <ul>
                {actions.map((a, i) => {
                  const isOverdue = a.due_date && new Date(a.due_date) < now
                  const isUrgent  = a.action_status_id === 'AS_OVER'
                  return (
                    <li key={a.id} className={cn('border-b border-slate-50 px-4 py-3 last:border-0', i % 2 === 0 ? '' : 'bg-slate-50/50')}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="rounded-[2px] bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-700 shrink-0">
                              {a.action_id || 'ACT'}
                            </span>
                            {isUrgent && <AlertTriangle className="h-3 w-3 text-red-500 shrink-0" />}
                            <span className="rounded-[2px] px-1 py-0.5 font-mono text-[9px] font-bold text-white shrink-0" style={{ backgroundColor: PROJECT_ACCENT[a.project_id] || '#475569' }}>
                              {a.project_id}
                            </span>
                          </div>
                          <p className="text-[12px] text-slate-800 leading-snug">{a.action_title}</p>
                          <p className="font-mono text-[10px] text-slate-400 mt-0.5">{ownerName(a.dim_owner)}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <span className={cn('font-mono text-[10px]', isOverdue || isUrgent ? 'text-red-600 font-bold' : 'text-slate-400')}>
                            {(isOverdue || isUrgent) ? '⚠ ' : ''}due {fmtDate(a.due_date)}
                          </span>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

        </div>
      </div>

      {/* ── FOOTER ──────────────────────────────────────────────────────── */}
      <footer className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-[10px] text-slate-400">
        <div className="flex flex-wrap gap-4">
          <Freshness label="MPS · Schedule MAD" asOf={freshness.MAD} now={now} />
          <Freshness label="BHX · Schedule" asOf={freshness.BHX} now={now} />
        </div>
        <span>Gemswell Ventures MIS · v0.2 · W{week} {year}</span>
      </footer>

    </div>
  )
}

// ─── Data freshness (real snapshot date + age) ─────────────────────────────

function Freshness({ label, asOf, now }: { label: string; asOf?: string; now: Date }) {
  const date = asOf ? new Date(asOf) : null
  const ageDays = date ? Math.floor((now.getTime() - date.getTime()) / 86400000) : null
  return (
    <span>
      <span className="text-slate-600 font-semibold">{label}</span>
      &nbsp;·&nbsp;{date ? date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : 'sin datos'}&nbsp;·&nbsp;
      {ageDays == null
        ? <span className="text-slate-400">● n/d</span>
        : ageDays <= 14
          ? <span className="text-green-600">● actualizado</span>
          : <span className="text-amber-600">● hace {ageDays}d</span>}
    </span>
  )
}

// ─── Task Table ───────────────────────────────────────────────────────────

function TaskTable({ tasks, emptyMsg }: { tasks: DashboardTask[]; emptyMsg: string }) {
  if (tasks.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center">
        <Clock className="mx-auto mb-2 h-5 w-5 text-slate-300" />
        <p className="font-mono text-[11px] text-slate-400">{emptyMsg}</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            {['Código', 'Tarea', 'Baseline', 'Forecast', 'Slack', 'Status'].map(h => (
              <th key={h} className="px-3 py-2.5 text-left font-mono text-[10px] font-bold tracking-widest text-slate-400 uppercase whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tasks.map((t, i) => {
            const task      = firstJoined(t.dim_task)
            const rag       = STATUS_CODE_RAG[t.status_code] || 'Grey'
            const baseDate  = task?.baseline_finish
            const foreDate  = t.forecast_finish
            const slip      = baseDate && foreDate
              ? Math.ceil((new Date(foreDate).getTime() - new Date(baseDate).getTime()) / 86400000)
              : null

            return (
              <tr key={t.id} className={cn('border-b border-slate-50 last:border-0 transition-colors hover:bg-slate-50', t.blocked_flag ? 'bg-red-50/40' : i % 2 === 1 ? 'bg-slate-50/30' : '')}>
                <td className="px-3 py-2.5 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                  {t.task_id}
                </td>
                <td className="px-3 py-2.5 font-medium text-slate-800 max-w-[180px]">
                  <span className="line-clamp-2 leading-snug">{task?.task_name || '—'}</span>
                  {t.blocked_flag && (
                    <span className="flex items-center gap-1 font-mono text-[10px] text-red-600 mt-0.5">
                      <AlertTriangle className="h-2.5 w-2.5" /> bloqueado
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5 font-mono text-[11px] text-slate-400 whitespace-nowrap">{fmtDate(baseDate)}</td>
                <td className="px-3 py-2.5 font-mono text-[11px] text-slate-600 whitespace-nowrap">{fmtDate(foreDate)}</td>
                <td className={cn('px-3 py-2.5 font-mono text-[11px] whitespace-nowrap tabular-nums', slip == null ? 'text-slate-300' : slipColor(-slip))}>
                  {slip == null ? '—' : slip === 0 ? '0 d' : `${slip > 0 ? '+' : ''}${slip} d`}
                </td>
                <td className="px-3 py-2.5">
                  <span className={cn('inline-flex items-center gap-1 rounded-[2px] px-1.5 py-0.5 font-mono text-[10px] font-bold', STATUS_RAG[rag]?.bg, STATUS_RAG[rag]?.text)}>
                    <RagDot status={rag} />
                    {rag}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
