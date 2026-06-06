'use client'
import { useEffect, useState } from 'react'
import { KPICard } from '@/components/shared/KPICard'
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

  const ccy = activeProject === 'BHX' ? 'GBP' : 'EUR'
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Funding & Cash</h1>
          <p className="text-sm text-slate-500">Equity, debt facilities, and cash flow overview</p>
        </div>
        <div className="flex gap-1 rounded-lg border bg-white p-1">
          {(['MAD', 'BHX'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveProject(tab)}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                activeProject === tab ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab === 'MAD' ? 'Madrid Playa Surf' : 'Birmingham'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <p className="text-slate-400">Loading funding data...</p>
        </div>
      ) : loadError ? (
        <div className="rounded-lg border bg-white p-8 text-center">
          <h3 className="text-sm font-medium text-slate-700">No se pudo cargar</h3>
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
              className="rounded-md border px-4 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Iniciar sesión
            </a>
          </div>
        </div>
      ) : funding.length === 0 && cashFlow.length === 0 ? (
        <div className="rounded-lg border bg-white p-8 text-center">
          <p className="text-sm text-slate-500">Sin datos de financiación para este proyecto</p>
        </div>
      ) : (
        <>
          {/* KPI Row */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KPICard
              title="Total Committed"
              value={formatCompact(totalCommitted, ccy)}
              subtitle={`${funding.length} instrument${funding.length !== 1 ? 's' : ''}`}
            />
            <KPICard
              title="Drawn to Date"
              value={formatCompact(totalDrawn, ccy)}
              subtitle={formatPercent(drawnPct * 100) + ' utilized'}
              rag={drawnPct > 0.85 ? 'Amber' : 'Green'}
            />
            <KPICard
              title="Undrawn Available"
              value={formatCompact(totalUndrawn, ccy)}
              subtitle="Remaining facility"
              rag={totalUndrawn < 1_000_000 ? 'Red' : 'Green'}
            />
            <KPICard
              title="Cash Flow Lines"
              value={cashFlow.length}
              subtitle={`${quarters.length} periods tracked`}
            />
          </div>

          {/* Funding Instruments Table */}
          <div className="rounded-lg border bg-white overflow-hidden">
            <div className="px-6 py-4 border-b">
              <h3 className="text-sm font-medium text-slate-700">Funding Instruments</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-left">
                    <th className="px-4 py-3 font-medium text-slate-600">Instrument</th>
                    <th className="px-4 py-3 font-medium text-slate-600">Type</th>
                    <th className="px-4 py-3 font-medium text-slate-600 text-right">Committed</th>
                    <th className="px-4 py-3 font-medium text-slate-600 text-right">Drawn</th>
                    <th className="px-4 py-3 font-medium text-slate-600 text-right">Undrawn</th>
                    <th className="px-4 py-3 font-medium text-slate-600">Utilization</th>
                    <th className="px-4 py-3 font-medium text-slate-600">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {funding.map(row => {
                    const util = row.committed_amount > 0 ? row.drawn_to_date / row.committed_amount : 0
                    return (
                      <tr key={row.id} className="border-b hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {row.dim_funding_instrument?.instrument_name || '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                            {row.dim_funding_instrument?.instrument_type || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono">{formatCompact(row.committed_amount || 0, ccy)}</td>
                        <td className="px-4 py-3 text-right font-mono">{formatCompact(row.drawn_to_date || 0, ccy)}</td>
                        <td className="px-4 py-3 text-right font-mono">{formatCompact(row.undrawn_available || 0, ccy)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-24 rounded-full bg-slate-100 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${util > 0.85 ? 'bg-amber-500' : 'bg-green-500'}`}
                                style={{ width: `${Math.min(util * 100, 100)}%` }}
                              />
                            </div>
                            <span className="text-xs text-slate-500">{formatPercent(util * 100)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            row.cp_status === 'Met' ? 'bg-green-50 text-green-700' :
                            row.cp_status === 'Pending' ? 'bg-amber-50 text-amber-700' :
                            'bg-slate-50 text-slate-600'
                          }`}>
                            {row.cp_status || 'N/A'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Cash Flow Bar Chart (CSS-based) */}
          <div className="rounded-lg border bg-white p-6">
            <h3 className="text-sm font-medium text-slate-700 mb-4">Quarterly Cash Flow</h3>
            <div className="space-y-2">
              {quarters.map(q => {
                const d = cfByQuarter[q]
                const inflowWidth = maxAbs > 0 ? (d.inflow / maxAbs) * 100 : 0
                const outflowWidth = maxAbs > 0 ? (Math.abs(d.outflow) / maxAbs) * 100 : 0
                return (
                  <div key={q} className="flex items-center gap-3">
                    <span className="w-20 text-xs text-slate-500 font-mono shrink-0">{q}</span>
                    <div className="flex-1 flex flex-col gap-0.5">
                      <div className="h-3 rounded bg-green-400" style={{ width: `${inflowWidth}%`, minWidth: inflowWidth > 0 ? '2px' : 0 }} />
                      <div className="h-3 rounded bg-red-400" style={{ width: `${outflowWidth}%`, minWidth: outflowWidth > 0 ? '2px' : 0 }} />
                    </div>
                    <span className={`w-20 text-xs font-mono text-right ${d.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCompact(d.net, ccy)}
                    </span>
                  </div>
                )
              })}
            </div>
            <div className="flex gap-4 mt-4 text-xs text-slate-500">
              <span className="flex items-center gap-1"><span className="h-2 w-4 rounded bg-green-400" /> Inflows</span>
              <span className="flex items-center gap-1"><span className="h-2 w-4 rounded bg-red-400" /> Outflows</span>
            </div>
          </div>

          {/* Cash Flow Summary Table */}
          <div className="rounded-lg border bg-white overflow-hidden">
            <div className="px-6 py-4 border-b">
              <h3 className="text-sm font-medium text-slate-700">Cash Flow Summary by Category</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-left">
                    <th className="px-4 py-3 font-medium text-slate-600">Category</th>
                    <th className="px-4 py-3 font-medium text-slate-600 text-right">Actuals</th>
                    <th className="px-4 py-3 font-medium text-slate-600 text-right">Forecast</th>
                    <th className="px-4 py-3 font-medium text-slate-600 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {keyCats.filter(cat => cfSummary[cat]).map(cat => {
                    const d = cfSummary[cat]
                    const total = d.actual + d.forecast
                    return (
                      <tr key={cat} className="border-b hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-900">{cat}</td>
                        <td className={`px-4 py-3 text-right font-mono ${d.actual >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCompact(d.actual, ccy)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-slate-500">
                          {formatCompact(d.forecast, ccy)}
                        </td>
                        <td className={`px-4 py-3 text-right font-mono font-medium ${total >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                          {formatCompact(total, ccy)}
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
