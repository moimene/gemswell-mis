'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { cn, type RAGColor } from '@/lib/utils'
import { KPICard } from '@/components/shared/KPICard'
import { PageHeader, RagChip, RagDot, projectAccent } from '@/components/shared/terminal'
import { AlertTriangle, CheckCircle, Clock, Flag } from 'lucide-react'

type ProjectTab = 'MAD' | 'BHX'

interface TaskSnapshot {
  id: string
  project_id: string
  task_id: string
  as_of_week_ending: string
  forecast_start: string | null
  forecast_finish: string
  actual_start: string | null
  actual_finish: string | null
  percent_complete: number
  status_code: string
  blocked_flag: boolean
  blocker_category: string | null
  blocker_reason: string | null
  impact_days_on_opening: number | null
  next_action_summary: string | null
  next_action_due_date: string | null
  comment: string | null
  dim_task: {
    task_id: string
    task_name: string
    task_type: string
    criticality_level: string
    critical_flag: boolean
    opening_gate_flag: boolean
    workstream_id: string
    baseline_start: string | null
    baseline_finish: string | null
    wbs_level1: string | null
    wbs_level2: string | null
    dim_workstream: {
      workstream_id: string
      workstream_name: string
      domain_group: string
    } | null
  }
}

function statusToRAG(statusCode: string, blocked: boolean): RAGColor {
  if (blocked) return 'Red'
  switch (statusCode) {
    case 'CP': return 'Green'
    case 'IP': return 'Amber'
    case 'AT': return 'Amber'
    case 'BL': return 'Red'
    case 'DL': return 'Red'
    case 'NS': return 'Grey'
    case 'NA': return 'Grey'
    default: return 'Grey'
  }
}

function statusLabel(code: string): string {
  switch (code) {
    case 'NS': return 'Sin iniciar'
    case 'IP': return 'En curso'
    case 'BL': return 'Bloqueada'
    case 'DL': return 'Retrasada'
    case 'CP': return 'Completada'
    case 'AT': return 'En riesgo'
    case 'NA': return 'N/A'
    default: return code
  }
}

function daysBetween(a: string | null, b: string | null): number | null {
  if (!a || !b) return null
  const msA = new Date(a).getTime()
  const msB = new Date(b).getTime()
  return Math.round((msB - msA) / 86_400_000)
}

function fmtDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: '2-digit' })
}

function worstRAG(rags: RAGColor[]): RAGColor {
  const order: RAGColor[] = ['Red', 'Amber', 'Blue', 'Green', 'Grey']
  for (const r of order) if (rags.includes(r)) return r
  return 'Grey'
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-slate-400">
      <CheckCircle className="mb-2 h-8 w-8 opacity-40" />
      <p className="text-sm">{message}</p>
    </div>
  )
}

async function fetchLatestSnapshots(project_id: string): Promise<TaskSnapshot[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('fct_task_snapshot')
    .select(`
      id, project_id, task_id, as_of_week_ending,
      forecast_start, forecast_finish,
      actual_start, actual_finish,
      percent_complete, status_code,
      blocked_flag, blocker_category, blocker_reason,
      impact_days_on_opening,
      next_action_summary, next_action_due_date, comment,
      dim_task!inner(
        task_id, task_name, task_type, criticality_level,
        critical_flag, opening_gate_flag, workstream_id,
        baseline_start, baseline_finish, wbs_level1, wbs_level2,
        dim_workstream:workstream_id(workstream_id, workstream_name, domain_group)
      )
    `)
    .eq('project_id', project_id)
    .eq('dim_task.active', true)
    .order('as_of_week_ending', { ascending: false })

  if (error) throw error
  if (!data) return []

  // Deduplicate: keep only the most recent snapshot per task
  const seen = new Map<string, TaskSnapshot>()
  for (const row of data as unknown as TaskSnapshot[]) {
    if (!seen.has(row.task_id)) seen.set(row.task_id, row)
  }
  return Array.from(seen.values())
}

export default function CriticalPathPage() {
  const [tab, setTab] = useState<ProjectTab>('MAD')
  const [snapshots, setSnapshots] = useState<TaskSnapshot[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoadError(false)
      try {
        const data = await fetchLatestSnapshots(tab)
        if (cancelled) return
        setSnapshots(data)
      } catch (e) {
        if (cancelled) return
        console.error(e)
        setLoadError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [tab, reloadKey])

  const retry = () => {
    setLoading(true)
    setReloadKey(k => k + 1)
  }

  // ── KPI derivations ──────────────────────────────────────────────────────
  const total = snapshots.length
  const onTrack = snapshots.filter(
    s => ['IP', 'NS'].includes(s.status_code) && !s.blocked_flag
  ).length
  const blocked = snapshots.filter(s => s.blocked_flag).length
  const critImpact = snapshots
    .filter(s => s.blocked_flag)
    .reduce((sum, s) => sum + (s.impact_days_on_opening ?? 0), 0)

  const kpiRAG = (v: number, warn: number, bad: number): RAGColor =>
    v >= bad ? 'Red' : v >= warn ? 'Amber' : 'Green'

  // ── Gate Tracker (L0 / opening_gate_flag) ────────────────────────────────
  const gates = snapshots.filter(
    s => s.dim_task.criticality_level === 'L0' || s.dim_task.opening_gate_flag
  )

  // ── Task Table by Workstream (L1) ─────────────────────────────────────────
  const l1Tasks = snapshots.filter(s => s.dim_task.criticality_level === 'L1')
  const workstreamMap = new Map<string, { name: string; tasks: TaskSnapshot[] }>()
  for (const s of l1Tasks) {
    const wsId = s.dim_task.workstream_id
    const wsName = s.dim_task.dim_workstream?.workstream_name ?? wsId
    if (!workstreamMap.has(wsId)) workstreamMap.set(wsId, { name: wsName, tasks: [] })
    workstreamMap.get(wsId)!.tasks.push(s)
  }
  const workstreams = Array.from(workstreamMap.entries()).sort((a, b) =>
    a[1].name.localeCompare(b[1].name)
  )

  // ── Blockers Board ────────────────────────────────────────────────────────
  const blockers = snapshots
    .filter(s => s.blocked_flag)
    .sort((a, b) => (b.impact_days_on_opening ?? 0) - (a.impact_days_on_opening ?? 0))

  return (
    <div className="space-y-6">
      {/* Header + Tab switcher */}
      <PageHeader
        title="Ruta Crítica"
        subtitle="Cronograma del programa · estado de hitos · bloqueos abiertos"
        right={
          <div className="flex gap-1 rounded-lg bg-slate-800 p-1">
            {(['MAD', 'BHX'] as const).map(p => (
              <button
                key={p}
                type="button"
                onClick={() => setTab(p)}
                className={cn(
                  'rounded-md px-4 py-1.5 font-mono text-xs font-bold tracking-wide transition-colors',
                  tab === p ? 'text-white' : 'text-slate-400 hover:text-slate-200'
                )}
                style={tab === p ? { backgroundColor: projectAccent(p) } : undefined}
              >
                {p}
              </button>
            ))}
          </div>
        }
      />

      {loading ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
          <p className="font-mono text-xs text-slate-400">Cargando ruta crítica…</p>
        </div>
      ) : loadError ? (
        <div className="flex h-64 items-center justify-center">
          <div className="max-w-sm rounded-lg border border-red-200 bg-red-50/60 p-6 text-center">
            <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-red-500" />
            <p className="text-sm font-medium text-slate-800">No se pudo cargar la ruta crítica</p>
            <p className="mt-1 text-xs text-slate-500">La sesión pudo expirar. Reintenta o inicia sesión de nuevo.</p>
            <div className="mt-4 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={retry}
                className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
              >
                Reintentar
              </button>
              <a
                href="/login"
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Iniciar sesión
              </a>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* ── KPI Row ─────────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <KPICard title="Tareas totales" value={total} subtitle="activas en ruta crítica" rag="Grey" />
            <KPICard
              title="En curso"
              value={onTrack}
              subtitle={`${total ? Math.round((onTrack / total) * 100) : 0}% de tareas`}
              rag={kpiRAG(total - onTrack, Math.ceil(total * 0.1), Math.ceil(total * 0.25))}
            />
            <KPICard
              title="Bloqueadas"
              value={blocked}
              subtitle="tareas con bloqueos activos"
              rag={blocked === 0 ? 'Green' : blocked <= 2 ? 'Amber' : 'Red'}
            />
            <KPICard
              title="Impacto en ruta crítica"
              value={`${critImpact}d`}
              subtitle="días acumulados en riesgo de apertura"
              rag={critImpact === 0 ? 'Green' : critImpact <= 14 ? 'Amber' : 'Red'}
            />
          </div>

          {/* ── Gate Tracker ──────────────────────────────────────────────── */}
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-900">
              <Flag className="h-4 w-4 text-slate-500" />
              Hitos L0
            </h2>
            {gates.length === 0 ? (
              <EmptyState message="No hay hitos L0 para este proyecto" />
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    <tr>
                      <th className="px-4 py-2.5 text-left">Hito</th>
                      <th className="px-4 py-2.5 text-left">Línea base</th>
                      <th className="px-4 py-2.5 text-left">Previsión</th>
                      <th className="px-4 py-2.5 text-left">Estado</th>
                      <th className="px-4 py-2.5 text-right">Desvío</th>
                      <th className="px-4 py-2.5 text-right">% Avance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {gates.map(s => {
                      const slip = daysBetween(s.dim_task.baseline_finish, s.forecast_finish)
                      const rag: RAGColor =
                        s.status_code === 'CP' ? 'Green'
                        : s.blocked_flag ? 'Red'
                        : (slip ?? 0) > 0 ? 'Amber'
                        : 'Green'
                      return (
                        <tr key={s.id} className="odd:bg-slate-50/30 hover:bg-slate-50">
                          <td className="px-4 py-2.5 font-medium text-slate-800">
                            {s.dim_task.task_name}
                          </td>
                          <td className="px-4 py-2.5 font-mono tabular-nums text-slate-600">
                            {fmtDate(s.dim_task.baseline_finish)}
                          </td>
                          <td className="px-4 py-2.5 font-mono tabular-nums text-slate-600">
                            {fmtDate(s.forecast_finish)}
                          </td>
                          <td className="px-4 py-2.5">
                            <RagChip status={rag} label={statusLabel(s.status_code)} />
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                            {slip === null ? <span className="text-slate-400">—</span> : slip === 0 ? (
                              <span className="text-green-600">En plazo</span>
                            ) : (
                              <span className={slip > 0 ? 'text-red-600' : 'text-green-600'}>
                                {slip > 0 ? `+${slip}d` : `${slip}d`}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-600">
                            {s.percent_complete != null ? `${Number(s.percent_complete).toFixed(0)}%` : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* ── Task Table by Workstream (L1) ──────────────────────────────── */}
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-900">
              <Clock className="h-4 w-4 text-slate-500" />
              Tareas L1 por flujo de trabajo
            </h2>
            {workstreams.length === 0 ? (
              <EmptyState message="No hay tareas L1 para este proyecto" />
            ) : (
              <div className="space-y-4">
                {workstreams.map(([wsId, { name, tasks }]) => {
                  const wsRAG = worstRAG(tasks.map(t => statusToRAG(t.status_code, t.blocked_flag)))
                  return (
                    <div key={wsId} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                      <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
                        <RagDot status={wsRAG} />
                        <span className="text-sm font-semibold text-slate-700">{name}</span>
                        <span className="ml-auto font-mono text-[10px] uppercase tracking-widest text-slate-400">{tasks.length} tarea{tasks.length !== 1 ? 's' : ''}</span>
                      </div>
                      <table className="w-full text-sm">
                        <thead className="bg-white font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">
                          <tr>
                            <th className="px-4 py-2 text-left">Tarea</th>
                            <th className="px-4 py-2 text-left">Línea base</th>
                            <th className="px-4 py-2 text-left">Previsión</th>
                            <th className="px-4 py-2 text-left">Estado</th>
                            <th className="px-4 py-2 text-right">% Avance</th>
                            <th className="px-4 py-2 text-left">Bloqueo</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {tasks.map(s => {
                            const rag = statusToRAG(s.status_code, s.blocked_flag)
                            return (
                              <tr key={s.id} className="odd:bg-slate-50/30 hover:bg-slate-50">
                                <td className="px-4 py-2 text-slate-800">{s.dim_task.task_name}</td>
                                <td className="px-4 py-2 font-mono tabular-nums text-slate-600">{fmtDate(s.dim_task.baseline_finish)}</td>
                                <td className="px-4 py-2 font-mono tabular-nums text-slate-600">{fmtDate(s.forecast_finish)}</td>
                                <td className="px-4 py-2">
                                  <RagChip status={rag} label={statusLabel(s.status_code)} />
                                </td>
                                <td className="px-4 py-2 text-right font-mono tabular-nums text-slate-600">
                                  {s.percent_complete != null ? `${Number(s.percent_complete).toFixed(0)}%` : '—'}
                                </td>
                                <td className="max-w-xs truncate px-4 py-2 text-slate-600">
                                  {s.blocked_flag && s.blocker_reason
                                    ? <span className="text-xs text-red-600">{s.blocker_reason}</span>
                                    : <span className="text-slate-400">—</span>}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          {/* ── Blockers Board ─────────────────────────────────────────────── */}
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-900">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              Bloqueos abiertos
              {blockers.length > 0 && (
                <span className="ml-1 rounded-full bg-red-100 px-2 py-0.5 font-mono text-xs font-semibold text-red-700">
                  {blockers.length}
                </span>
              )}
            </h2>
            {blockers.length === 0 ? (
              <EmptyState message="Sin bloqueos abiertos — la ruta crítica está despejada" />
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    <tr>
                      <th className="px-4 py-2.5 text-left">Tarea</th>
                      <th className="px-4 py-2.5 text-left">Categoría</th>
                      <th className="px-4 py-2.5 text-left">Motivo</th>
                      <th className="px-4 py-2.5 text-right">Impacto</th>
                      <th className="px-4 py-2.5 text-left">Próxima acción</th>
                      <th className="px-4 py-2.5 text-left">Vence</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {blockers.map(s => (
                      <tr key={s.id} className="odd:bg-slate-50/30 hover:bg-slate-50">
                        <td className="px-4 py-2.5 font-medium text-slate-800">
                          {s.dim_task.task_name}
                        </td>
                        <td className="px-4 py-2.5 text-slate-600">
                          {s.blocker_category ?? <span className="text-slate-400">—</span>}
                        </td>
                        <td className="max-w-xs px-4 py-2.5 text-slate-600">
                          {s.blocker_reason ?? <span className="text-slate-400">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-semibold tabular-nums text-red-600">
                          {s.impact_days_on_opening != null ? `+${s.impact_days_on_opening}d` : <span className="text-slate-400">—</span>}
                        </td>
                        <td className="max-w-xs px-4 py-2.5 text-slate-600">
                          {s.next_action_summary ?? <span className="text-slate-400">—</span>}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 font-mono tabular-nums text-slate-600">
                          {fmtDate(s.next_action_due_date)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
