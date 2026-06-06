'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { getCapexSummary, getCashFlowSummary } from '@/lib/queries-financial'
import { formatCompact, formatPercent, type RAGColor } from '@/lib/utils'
import { PageHeader, RagChip, projectAccent } from '@/components/shared/terminal'

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

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <div className="space-y-2 text-center">
        <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
        <p className="font-mono text-xs text-slate-400">Cargando cartera...</p>
      </div>
    </div>
  )

  if (loadError) return (
    <div className="space-y-6">
      <PageHeader
        title="Cartera — Comparativa de proyectos"
        subtitle="Comparativa lado a lado de los proyectos del portfolio"
      />
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-slate-900">No se pudo cargar la cartera.</p>
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
      <PageHeader
        title="Cartera — Comparativa de proyectos"
        subtitle="Comparativa lado a lado de los proyectos del portfolio"
      />

      {/* Tabla comparativa */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-3 text-left font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">Métrica</th>
                {projects.map(p => (
                  <th key={p.project_id} className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <span className="rounded-[2px] px-1.5 py-0.5 font-mono text-[10px] font-bold text-white" style={{ backgroundColor: projectAccent(p.project_id) }}>
                        {p.project_id}
                      </span>
                      <span className="text-[13px] font-bold text-slate-900">{p.project_name}</span>
                      <RagChip status={p.status_rag} />
                    </div>
                    <p className="mt-0.5 font-mono text-[11px] font-normal text-slate-500">{p.city}, {p.country}</p>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Estado del proyecto */}
              <tr className="border-b border-slate-200 bg-slate-50">
                <td className="px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400" colSpan={1 + projects.length}>
                  Estado del proyecto
                </td>
              </tr>
              <tr className="border-b border-slate-100 odd:bg-slate-50/30 hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-700">Etapa</td>
                {projects.map(p => (
                  <td key={p.project_id} className="px-4 py-3 text-right">
                    <span className="inline-block rounded-[2px] bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-600">{p.stage}</span>
                  </td>
                ))}
              </tr>
              <tr className="border-b border-slate-100 odd:bg-slate-50/30 hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-700">Apertura objetivo</td>
                {projects.map(p => (
                  <td key={p.project_id} className="px-4 py-3 text-right font-mono tabular-nums text-slate-700">
                    {new Date(p.opening_target).toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-slate-100 odd:bg-slate-50/30 hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-700">Moneda</td>
                {projects.map(p => (
                  <td key={p.project_id} className="px-4 py-3 text-right font-mono tabular-nums text-slate-700">{p.currency || (p.project_id === 'BHX' ? 'GBP' : 'EUR')}</td>
                ))}
              </tr>

              {/* CapEx */}
              <tr className="border-b border-slate-200 bg-slate-50">
                <td className="px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400" colSpan={1 + projects.length}>
                  Capital Expenditure (CapEx)
                </td>
              </tr>
              {[
                { label: 'Presupuesto base', key: 'budget' as const },
                { label: 'Presupuesto aprobado', key: 'approved' as const },
                { label: 'Comprometido', key: 'committed' as const },
                { label: 'Pagado a la fecha', key: 'paid' as const },
                { label: 'EAC', key: 'eac' as const },
              ].map(({ label, key }) => (
                <tr key={key} className="border-b border-slate-100 odd:bg-slate-50/30 hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-700">{label}</td>
                  {projects.map(p => {
                    const val = capex[p.project_id]?.[key] || 0
                    return (
                      <td key={p.project_id} className="px-4 py-3 text-right font-mono tabular-nums text-slate-900">
                        {formatCompact(val, 'EUR')}
                      </td>
                    )
                  })}
                </tr>
              ))}
              <tr className="border-b border-slate-100 odd:bg-slate-50/30 hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-700">Ejecución %</td>
                {projects.map(p => {
                  const pct = capex[p.project_id]?.budget > 0 ? capex[p.project_id].paid / capex[p.project_id].budget : 0
                  return (
                    <td key={p.project_id} className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="h-2 w-16 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full" style={{ width: `${Math.min(pct * 100, 100)}%`, backgroundColor: projectAccent(p.project_id) }} />
                        </div>
                        <span className="font-mono tabular-nums text-slate-700">{formatPercent(pct * 100)}</span>
                      </div>
                    </td>
                  )
                })}
              </tr>
              <tr className="border-b border-slate-100 odd:bg-slate-50/30 hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-700">Desviación EAC</td>
                {projects.map(p => {
                  const v = capex[p.project_id]?.budget > 0 ? (capex[p.project_id].eac - capex[p.project_id].budget) / capex[p.project_id].budget : 0
                  return (
                    <td key={p.project_id} className={`px-4 py-3 text-right font-mono tabular-nums font-medium ${v > 0.02 ? 'text-red-600' : v < -0.02 ? 'text-green-600' : 'text-slate-600'}`}>
                      {v > 0 ? '+' : ''}{formatPercent(v * 100)}
                    </td>
                  )
                })}
              </tr>

              {/* Cash Flow */}
              <tr className="border-b border-slate-200 bg-slate-50">
                <td className="px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400" colSpan={1 + projects.length}>
                  Flujo de caja
                </td>
              </tr>
              <tr className="border-b border-slate-100 odd:bg-slate-50/30 hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-700">Entradas totales</td>
                {projects.map(p => {
                  const ccy = p.currency || (p.project_id === 'BHX' ? 'GBP' : 'EUR')
                  return (
                    <td key={p.project_id} className="px-4 py-3 text-right font-mono tabular-nums text-green-600">
                      +{formatCompact(cashFlow[p.project_id]?.totalInflow || 0, ccy)}
                    </td>
                  )
                })}
              </tr>
              <tr className="border-b border-slate-100 odd:bg-slate-50/30 hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-700">Salidas totales</td>
                {projects.map(p => {
                  const ccy = p.currency || (p.project_id === 'BHX' ? 'GBP' : 'EUR')
                  return (
                    <td key={p.project_id} className="px-4 py-3 text-right font-mono tabular-nums text-red-600">
                      {formatCompact(cashFlow[p.project_id]?.totalOutflow || 0, ccy)}
                    </td>
                  )
                })}
              </tr>
              <tr className="border-b border-slate-100 font-semibold odd:bg-slate-50/30 hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-900">Cash neto</td>
                {projects.map(p => {
                  const ccy = p.currency || (p.project_id === 'BHX' ? 'GBP' : 'EUR')
                  const net = (cashFlow[p.project_id]?.totalInflow || 0) + (cashFlow[p.project_id]?.totalOutflow || 0)
                  return (
                    <td key={p.project_id} className={`px-4 py-3 text-right font-mono tabular-nums ${net >= 0 ? 'text-green-700' : 'text-red-700'}`}>
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
