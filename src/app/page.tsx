'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { KPICard } from '@/components/shared/KPICard'
import { RAGBadge } from '@/components/shared/RAGBadge'
import { createClient } from '@/lib/supabase'
import { getCapexSummary, getCashFlowSummary, getFundingSummary } from '@/lib/queries-financial'
import { formatCompact, formatPercent, type RAGColor } from '@/lib/utils'

type Project = {
  project_id: string
  project_name: string
  city: string
  stage: string
  status_rag: RAGColor
  opening_target: string
}

export default function CEODashboard() {
  const [projects, setProjects] = useState<Project[]>([])
  const [capex, setCapex] = useState<Record<string, { budget: number; approved: number; committed: number; invoiced: number; paid: number; eac: number }>>({})
  const [cashFlow, setCashFlow] = useState<Record<string, { totalInflow: number; totalOutflow: number; actualInflow: number; actualOutflow: number }>>({})
  const [fundingRaw, setFundingRaw] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const [
        { data: projectData },
        capexData,
        cfData,
        fundingData
      ] = await Promise.all([
        supabase.from('dim_project').select('project_id, project_name, city, stage, status_rag, opening_target').eq('active', true),
        getCapexSummary(),
        getCashFlowSummary(),
        getFundingSummary()
      ])
      setProjects(projectData || [])
      setCapex(capexData)
      setCashFlow(cfData)
      setFundingRaw(fundingData || [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Loading...</p></div>

  // Portfolio-level KPIs
  const totalBudget = Object.values(capex).reduce((s, p) => s + p.budget, 0)
  const totalPaid = Object.values(capex).reduce((s, p) => s + p.paid, 0)
  const totalCommittedFunding = fundingRaw.reduce((s: number, r: any) => s + (r.committed_amount || 0), 0)
  const totalDrawn = fundingRaw.reduce((s: number, r: any) => s + (r.drawn_to_date || 0), 0)
  const spentPct = totalBudget > 0 ? totalPaid / totalBudget : 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">CEO Dashboard</h1>
        <p className="text-sm text-slate-500">Snapshot: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
      </div>

      {/* Portfolio KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <KPICard title="Active Projects" value={projects.length} subtitle="Wave park portfolio" />
        <KPICard
          title="Total CapEx Budget"
          value={formatCompact(totalBudget)}
          subtitle="Combined MAD + BHX"
        />
        <KPICard
          title="CapEx Spent"
          value={formatPercent(spentPct * 100)}
          subtitle={formatCompact(totalPaid)}
          rag={spentPct > 0.7 ? 'Amber' : 'Green'}
        />
        <KPICard
          title="Funding Committed"
          value={formatCompact(totalCommittedFunding)}
          subtitle={`${formatCompact(totalDrawn)} drawn`}
        />
        <KPICard
          title="Funding Utilization"
          value={formatPercent(totalCommittedFunding > 0 ? (totalDrawn / totalCommittedFunding) * 100 : 0)}
          subtitle="Drawn / Committed"
          rag={totalDrawn / totalCommittedFunding > 0.85 ? 'Amber' : 'Green'}
        />
      </div>

      {/* Project Cards */}
      <div className="grid gap-6 lg:grid-cols-2">
        {projects.map(project => {
          const pid = project.project_id
          const ccy = pid === 'BHX' ? 'GBP' : 'EUR'
          const pCapex = capex[pid]
          const pCF = cashFlow[pid]
          const paidPct = pCapex ? pCapex.paid / pCapex.budget : 0
          const variancePct = pCapex ? (pCapex.eac - pCapex.budget) / pCapex.budget : 0

          return (
            <div key={pid} className="rounded-lg border bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold">{project.project_name}</h2>
                  <p className="text-sm text-slate-500">{project.city} — {project.stage}</p>
                </div>
                <RAGBadge status={project.status_rag as RAGColor} />
              </div>

              {/* Mini financial summary */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="rounded-lg bg-slate-50 p-3 text-center">
                  <p className="text-lg font-bold text-slate-900">{formatCompact(pCapex?.budget || 0, ccy)}</p>
                  <p className="text-xs text-slate-500">CapEx Budget</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3 text-center">
                  <p className="text-lg font-bold text-slate-900">{formatPercent(paidPct * 100)}</p>
                  <p className="text-xs text-slate-500">Executed</p>
                </div>
                <div className={`rounded-lg p-3 text-center ${variancePct > 0.02 ? 'bg-red-50' : variancePct < -0.02 ? 'bg-green-50' : 'bg-slate-50'}`}>
                  <p className={`text-lg font-bold ${variancePct > 0.02 ? 'text-red-600' : variancePct < -0.02 ? 'text-green-600' : 'text-slate-900'}`}>
                    {variancePct > 0 ? '+' : ''}{formatPercent(variancePct * 100)}
                  </p>
                  <p className="text-xs text-slate-500">EAC Variance</p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mb-3">
                <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full bg-green-500 transition-all duration-500" style={{ width: `${Math.min(paidPct * 100, 100)}%` }} />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500">
                  Opening: {new Date(project.opening_target).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                </p>
                <div className="flex gap-2">
                  <Link href="/bp-budget" className="text-xs text-blue-600 hover:text-blue-800 font-medium">CapEx →</Link>
                  <Link href="/funding" className="text-xs text-blue-600 hover:text-blue-800 font-medium">Cash Flow →</Link>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Cash Flow Snapshot */}
      <div className="rounded-lg border bg-white p-6">
        <h3 className="text-sm font-medium text-slate-700 mb-4">Net Cash Position by Project</h3>
        <div className="grid gap-4 lg:grid-cols-2">
          {projects.map(project => {
            const pid = project.project_id
            const ccy = pid === 'BHX' ? 'GBP' : 'EUR'
            const pCF = cashFlow[pid]
            return (
              <div key={pid} className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <p className="font-medium text-slate-900">{project.project_name}</p>
                  <p className="text-xs text-slate-500">{pid}</p>
                </div>
                <div className="text-right">
                  <div className="flex gap-4">
                    <div>
                      <p className="text-sm font-mono text-green-600">+{formatCompact(pCF?.totalInflow || 0, ccy)}</p>
                      <p className="text-xs text-slate-400">Inflows</p>
                    </div>
                    <div>
                      <p className="text-sm font-mono text-red-600">{formatCompact(pCF?.totalOutflow || 0, ccy)}</p>
                      <p className="text-xs text-slate-400">Outflows</p>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
