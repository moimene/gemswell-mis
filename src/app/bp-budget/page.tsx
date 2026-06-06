'use client'
import { useEffect, useState } from 'react'
import { KPICard } from '@/components/shared/KPICard'
import { PageHeader, projectAccent } from '@/components/shared/terminal'
import { getCapexByProject, getCapexSummary } from '@/lib/queries-financial'
import { formatCurrency, formatCompact, formatPercent, varianceColor } from '@/lib/utils'

type CapexRow = {
  id: string
  project_id: string
  budget_baseline: number
  budget_approved_current: number
  committed_amount: number
  invoiced_amount: number
  paid_amount: number
  eac: number
  contingency_allocated: number
  contingency_used: number
  variance_reason: string | null
  dim_capex_category: { category_name: string; category_type: string } | null
}

type ProjectTab = 'MAD' | 'BHX'

export default function BPBudgetPage() {
  const [activeProject, setActiveProject] = useState<ProjectTab>('MAD')
  const [rows, setRows] = useState<CapexRow[]>([])
  const [summary, setSummary] = useState<Record<string, { budget: number; approved: number; committed: number; invoiced: number; paid: number; eac: number }>>({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  async function load() {
    setLoading(true)
    setLoadError(false)
    try {
      const [capexRows, capexSummary] = await Promise.all([
        getCapexByProject(activeProject),
        getCapexSummary()
      ])
      setRows(capexRows as CapexRow[])
      setSummary(capexSummary)
    } catch (e) {
      console.error(e)
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    load().catch(() => {
      if (!cancelled) {
        setLoadError(true)
        setLoading(false)
      }
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProject])

  const proj = summary[activeProject]
  const variancePct = proj && proj.budget > 0 ? (proj.eac - proj.budget) / proj.budget : 0
  const spentPct = proj && proj.budget > 0 ? proj.paid / proj.budget : 0
  const committedPct = proj && proj.budget > 0 ? proj.committed / proj.budget : 0
  const ccy = 'EUR'

  const projectTabs = (
    <div className="flex gap-1 rounded-lg bg-slate-800/60 p-1">
      {(['MAD', 'BHX'] as const).map(tab => (
        <button
          key={tab}
          onClick={() => setActiveProject(tab)}
          className={`rounded-md px-3 py-1 font-mono text-xs font-bold tracking-wide transition-colors ${
            activeProject === tab ? 'text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
          style={activeProject === tab ? { backgroundColor: projectAccent(tab) } : undefined}
        >
          {tab}
        </button>
      ))}
    </div>
  )

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title="Presupuesto & CapEx — Seguimiento"
        subtitle="Análisis de desviación: presupuesto vs. real vs. previsión"
        right={projectTabs}
      />

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="space-y-2 text-center">
            <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
            <p className="font-mono text-xs text-slate-500">Cargando datos de CapEx...</p>
          </div>
        </div>
      ) : loadError ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-medium text-slate-900">No se pudo cargar</h3>
          <p className="mt-1 text-sm text-slate-500">La sesión pudo expirar. Vuelve a intentarlo o inicia sesión de nuevo.</p>
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={() => { load() }}
              className="rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-slate-700"
            >
              Reintentar
            </button>
            <a href="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900">
              Iniciar sesión
            </a>
          </div>
        </div>
      ) : (
        <>
          {/* KPI Row */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <KPICard
              title="Presupuesto total"
              value={formatCompact(proj?.budget || 0, ccy)}
              subtitle="Línea base aprobada"
            />
            <KPICard
              title="Comprometido"
              value={formatPercent(committedPct * 100)}
              subtitle={formatCompact(proj?.committed || 0, ccy)}
              rag={committedPct > 0.9 ? 'Amber' : 'Green'}
            />
            <KPICard
              title="Pagado a la fecha"
              value={formatPercent(spentPct * 100)}
              subtitle={formatCompact(proj?.paid || 0, ccy)}
            />
            <KPICard
              title="Desvío EAC"
              value={formatPercent(Math.abs(variancePct) * 100)}
              subtitle={variancePct > 0 ? 'Sobre presupuesto' : variancePct < 0 ? 'Bajo presupuesto' : 'En objetivo'}
              rag={variancePct > 0.05 ? 'Red' : variancePct > 0.02 ? 'Amber' : 'Green'}
            />
            <KPICard
              title="Contingencia restante"
              value={formatCompact(
                rows.reduce((s, r) => s + (r.contingency_allocated || 0), 0) -
                rows.reduce((s, r) => s + (r.contingency_used || 0), 0),
                ccy
              )}
              subtitle="Colchón disponible"
            />
          </div>

          {/* Budget Progress Bar */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="mb-3 font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">Ejecución del presupuesto</h3>
            <div className="relative h-8 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="absolute left-0 top-0 h-full opacity-30 transition-all duration-500"
                style={{ width: `${Math.min(committedPct * 100, 100)}%`, backgroundColor: projectAccent(activeProject) }}
              />
              <div
                className="absolute left-0 top-0 h-full transition-all duration-500"
                style={{ width: `${Math.min(spentPct * 100, 100)}%`, backgroundColor: projectAccent(activeProject) }}
              />
            </div>
            <div className="mt-2 flex justify-between text-xs text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: projectAccent(activeProject) }} />
                Pagado: {formatPercent(spentPct * 100)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full opacity-30" style={{ backgroundColor: projectAccent(activeProject) }} />
                Comprometido: {formatPercent(committedPct * 100)}
              </span>
              <span>Presupuesto: {formatCurrency(proj?.budget || 0, ccy)}</span>
            </div>
          </div>

          {/* Category Detail Table */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-4">
              <h3 className="font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">CapEx por categoría</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left">
                    <th className="px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">Categoría</th>
                    <th className="px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">Tipo</th>
                    <th className="px-4 py-3 text-right font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">Presupuesto</th>
                    <th className="px-4 py-3 text-right font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">Aprobado</th>
                    <th className="px-4 py-3 text-right font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">Comprometido</th>
                    <th className="px-4 py-3 text-right font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">Pagado</th>
                    <th className="px-4 py-3 text-right font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">EAC</th>
                    <th className="px-4 py-3 text-right font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">Desvío</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => {
                    const variance = ((row.eac || 0) - (row.budget_baseline || 0)) / (row.budget_baseline || 1)
                    return (
                      <tr key={row.id} className="border-b border-slate-100 odd:bg-slate-50/30 transition-colors hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {row.dim_capex_category?.category_name || '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                            {row.dim_capex_category?.category_type || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-700">
                          {formatCompact(row.budget_baseline || 0, ccy)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-700">
                          {formatCompact(row.budget_approved_current || 0, ccy)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-700">
                          {formatCompact(row.committed_amount || 0, ccy)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-700">
                          {formatCompact(row.paid_amount || 0, ccy)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-700">
                          {formatCompact(row.eac || 0, ccy)}
                        </td>
                        <td className={`px-4 py-3 text-right font-mono tabular-nums font-medium ${varianceColor(variance)}`}>
                          {variance > 0 ? '+' : ''}{formatPercent(variance * 100)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 font-semibold">
                    <td className="px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-widest text-slate-500" colSpan={2}>Total</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">{formatCompact(proj?.budget || 0, ccy)}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">{formatCompact(proj?.approved || 0, ccy)}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">{formatCompact(proj?.committed || 0, ccy)}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">{formatCompact(proj?.paid || 0, ccy)}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">{formatCompact(proj?.eac || 0, ccy)}</td>
                    <td className={`px-4 py-3 text-right font-mono tabular-nums font-medium ${varianceColor(variancePct)}`}>
                      {variancePct > 0 ? '+' : ''}{formatPercent(variancePct * 100)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
