'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { cn, type RAGColor } from '@/lib/utils'
import { KPICard } from '@/components/shared/KPICard'
import { RAGBadge, RAGDot } from '@/components/shared/RAGBadge'
import { AlertTriangle, CheckCircle, Clock, Utensils } from 'lucide-react'

type ProjectTab = 'MAD' | 'BHX'

interface ReadinessRow {
  id: string
  project_id: string
  item_id: string
  as_of_week_ending: string
  baseline_target: string
  forecast_target: string
  actual_completion: string | null
  status_code: string
  owner_id: string
  blocked_flag: boolean
  blocker_reason: string | null
  dependency_task_id: string | null
  dependency_other: string | null
  comment: string | null
  dim_readiness_item: {
    item_id: string
    item_name: string
    readiness_group: string
    workstream_id: string
    critical_flag: boolean
    opening_blocker_flag: boolean
    weight: number
  }
}

const GROUP_ORDER = [
  'Menu', 'Suppliers', 'Inventory', 'POS',
  'Staffing', 'Training', 'Fit-out', 'Safety', 'HSE', 'Opening',
]

function statusToRAG(code: string, blocked: boolean): RAGColor {
  if (blocked) return 'Red'
  switch (code) {
    case 'CP': return 'Green'
    case 'IP': return 'Amber'
    case 'AT': return 'Amber'
    case 'BL': return 'Red'
    case 'DL': return 'Red'
    case 'NS': return 'Grey'
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
    default: return code
  }
}

function fmtDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })
}

function slipDays(baseline: string, forecast: string): number {
  return Math.round((new Date(forecast).getTime() - new Date(baseline).getTime()) / 86_400_000)
}

function worstRAG(rags: RAGColor[]): RAGColor {
  const order: RAGColor[] = ['Red', 'Amber', 'Blue', 'Green', 'Grey']
  for (const r of order) if (rags.includes(r)) return r
  return 'Grey'
}

function groupScore(rows: ReadinessRow[]): number {
  if (rows.length === 0) return 0
  const totalWeight = rows.reduce((s, r) => s + Number(r.dim_readiness_item.weight), 0)
  if (totalWeight === 0) return 0
  const done = rows
    .filter(r => r.status_code === 'CP')
    .reduce((s, r) => s + Number(r.dim_readiness_item.weight), 0)
  return Math.round((done / totalWeight) * 100)
}

const FNB_WORKSTREAMS = ['FNB', 'HSE']

async function fetchReadiness(project_id: string): Promise<ReadinessRow[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('fct_readiness')
    .select(`
      id, project_id, item_id, as_of_week_ending,
      baseline_target, forecast_target, actual_completion,
      status_code, owner_id,
      blocked_flag, blocker_reason,
      dependency_task_id, dependency_other, comment,
      dim_readiness_item!inner(
        item_id, item_name, readiness_group, workstream_id,
        critical_flag, opening_blocker_flag, weight
      )
    `)
    .eq('project_id', project_id)
    .in('dim_readiness_item.workstream_id', FNB_WORKSTREAMS)
    .order('as_of_week_ending', { ascending: false })

  if (error) { console.error(error); return [] }
  if (!data) return []

  const seen = new Map<string, ReadinessRow>()
  for (const row of data as unknown as ReadinessRow[]) {
    if (!seen.has(row.item_id)) seen.set(row.item_id, row)
  }
  return Array.from(seen.values())
}

export default function FnBReadinessPage() {
  const [tab, setTab] = useState<ProjectTab>('MAD')
  const [rows, setRows] = useState<ReadinessRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetchReadiness(tab).then(data => {
      if (cancelled) return
      setRows(data)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [tab])

  const total = rows.length
  const complete = rows.filter(r => r.status_code === 'CP').length
  const blocked = rows.filter(r => r.blocked_flag).length
  const openingBlockers = rows.filter(r => r.dim_readiness_item.opening_blocker_flag && r.status_code !== 'CP').length
  const overallScore = groupScore(rows)

  const groupMap = new Map<string, ReadinessRow[]>()
  for (const r of rows) {
    const g = r.dim_readiness_item.readiness_group
    if (!groupMap.has(g)) groupMap.set(g, [])
    groupMap.get(g)!.push(r)
  }
  const groups = [
    ...GROUP_ORDER.filter(g => groupMap.has(g)).map(g => [g, groupMap.get(g)!] as [string, ReadinessRow[]]),
    ...Array.from(groupMap.entries()).filter(([g]) => !GROUP_ORDER.includes(g)).sort((a, b) => a[0].localeCompare(b[0])),
  ]

  const blockers = rows
    .filter(r => r.blocked_flag)
    .sort((a, b) => Number(b.dim_readiness_item.weight) - Number(a.dim_readiness_item.weight))

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">F&B Readiness</h1>
          <p className="text-sm text-slate-500 mt-0.5">Food & beverage, menu, staffing & supplier pre-opening checklist</p>
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
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <KPICard
              title="Overall Readiness"
              value={`${overallScore}%`}
              subtitle={`${complete} of ${total} items complete`}
              rag={overallScore >= 80 ? 'Green' : overallScore >= 50 ? 'Amber' : 'Red'}
            />
            <KPICard
              title="Complete"
              value={complete}
              subtitle={`${total - complete} still open`}
              rag={complete === total ? 'Green' : 'Grey'}
            />
            <KPICard
              title="Blocked"
              value={blocked}
              subtitle="items with active blockers"
              rag={blocked === 0 ? 'Green' : blocked <= 2 ? 'Amber' : 'Red'}
            />
            <KPICard
              title="Opening Blockers"
              value={openingBlockers}
              subtitle="critical items not yet complete"
              rag={openingBlockers === 0 ? 'Green' : openingBlockers <= 2 ? 'Amber' : 'Red'}
            />
          </div>

          {groups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <CheckCircle className="mb-2 h-8 w-8 opacity-40" />
              <p className="text-sm">No F&B readiness items found for this project</p>
            </div>
          ) : (
            <div className="space-y-4">
              {groups.map(([group, items]) => {
                const gRAG = worstRAG(items.map(r => statusToRAG(r.status_code, r.blocked_flag)))
                const gScore = groupScore(items)
                return (
                  <div key={group} className="rounded-lg border overflow-hidden">
                    <div className="flex items-center gap-3 bg-slate-50 px-4 py-2.5 border-b">
                      <RAGDot status={gRAG} />
                      <span className="font-semibold text-slate-700 text-sm">{group}</span>
                      <div className="ml-2 flex items-center gap-1.5 flex-1">
                        <div className="h-1.5 w-20 rounded-full bg-slate-200 overflow-hidden">
                          <div
                            className={cn('h-full rounded-full', gScore >= 80 ? 'bg-green-500' : gScore >= 50 ? 'bg-amber-400' : 'bg-red-400')}
                            style={{ width: `${gScore}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-400 tabular-nums">{gScore}%</span>
                      </div>
                      <span className="ml-auto text-xs text-slate-400">{items.length} item{items.length !== 1 ? 's' : ''}</span>
                    </div>
                    <table className="w-full text-sm">
                      <thead className="bg-white text-xs font-semibold uppercase text-slate-400">
                        <tr>
                          <th className="px-4 py-2 text-left">Item</th>
                          <th className="px-4 py-2 text-left">Baseline</th>
                          <th className="px-4 py-2 text-left">Forecast</th>
                          <th className="px-4 py-2 text-left">Status</th>
                          <th className="px-4 py-2 text-right">Slip</th>
                          <th className="px-4 py-2 text-left">Owner</th>
                          <th className="px-4 py-2 text-left">Blocker</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {items.map(r => {
                          const rag = statusToRAG(r.status_code, r.blocked_flag)
                          const slip = slipDays(r.baseline_target, r.forecast_target)
                          return (
                            <tr key={r.id} className="hover:bg-slate-50/60">
                              <td className="px-4 py-2.5 text-slate-800">
                                <span>{r.dim_readiness_item.item_name}</span>
                                {r.dim_readiness_item.opening_blocker_flag && (
                                  <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700">Gate</span>
                                )}
                                {r.dim_readiness_item.critical_flag && !r.dim_readiness_item.opening_blocker_flag && (
                                  <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700">Critical</span>
                                )}
                              </td>
                              <td className="px-4 py-2.5 text-slate-500">{fmtDate(r.baseline_target)}</td>
                              <td className="px-4 py-2.5 text-slate-500">{fmtDate(r.forecast_target)}</td>
                              <td className="px-4 py-2.5">
                                <RAGBadge status={rag} label={statusLabel(r.status_code)} />
                              </td>
                              <td className="px-4 py-2.5 text-right font-mono text-sm">
                                {slip === 0 ? (
                                  <span className="text-green-600">On time</span>
                                ) : (
                                  <span className={slip > 0 ? 'text-red-600' : 'text-green-600'}>
                                    {slip > 0 ? `+${slip}d` : `${slip}d`}
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-2.5 text-xs text-slate-500">{r.owner_id || '—'}</td>
                              <td className="px-4 py-2.5 text-slate-500 max-w-xs truncate">
                                {r.blocked_flag && r.blocker_reason
                                  ? <span className="text-red-600 text-xs">{r.blocker_reason}</span>
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

          {blockers.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                Open Blockers
                <span className="ml-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                  {blockers.length}
                </span>
              </h2>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-2.5 text-left">Item</th>
                      <th className="px-4 py-2.5 text-left">Group</th>
                      <th className="px-4 py-2.5 text-left">Reason</th>
                      <th className="px-4 py-2.5 text-left">Dependency</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {blockers.map(r => (
                      <tr key={r.id} className="hover:bg-red-50/30">
                        <td className="px-4 py-2.5 font-medium text-slate-800">{r.dim_readiness_item.item_name}</td>
                        <td className="px-4 py-2.5 text-slate-500">{r.dim_readiness_item.readiness_group}</td>
                        <td className="px-4 py-2.5 text-slate-600 max-w-xs">{r.blocker_reason ?? '—'}</td>
                        <td className="px-4 py-2.5 text-slate-500 text-xs">
                          {r.dependency_task_id ?? r.dependency_other ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {blockers.length === 0 && rows.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
              <Utensils className="h-4 w-4 text-green-600" />
              <p className="text-sm text-green-700 font-medium">No open blockers — F&B readiness is on track</p>
            </div>
          )}

          {rows.length === 0 && (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-8">
              <div className="flex flex-col items-center text-center gap-2">
                <Clock className="h-8 w-8 text-slate-300" />
                <p className="font-medium text-slate-500">No F&B readiness data yet for {tab}</p>
                <p className="text-sm text-slate-400">F&B readiness items will appear here once the project enters pre-opening stage.</p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
