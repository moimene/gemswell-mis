'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { getCapexSummary, getCashFlowSummary } from '@/lib/queries-financial'
import { formatCompact, formatPercent, type RAGColor, ragColorMap } from '@/lib/utils'

type Project = {
  project_id: string
  project_name: string
  city: string
  country: string
  stage: string
  status_rag: RAGColor
  opening_target: string
  total_capex_budget: number
  target_irr: number
  currency: string
}

export default function PortfolioPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [capex, setCapex] = useState<Record<string, { budget: number; approved: number; committed: number; invoiced: number; paid: number; eac: number }>>({})
  const [cashFlow, setCashFlow] = useState<Record<string, { totalInflow: number; totalOutflow: number; actualInflow: number; actualOutflow: number }>>({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  async function load() {
    setLoadError(false)
    setLoading(true)
    try {
      const supabase = createClient()
      const [{ data, error }, capexData, cfData] = await Promise.all([
        supabase.from('dim_project').select('*').eq('active', true),
        getCapexSummary(),
        getCashFlowSummary()
      ])
      if (error) throw error
      setProjects(data || [])
      setCapex(capexData)
      setCashFlow(cfData)
    } catch (e) {
      console.error(e)
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-slate-400">Loading portfolio...</p></div>

  if (loadError) return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Portfolio Overview</h1>
        <p className="text-sm text-slate-500">Side-by-side comparison of all wave park projects</p>
      </div>
      <div className="rounded-lg border bg-white p-6">
        <p className="text-sm font-medium text-slate-900">No se pudo cargar el portfolio.</p>
        <p className="mt-1 text-sm text-slate-500">La sesión pudo expirar. Reintenta o inicia sesión de nuevo.</p>
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={() => load()}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Reintentar
          </button>
          <a href="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900">
            Iniciar sesión
          </a>
        </div>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Portfolio Overview</h1>
        <p className="text-sm text-slate-500">Side-by-side comparison of all wave park projects</p>
      </div>

      {/* Comparison Table */}
      <div className="rounded-lg border bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50">
                <th className="px-4 py-3 text-left font-medium text-slate-600">Metric</th>
                {projects.map(p => (
                  <th key={p.project_id} className="px-4 py-3 text-right font-medium text-slate-600">
                    <div className="flex items-center justify-end gap-2">
                      <span>{p.project_name}</span>
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: ragColorMap[p.status_rag as RAGColor] || '#A6A6A6' }} />
                    </div>
                    <p className="text-xs font-normal text-slate-400">{p.city}, {p.country}</p>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Stage & Timeline */}
              <tr className="border-b bg-slate-25">
                <td className="px-4 py-2 font-medium text-slate-500 text-xs uppercase tracking-wide" colSpan={1 + projects.length}>
                  Project Status
                </td>
              </tr>
              <tr className="border-b hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-700">Stage</td>
                {projects.map(p => (
                  <td key={p.project_id} className="px-4 py-3 text-right font-medium">{p.stage}</td>
                ))}
              </tr>
              <tr className="border-b hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-700">Opening Target</td>
                {projects.map(p => (
                  <td key={p.project_id} className="px-4 py-3 text-right">
                    {new Date(p.opening_target).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                  </td>
                ))}
              </tr>
              <tr className="border-b hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-700">Currency</td>
                {projects.map(p => (
                  <td key={p.project_id} className="px-4 py-3 text-right font-mono">{p.currency || (p.project_id === 'BHX' ? 'GBP' : 'EUR')}</td>
                ))}
              </tr>

              {/* CapEx */}
              <tr className="border-b bg-slate-25">
                <td className="px-4 py-2 font-medium text-slate-500 text-xs uppercase tracking-wide" colSpan={1 + projects.length}>
                  Capital Expenditure
                </td>
              </tr>
              {[
                { label: 'Budget Baseline', key: 'budget' as const },
                { label: 'Budget Approved', key: 'approved' as const },
                { label: 'Committed', key: 'committed' as const },
                { label: 'Paid to Date', key: 'paid' as const },
                { label: 'EAC', key: 'eac' as const },
              ].map(({ label, key }) => (
                <tr key={key} className="border-b hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-700">{label}</td>
                  {projects.map(p => {
                    const ccy = p.project_id === 'BHX' ? 'GBP' : 'EUR'
                    const val = capex[p.project_id]?.[key] || 0
                    return (
                      <td key={p.project_id} className="px-4 py-3 text-right font-mono text-slate-900">
                        {formatCompact(val, ccy)}
                      </td>
                    )
                  })}
                </tr>
              ))}
              <tr className="border-b hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-700">Execution %</td>
                {projects.map(p => {
                  const pct = capex[p.project_id] ? capex[p.project_id].paid / capex[p.project_id].budget : 0
                  return (
                    <td key={p.project_id} className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="h-2 w-16 rounded-full bg-slate-100 overflow-hidden">
                          <div className="h-full bg-green-500" style={{ width: `${Math.min(pct * 100, 100)}%` }} />
                        </div>
                        <span className="font-mono text-slate-700">{formatPercent(pct * 100)}</span>
                      </div>
                    </td>
                  )
                })}
              </tr>
              <tr className="border-b hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-700">EAC Variance</td>
                {projects.map(p => {
                  const v = capex[p.project_id] ? (capex[p.project_id].eac - capex[p.project_id].budget) / capex[p.project_id].budget : 0
                  return (
                    <td key={p.project_id} className={`px-4 py-3 text-right font-mono font-medium ${v > 0.02 ? 'text-red-600' : v < -0.02 ? 'text-green-600' : 'text-slate-600'}`}>
                      {v > 0 ? '+' : ''}{formatPercent(v * 100)}
                    </td>
                  )
                })}
              </tr>

              {/* Cash Flow */}
              <tr className="border-b bg-slate-25">
                <td className="px-4 py-2 font-medium text-slate-500 text-xs uppercase tracking-wide" colSpan={1 + projects.length}>
                  Cash Flow
                </td>
              </tr>
              <tr className="border-b hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-700">Total Inflows</td>
                {projects.map(p => {
                  const ccy = p.project_id === 'BHX' ? 'GBP' : 'EUR'
                  return (
                    <td key={p.project_id} className="px-4 py-3 text-right font-mono text-green-600">
                      +{formatCompact(cashFlow[p.project_id]?.totalInflow || 0, ccy)}
                    </td>
                  )
                })}
              </tr>
              <tr className="border-b hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-700">Total Outflows</td>
                {projects.map(p => {
                  const ccy = p.project_id === 'BHX' ? 'GBP' : 'EUR'
                  return (
                    <td key={p.project_id} className="px-4 py-3 text-right font-mono text-red-600">
                      {formatCompact(cashFlow[p.project_id]?.totalOutflow || 0, ccy)}
                    </td>
                  )
                })}
              </tr>
              <tr className="border-b hover:bg-slate-50 font-semibold">
                <td className="px-4 py-3 text-slate-900">Net Cash Flow</td>
                {projects.map(p => {
                  const ccy = p.project_id === 'BHX' ? 'GBP' : 'EUR'
                  const net = (cashFlow[p.project_id]?.totalInflow || 0) + (cashFlow[p.project_id]?.totalOutflow || 0)
                  return (
                    <td key={p.project_id} className={`px-4 py-3 text-right font-mono ${net >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                      {formatCompact(net, ccy)}
                    </td>
                  )
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
