'use client'
import { useEffect, useState } from 'react'
import { KPICard } from '@/components/shared/KPICard'
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

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [capexRows, capexSummary] = await Promise.all([
        getCapexByProject(activeProject),
        getCapexSummary()
      ])
      setRows(capexRows as CapexRow[])
      setSummary(capexSummary)
      setLoading(false)
    }
    load()
  }, [activeProject])

  const proj = summary[activeProject]
  const variancePct = proj ? (proj.eac - proj.budget) / proj.budget : 0
  const spentPct = proj ? proj.paid / proj.budget : 0
  const committedPct = proj ? proj.committed / proj.budget : 0
  const ccy = activeProject === 'BHX' ? 'GBP' : 'EUR'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">BP & Budget — CapEx Monitoring</h1>
          <p className="text-sm text-slate-500">Variance analysis: Budget vs Actuals vs Forecast</p>
        </div>
        <div className="flex gap-1 rounded-lg border bg-white p-1">
          {(['MAD', 'BHX'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveProject(tab)}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                activeProject === tab
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab === 'MAD' ? 'Madrid Playa Surf' : 'Birmingham'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <p className="text-slate-400">Loading CapEx data...</p>
        </div>
      ) : (
        <>
          {/* KPI Row */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <KPICard
              title="Total Budget"
              value={formatCompact(proj?.budget || 0, ccy)}
              subtitle="Baseline approved"
            />
            <KPICard
              title="Committed"
              value={formatPercent(committedPct * 100)}
              subtitle={formatCompact(proj?.committed || 0, ccy)}
              rag={committedPct > 0.9 ? 'Amber' : 'Green'}
            />
            <KPICard
              title="Paid to Date"
              value={formatPercent(spentPct * 100)}
              subtitle={formatCompact(proj?.paid || 0, ccy)}
            />
            <KPICard
              title="EAC Variance"
              value={formatPercent(Math.abs(variancePct) * 100)}
              subtitle={variancePct > 0 ? 'Over budget' : variancePct < 0 ? 'Under budget' : 'On track'}
              rag={variancePct > 0.05 ? 'Red' : variancePct > 0.02 ? 'Amber' : 'Green'}
            />
            <KPICard
              title="Contingency Left"
              value={formatCompact(
                rows.reduce((s, r) => s + (r.contingency_allocated || 0), 0) -
                rows.reduce((s, r) => s + (r.contingency_used || 0), 0),
                ccy
              )}
              subtitle="Remaining buffer"
            />
          </div>

          {/* Budget Progress Bar */}
          <div className="rounded-lg border bg-white p-6">
            <h3 className="text-sm font-medium text-slate-700 mb-3">Budget Execution Progress</h3>
            <div className="relative h-8 w-full rounded-full bg-slate-100 overflow-hidden">
              <div
                className="absolute left-0 top-0 h-full bg-green-500 transition-all duration-500"
                style={{ width: `${Math.min(spentPct * 100, 100)}%` }}
              />
              <div
                className="absolute left-0 top-0 h-full bg-green-300 opacity-40 transition-all duration-500"
                style={{ width: `${Math.min(committedPct * 100, 100)}%` }}
              />
            </div>
            <div className="flex justify-between mt-2 text-xs text-slate-500">
              <span>Paid: {formatPercent(spentPct * 100)}</span>
              <span>Committed: {formatPercent(committedPct * 100)}</span>
              <span>Budget: {formatCurrency(proj?.budget || 0, ccy)}</span>
            </div>
          </div>

          {/* Category Detail Table */}
          <div className="rounded-lg border bg-white overflow-hidden">
            <div className="px-6 py-4 border-b">
              <h3 className="text-sm font-medium text-slate-700">CapEx by Category</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-left">
                    <th className="px-4 py-3 font-medium text-slate-600">Category</th>
                    <th className="px-4 py-3 font-medium text-slate-600">Type</th>
                    <th className="px-4 py-3 font-medium text-slate-600 text-right">Budget</th>
                    <th className="px-4 py-3 font-medium text-slate-600 text-right">Approved</th>
                    <th className="px-4 py-3 font-medium text-slate-600 text-right">Committed</th>
                    <th className="px-4 py-3 font-medium text-slate-600 text-right">Paid</th>
                    <th className="px-4 py-3 font-medium text-slate-600 text-right">EAC</th>
                    <th className="px-4 py-3 font-medium text-slate-600 text-right">Variance</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => {
                    const variance = ((row.eac || 0) - (row.budget_baseline || 0)) / (row.budget_baseline || 1)
                    return (
                      <tr key={row.id} className="border-b hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {row.dim_capex_category?.category_name || '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                            {row.dim_capex_category?.category_type || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-slate-700">
                          {formatCompact(row.budget_baseline || 0, ccy)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-slate-700">
                          {formatCompact(row.budget_approved_current || 0, ccy)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-slate-700">
                          {formatCompact(row.committed_amount || 0, ccy)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-slate-700">
                          {formatCompact(row.paid_amount || 0, ccy)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-slate-700">
                          {formatCompact(row.eac || 0, ccy)}
                        </td>
                        <td className={`px-4 py-3 text-right font-mono font-medium ${varianceColor(variance)}`}>
                          {variance > 0 ? '+' : ''}{formatPercent(variance * 100)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 font-semibold">
                    <td className="px-4 py-3" colSpan={2}>TOTAL</td>
                    <td className="px-4 py-3 text-right font-mono">{formatCompact(proj?.budget || 0, ccy)}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatCompact(proj?.approved || 0, ccy)}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatCompact(proj?.committed || 0, ccy)}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatCompact(proj?.paid || 0, ccy)}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatCompact(proj?.eac || 0, ccy)}</td>
                    <td className={`px-4 py-3 text-right font-mono font-medium ${varianceColor(variancePct)}`}>
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
