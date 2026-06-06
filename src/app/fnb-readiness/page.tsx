'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { cn, type RAGColor } from '@/lib/utils'
import { KPICard } from '@/components/shared/KPICard'
import { PageHeader, RagChip, RagDot, projectAccent } from '@/components/shared/terminal'
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
    case 'NS': return 'Sin iniciar'
    case 'IP': return 'En curso'
    case 'BL': return 'Bloqueado'
    case 'DL': return 'Retrasado'
    case 'CP': return 'Completado'
    case 'AT': return 'En riesgo'
    default: return code
  }
}

function fmtDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: '2-digit' })
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

  if (error) throw error
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
  const [loadError, setLoadError] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setLoadError(false)
      try {
        const data = await fetchReadiness(tab)
        if (cancelled) return
        setRows(data)
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
      <PageHeader
        title="Preparación F&B"
        subtitle="Checklist de pre-apertura · restauración, carta, plantilla y proveedores"
        right={
          <div className="flex rounded-lg bg-slate-800/60 p-1 gap-1">
            {(['MAD', 'BHX'] as const).map(p => (
              <button
                key={p}
                type="button"
                onClick={() => setTab(p)}
                className={cn(
                  'rounded-md px-4 py-1.5 font-mono text-xs font-bold tracking-wide transition-colors',
                  tab === p ? 'text-white shadow' : 'text-slate-400 hover:text-slate-200'
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
          <p className="font-mono text-xs text-slate-500">Cargando…</p>
        </div>
      ) : loadError ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-8 shadow-sm">
          <div className="flex flex-col items-center text-center gap-3">
            <AlertTriangle className="h-8 w-8 text-amber-500" />
            <div>
              <p className="font-medium text-slate-700">No se pudo cargar — la sesión pudo expirar</p>
              <p className="text-sm text-slate-500 mt-1">Vuelve a intentarlo o inicia sesión de nuevo.</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setReloadKey(k => k + 1)}
                className="rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-700 transition-colors"
              >
                Reintentar
              </button>
              <a
                href="/login"
                className="rounded-md border border-slate-300 bg-white px-4 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Iniciar sesión
              </a>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <KPICard
              title="Preparación global"
              value={`${overallScore}%`}
              subtitle={`${complete} de ${total} ítems completados`}
              rag={overallScore >= 80 ? 'Green' : overallScore >= 50 ? 'Amber' : 'Red'}
            />
            <KPICard
              title="Completados"
              value={complete}
              subtitle={`${total - complete} aún abiertos`}
              rag={complete === total ? 'Green' : 'Grey'}
            />
            <KPICard
              title="Bloqueados"
              value={blocked}
              subtitle="ítems con bloqueantes activos"
              rag={blocked === 0 ? 'Green' : blocked <= 2 ? 'Amber' : 'Red'}
            />
            <KPICard
              title="Bloqueantes de apertura"
              value={openingBlockers}
              subtitle="ítems críticos sin completar"
              rag={openingBlockers === 0 ? 'Green' : openingBlockers <= 2 ? 'Amber' : 'Red'}
            />
          </div>

          {groups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <CheckCircle className="mb-2 h-8 w-8 opacity-40" />
              <p className="text-sm">No hay ítems de preparación F&B para este proyecto</p>
            </div>
          ) : (
            <div className="space-y-4">
              {groups.map(([group, items]) => {
                const gRAG = worstRAG(items.map(r => statusToRAG(r.status_code, r.blocked_flag)))
                const gScore = groupScore(items)
                return (
                  <div key={group} className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                    <div className="flex items-center gap-3 bg-slate-50 px-4 py-2.5 border-b border-slate-200">
                      <RagDot status={gRAG} />
                      <span className="font-semibold text-slate-700 text-sm">{group}</span>
                      <div className="ml-2 flex items-center gap-1.5 flex-1">
                        <div className="h-1.5 w-20 rounded-full bg-slate-200 overflow-hidden">
                          <div
                            className={cn('h-full rounded-full', gScore >= 80 ? 'bg-green-500' : gScore >= 50 ? 'bg-amber-400' : 'bg-red-400')}
                            style={{ width: `${gScore}%` }}
                          />
                        </div>
                        <span className="font-mono text-xs font-semibold text-slate-600 tabular-nums">{gScore}%</span>
                      </div>
                      <span className="ml-auto font-mono text-xs text-slate-400 tabular-nums">{items.length} ítem{items.length !== 1 ? 's' : ''}</span>
                    </div>
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-4 py-2 text-left font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">Ítem</th>
                          <th className="px-4 py-2 text-left font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">Línea base</th>
                          <th className="px-4 py-2 text-left font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">Previsión</th>
                          <th className="px-4 py-2 text-left font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">Estado</th>
                          <th className="px-4 py-2 text-right font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">Desvío</th>
                          <th className="px-4 py-2 text-left font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">Responsable</th>
                          <th className="px-4 py-2 text-left font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">Bloqueante</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map(r => {
                          const rag = statusToRAG(r.status_code, r.blocked_flag)
                          const slip = slipDays(r.baseline_target, r.forecast_target)
                          return (
                            <tr key={r.id} className="odd:bg-slate-50/30 hover:bg-slate-50">
                              <td className="px-4 py-2.5 text-slate-800">
                                <span>{r.dim_readiness_item.item_name}</span>
                                {r.dim_readiness_item.opening_blocker_flag && (
                                  <span className="ml-2 rounded-[2px] bg-red-100 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide text-red-700">Apertura</span>
                                )}
                                {r.dim_readiness_item.critical_flag && !r.dim_readiness_item.opening_blocker_flag && (
                                  <span className="ml-2 rounded-[2px] bg-amber-100 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide text-amber-700">Crítico</span>
                                )}
                              </td>
                              <td className="px-4 py-2.5 font-mono tabular-nums text-slate-600">{fmtDate(r.baseline_target)}</td>
                              <td className="px-4 py-2.5 font-mono tabular-nums text-slate-600">{fmtDate(r.forecast_target)}</td>
                              <td className="px-4 py-2.5">
                                <RagChip status={rag} label={statusLabel(r.status_code)} />
                              </td>
                              <td className="px-4 py-2.5 text-right font-mono tabular-nums text-sm">
                                {slip === 0 ? (
                                  <span className="text-green-600">En plazo</span>
                                ) : (
                                  <span className={slip > 0 ? 'text-red-600' : 'text-green-600'}>
                                    {slip > 0 ? `+${slip}d` : `${slip}d`}
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-2.5 text-xs text-slate-600">{r.owner_id || 'Sin asignar'}</td>
                              <td className="px-4 py-2.5 text-slate-600 max-w-xs truncate">
                                {r.blocked_flag && r.blocker_reason
                                  ? <span className="text-red-600 text-xs">{r.blocker_reason}</span>
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

          {blockers.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                Bloqueantes abiertos
                <span className="ml-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                  {blockers.length}
                </span>
              </h2>
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-2.5 text-left font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">Ítem</th>
                      <th className="px-4 py-2.5 text-left font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">Grupo</th>
                      <th className="px-4 py-2.5 text-left font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">Motivo</th>
                      <th className="px-4 py-2.5 text-left font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">Dependencia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {blockers.map(r => (
                      <tr key={r.id} className="odd:bg-slate-50/30 hover:bg-red-50/30">
                        <td className="px-4 py-2.5 font-medium text-slate-800">{r.dim_readiness_item.item_name}</td>
                        <td className="px-4 py-2.5 text-slate-600">{r.dim_readiness_item.readiness_group}</td>
                        <td className="px-4 py-2.5 text-slate-600 max-w-xs">{r.blocker_reason ?? '—'}</td>
                        <td className="px-4 py-2.5 text-slate-600 text-xs">
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
            <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 shadow-sm">
              <Utensils className="h-4 w-4 text-green-600" />
              <p className="text-sm text-green-700 font-medium">Sin bloqueantes — preparación F&B en curso</p>
            </div>
          )}

          {rows.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8">
              <div className="flex flex-col items-center text-center gap-2">
                <Clock className="h-8 w-8 text-slate-400" />
                <p className="font-medium text-slate-600">Sin datos de preparación F&B para {tab}</p>
                <p className="text-sm text-slate-500">Los ítems de preparación F&B aparecerán aquí cuando el proyecto entre en fase de pre-apertura.</p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
