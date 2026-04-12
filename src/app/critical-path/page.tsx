'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { cn, type RAGColor } from '@/lib/utils'
import { KPICard } from '@/components/shared/KPICard'
import { RAGBadge, RAGDot } from '@/components/shared/RAGBadge'
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
    case 'NS': return 'Not Started'
    case 'IP': return 'In Progress'
    case 'BL': return 'Blocked'
    case 'DL': return 'Delayed'
    case 'CP': return 'Complete'
    case 'AT': return 'At Risk'
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
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })
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

  if (error) { console.error(error); return [] }
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

  useEffect(() => {
    setLoading(true)
    fetchLatestSnapshots(tab).then(data => {
      setSnapshots(data)
      setLoading(false)
    })
  }, [tab])

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
    <div className="space-y-6 p-6">
      {/* Header + Tab switcher */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Critical Path</h1>
          <p className="text-sm text-slate-500 mt-0.5">Programme schedule · gate status · open blockers</p>
        </div>
        <div className="flex rounded-lg border bg-slate-50 p-1 gap-1">
          {(['MAD', 'BHX'] as const).map(p => (
            <button
              key={p}
              type="button"
              onClick={() => setTab(p)}
              className={cn(
                'rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
                tab === p
                  ? 'bg-white shadow text-slate-900'
                  : 'text-slate-500 hover:text-slate-700'
              )}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <p className="text-slate-400">Loading...</p>
        </div>
      ) : (
        <>
          {/* ── KPI Row ─────────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <KPICard title="Total Tasks" value={total} subtitle="active on critical path" rag="Grey" />
            <KPICard
              title="On Track"
              value={onTrack}
              subtitle={`${total ? Math.round((onTrack / total) * 100) : 0}% of tasks`}
              rag={kpiRAG(total - onTrack, Math.ceil(total * 0.1), Math.ceil(total * 0.25))}
            />
            <KPICard
              title="Blocked"
              value={blocked}
              subtitle="tasks with active blockers"
              rag={blocked === 0 ? 'Green' : blocked <= 2 ? 'Amber' : 'Red'}
            />
            <KPICard
              title="Critical Path Impact"
              value={`${critImpact}d`}
              subtitle="cumulative days at risk on opening"
              rag={critImpact === 0 ? 'Green' : critImpact <= 14 ? 'Amber' : 'Red'}
            />
          </div>

          {/* ── Gate Tracker ──────────────────────────────────────────────── */}
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
              <Flag className="h-4 w-4 text-slate-500" />
              Gate Tracker — L0 Milestones
            </h2>
            {gates.length === 0 ? (
              <EmptyState message="No L0 gates found for this project" />
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-2.5 text-left">Gate / Milestone</th>
                      <th className="px-4 py-2.5 text-left">Baseline</th>
                      <th className="px-4 py-2.5 text-left">Forecast</th>
                      <th className="px-4 py-2.5 text-left">Status</th>
                      <th className="px-4 py-2.5 text-right">Slip</th>
                      <th className="px-4 py-2.5 text-right">% Done</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {gates.map(s => {
                      const slip = daysBetween(s.dim_task.baseline_finish, s.forecast_finish)
                      const rag: RAGColor =
                        s.status_code === 'CP' ? 'Green'
                        : s.blocked_flag ? 'Red'
                        : (slip ?? 0) > 0 ? 'Amber'
                        : 'Green'
                      return (
                        <tr key={s.id} className="hover:bg-slate-50/60">
                          <td className="px-4 py-2.5 font-medium text-slate-800">
                            {s.dim_task.task_name}
                          </td>
                          <td className="px-4 py-2.5 text-slate-600">
                            {fmtDate(s.dim_task.baseline_finish)}
                          </td>
                          <td className="px-4 py-2.5 text-slate-600">
                            {fmtDate(s.forecast_finish)}
                          </td>
                          <td className="px-4 py-2.5">
                            <RAGBadge status={rag} label={statusLabel(s.status_code)} />
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono">
                            {slip === null ? '—' : slip === 0 ? (
                              <span className="text-green-600">On time</span>
                            ) : (
                              <span className={slip > 0 ? 'text-red-600' : 'text-green-600'}>
                                {slip > 0 ? `+${slip}d` : `${slip}d`}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right text-slate-600">
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
            <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
              <Clock className="h-4 w-4 text-slate-500" />
              L1 Tasks by Workstream
            </h2>
            {workstreams.length === 0 ? (
              <EmptyState message="No L1 tasks found for this project" />
            ) : (
              <div className="space-y-4">
                {workstreams.map(([wsId, { name, tasks }]) => {
                  const wsRAG = worstRAG(tasks.map(t => statusToRAG(t.status_code, t.blocked_flag)))
                  return (
                    <div key={wsId} className="rounded-lg border overflow-hidden">
                      <div className="flex items-center gap-3 bg-slate-50 px-4 py-2.5 border-b">
                        <RAGDot status={wsRAG} />
                        <span className="font-semibold text-slate-700 text-sm">{name}</span>
                        <span className="ml-auto text-xs text-slate-400">{tasks.length} task{tasks.length !== 1 ? 's' : ''}</span>
                      </div>
                      <table className="w-full text-sm">
                        <thead className="bg-white text-xs font-semibold uppercase text-slate-400">
                          <tr>
                            <th className="px-4 py-2 text-left">Task</th>
                            <th className="px-4 py-2 text-left">Baseline Finish</th>
                            <th className="px-4 py-2 text-left">Forecast</th>
                            <th className="px-4 py-2 text-left">Status</th>
                            <th className="px-4 py-2 text-right">%</th>
                            <th className="px-4 py-2 text-left">Blocker</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {tasks.map(s => {
                            const rag = statusToRAG(s.status_code, s.blocked_flag)
                            return (
                              <tr key={s.id} className="hover:bg-slate-50/60">
                                <td className="px-4 py-2 text-slate-800">{s.dim_task.task_name}</td>
                                <td className="px-4 py-2 text-slate-500">{fmtDate(s.dim_task.baseline_finish)}</td>
                                <td className="px-4 py-2 text-slate-500">{fmtDate(s.forecast_finish)}</td>
                                <td className="px-4 py-2">
                                  <RAGBadge status={rag} label={statusLabel(s.status_code)} />
                                </td>
                                <td className="px-4 py-2 text-right text-slate-500">
                                  {s.percent_complete != null ? `${Number(s.percent_complete).toFixed(0)}%` : '—'}
                                </td>
                                <td className="px-4 py-2 text-slate-500 max-w-xs truncate">
                                  {s.blocked_flag && s.blocker_reason
                                    ? <span className="text-red-600 text-xs">{s.blocker_reason}</span>
                                    : <span className="text-slate-300">—</span>}
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
            <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              Open Blockers
              {blockers.length > 0 && (
                <span className="ml-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                  {blockers.length}
                </span>
              )}
            </h2>
            {blockers.length === 0 ? (
              <EmptyState message="No open blockers — critical path is clear" />
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-2.5 text-left">Task</th>
                      <th className="px-4 py-2.5 text-left">Category</th>
                      <th className="px-4 py-2.5 text-left">Reason</th>
                      <th className="px-4 py-2.5 text-right">Impact</th>
                      <th className="px-4 py-2.5 text-left">Next Action</th>
                      <th className="px-4 py-2.5 text-left">Due</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {blockers.map(s => (
                      <tr key={s.id} className="hover:bg-red-50/30">
                        <td className="px-4 py-2.5 font-medium text-slate-800">
                          {s.dim_task.task_name}
                        </td>
                        <td className="px-4 py-2.5 text-slate-600">
                          {s.blocker_category ?? '—'}
                        </td>
                        <td className="px-4 py-2.5 text-slate-600 max-w-xs">
                          {s.blocker_reason ?? '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-semibold text-red-600">
                          {s.impact_days_on_opening != null ? `+${s.impact_days_on_opening}d` : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-slate-600 max-w-xs">
                          {s.next_action_summary ?? '—'}
                        </td>
                        <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">
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
