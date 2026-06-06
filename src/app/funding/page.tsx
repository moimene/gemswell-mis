'use client'
import { useEffect, useState } from 'react'
import { KPICard } from '@/components/shared/KPICard'
import { PageHeader, RagChip, projectAccent } from '@/components/shared/terminal'
import { getCashFlowByProject, getFundingByProject } from '@/lib/queries-financial'
import { formatCompact, formatPercent } from '@/lib/utils'

type FundingRow = {
  id: string
  project_id: string
  committed_amount: number
  drawn_to_date: number
  undrawn_available: number
  accrued_fees_interest: number
  cp_status: string | null
  covenant_overall_status: string | null
  comment: string | null
  dim_funding_instrument: {
    instrument_name: string
    instrument_type: string
    currency: string
    facility_limit: number
  } | null
}

type CashFlowRow = {
  id: string
  project_id: string
  week_start: string
  cash_line_category: string
  cash_flow_type: string
  amount_eur: number
  confidence_level: string
}

type ProjectTab = 'MAD' | 'BHX'

export default function FundingPage() {
  const [activeProject, setActiveProject] = useState<ProjectTab>('MAD')
  const [funding, setFunding] = useState<FundingRow[]>([])
  const [cashFlow, setCashFlow] = useState<CashFlowRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setLoadError(false)
      try {
        const [fundingData, cfData] = await Promise.all([
          getFundingByProject(activeProject),
          getCashFlowByProject(activeProject)
        ])
        if (cancelled) return
        setFunding(fundingData as FundingRow[])
        setCashFlow(cfData as CashFlowRow[])
      } catch (e) {
        if (cancelled) return
        console.error(e)
        setLoadError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [activeProject, reloadKey])

  // Per-instrument currency drives every figure; aggregate KPIs/cash flow use the
  // project's predominant currency (BHX = mixed EUR + one GBP grant → fall back to EUR).
  const aggCcy = 'EUR'
  const totalCommitted = funding.reduce((s, r) => s + (r.committed_amount || 0), 0)
  const totalDrawn = funding.reduce((s, r) => s + (r.drawn_to_date || 0), 0)
  const totalUndrawn = funding.reduce((s, r) => s + (r.undrawn_available || 0), 0)
  const drawnPct = totalCommitted > 0 ? totalDrawn / totalCommitted : 0

  // Aggregate cash flow by quarter for chart
  const cfByQuarter = cashFlow.reduce<Record<string, { inflow: number; outflow: number; net: number }>>((acc, row) => {
    const d = new Date(row.week_start)
    const q = `${d.getFullYear()} Q${Math.ceil((d.getMonth() + 1) / 3)}`
    if (!acc[q]) acc[q] = { inflow: 0, outflow: 0, net: 0 }
    if (row.amount_eur > 0) acc[q].inflow += row.amount_eur
    else acc[q].outflow += row.amount_eur
    acc[q].net += row.amount_eur
    return acc
  }, {})

  const quarters = Object.keys(cfByQuarter).sort()
  const maxAbs = Math.max(...quarters.map(q => Math.max(cfByQuarter[q].inflow, Math.abs(cfByQuarter[q].outflow), 1)))

  // Key cash flow categories for summary table
  const keyCats = ['Total CapEx', 'Total Revenue', 'Total NOI', 'Debt Drawdown', 'Debt Repayment',
    'Levered CF After Tax', 'Capital Call CF', 'Interest Payment']
  const cfSummary = cashFlow.reduce<Record<string, { actual: number; forecast: number }>>((acc, row) => {
    if (!keyCats.includes(row.cash_line_category)) return acc
    if (!acc[row.cash_line_category]) acc[row.cash_line_category] = { actual: 0, forecast: 0 }
    if (row.confidence_level === 'Actual') acc[row.cash_line_category].actual += row.amount_eur
    else acc[row.cash_line_category].forecast += row.amount_eur
    return acc
  }, {})

  const accent = projectAccent(activeProject)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Financiación y caja"
        subtitle="Equity, líneas de deuda y visión de cash flow"
        eyebrow="Financiación y caja · MIS"
        right={
          <div className="flex gap-1 rounded-lg border border-slate-700 bg-slate-800 p-1">
            {(['MAD', 'BHX'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveProject(tab)}
                className={`rounded-md px-4 py-1.5 font-mono text-xs font-bold uppercase tracking-wide transition-colors ${
                  activeProject === tab ? 'text-white' : 'text-slate-300 hover:bg-slate-700'
                }`}
                style={activeProject === tab ? { backgroundColor: projectAccent(tab) } : undefined}
              >
                {tab === 'MAD' ? 'Madrid Playa Surf' : 'Birmingham'}
              </button>
            ))}
          </div>
        }
      />

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="space-y-2 text-center">
            <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
            <p className="font-mono text-xs text-slate-500">Cargando datos de financiación…</p>
          </div>
        </div>
      ) : loadError ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center shadow-sm">
          <h3 className="text-base font-semibold text-slate-700">No se pudo cargar</h3>
          <p className="mt-1 text-sm text-slate-500">
            La sesión pudo expirar. Reintenta o inicia sesión de nuevo.
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <button
              onClick={() => setReloadKey(k => k + 1)}
              className="rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
            >
              Reintentar
            </button>
            <a
              href="/login"
              className="rounded-md border border-slate-200 px-4 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Iniciar sesión
            </a>
          </div>
        </div>
      ) : funding.length === 0 && cashFlow.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center shadow-sm">
          <p className="text-sm text-slate-600">Sin datos de financiación para este proyecto</p>
        </div>
      ) : (
        <>
          {/* KPI Row */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KPICard
              title="Comprometido total"
              value={formatCompact(totalCommitted, aggCcy)}
              subtitle={`${funding.length} instrumento${funding.length !== 1 ? 's' : ''}`}
            />
            <KPICard
              title="Dispuesto a fecha"
              value={formatCompact(totalDrawn, aggCcy)}
              subtitle={formatPercent(drawnPct * 100) + ' dispuesto'}
              rag={drawnPct > 0.85 ? 'Amber' : 'Green'}
            />
            <KPICard
              title="Disponible no dispuesto"
              value={formatCompact(totalUndrawn, aggCcy)}
              subtitle="Facilidad restante"
              rag={totalUndrawn < 1_000_000 ? 'Red' : 'Green'}
            />
            <KPICard
              title="Líneas de cash flow"
              value={cashFlow.length}
              subtitle={`${quarters.length} periodos seguidos`}
            />
          </div>

          {/* Funding Instruments Table */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-4 py-3">
              <h3 className="font-mono text-[11px] font-bold uppercase tracking-widest text-slate-500">Instrumentos de financiación</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-left">
                    <th className="px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">Instrumento</th>
                    <th className="px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">Tipo</th>
                    <th className="px-4 py-3 text-right font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">Comprometido</th>
                    <th className="px-4 py-3 text-right font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">Dispuesto</th>
                    <th className="px-4 py-3 text-right font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">No dispuesto</th>
                    <th className="px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">Utilización</th>
                    <th className="px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {funding.map(row => {
                    const util = row.committed_amount > 0 ? row.drawn_to_date / row.committed_amount : 0
                    const rowCcy = row.dim_funding_instrument?.currency || 'EUR'
                    const cpStatus: 'Green' | 'Amber' | 'Grey' =
                      row.cp_status === 'Met' ? 'Green' : row.cp_status === 'Pending' ? 'Amber' : 'Grey'
                    const cpLabel = row.cp_status === 'Met' ? 'Cumplido' : row.cp_status === 'Pending' ? 'Pendiente' : 'N/D'
                    return (
                      <tr key={row.id} className="border-b border-slate-100 odd:bg-slate-50/30 hover:bg-slate-50">
                        <td className="px-4 py-2.5 font-medium text-slate-900">
                          {row.dim_funding_instrument?.instrument_name || '—'}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="inline-flex items-center rounded-[2px] bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide text-slate-600">
                            {row.dim_funding_instrument?.instrument_type || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-xs tabular-nums">{formatCompact(row.committed_amount || 0, rowCcy)}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-xs tabular-nums">{formatCompact(row.drawn_to_date || 0, rowCcy)}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-xs tabular-nums">{formatCompact(row.undrawn_available || 0, rowCcy)}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{ width: `${Math.min(util * 100, 100)}%`, backgroundColor: accent }}
                              />
                            </div>
                            <span className="font-mono text-xs tabular-nums text-slate-600">{formatPercent(util * 100)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <RagChip status={cpStatus} label={cpLabel} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Cash Flow Bar Chart (CSS-based) */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="mb-4 font-mono text-[11px] font-bold uppercase tracking-widest text-slate-500">Cash flow trimestral</h3>
            <div className="space-y-2">
              {quarters.map(q => {
                const d = cfByQuarter[q]
                const inflowWidth = maxAbs > 0 ? (d.inflow / maxAbs) * 100 : 0
                const outflowWidth = maxAbs > 0 ? (Math.abs(d.outflow) / maxAbs) * 100 : 0
                return (
                  <div key={q} className="flex items-center gap-3">
                    <span className="w-20 shrink-0 font-mono text-xs text-slate-600">{q}</span>
                    <div className="flex flex-1 flex-col gap-0.5">
                      <div className="h-2.5 rounded-full bg-green-600" style={{ width: `${inflowWidth}%`, minWidth: inflowWidth > 0 ? '2px' : 0 }} />
                      <div className="h-2.5 rounded-full bg-red-600" style={{ width: `${outflowWidth}%`, minWidth: outflowWidth > 0 ? '2px' : 0 }} />
                    </div>
                    <span className={`w-20 text-right font-mono text-xs tabular-nums ${d.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCompact(d.net, aggCcy)}
                    </span>
                  </div>
                )
              })}
            </div>
            <div className="mt-4 flex gap-4 font-mono text-xs text-slate-500">
              <span className="flex items-center gap-1"><span className="h-2 w-4 rounded-full bg-green-600" /> Entradas</span>
              <span className="flex items-center gap-1"><span className="h-2 w-4 rounded-full bg-red-600" /> Salidas</span>
            </div>
          </div>

          {/* Cash Flow Summary Table */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-4 py-3">
              <h3 className="font-mono text-[11px] font-bold uppercase tracking-widest text-slate-500">Resumen de cash flow por categoría</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-left">
                    <th className="px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">Categoría</th>
                    <th className="px-4 py-3 text-right font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">Reales</th>
                    <th className="px-4 py-3 text-right font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">Previsión</th>
                    <th className="px-4 py-3 text-right font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {keyCats.filter(cat => cfSummary[cat]).map(cat => {
                    const d = cfSummary[cat]
                    const total = d.actual + d.forecast
                    return (
                      <tr key={cat} className="border-b border-slate-100 odd:bg-slate-50/30 hover:bg-slate-50">
                        <td className="px-4 py-2.5 font-medium text-slate-900">{cat}</td>
                        <td className={`px-4 py-2.5 text-right font-mono text-xs tabular-nums ${d.actual >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCompact(d.actual, aggCcy)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-xs tabular-nums text-slate-500">
                          {formatCompact(d.forecast, aggCcy)}
                        </td>
                        <td className={`px-4 py-2.5 text-right font-mono text-xs font-medium tabular-nums ${total >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                          {formatCompact(total, aggCcy)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
