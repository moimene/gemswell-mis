'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { KPICard } from '@/components/shared/KPICard'
import { RAGBadge } from '@/components/shared/RAGBadge'
import { type RAGColor } from '@/lib/utils'
import * as Dialog from '@radix-ui/react-dialog'
import { toast } from 'sonner'
import { AlertTriangle, Plus, X } from 'lucide-react'

type ProjectTab = 'MAD' | 'BHX'

type Risk = {
  id: string
  risk_id: string
  risk_title: string
  risk_description: string
  risk_category_id: string
  probability_score: number
  impact_cost_eur: number
  impact_days: number
  severity_score: number
  owner_id: string
  mitigation_summary: string
  status_code: string
  escalation_flag: boolean
  comment: string
  dim_owner: { full_name: string; department: string } | null
  dim_risk_category: { category_name: string; scope: string } | null
}

type Action = {
  id: string
  action_id: string
  action_title: string
  owner_id: string
  due_date: string
  action_status_id: string
  linked_risk_id: string
  comment: string
  dim_owner: { full_name: string } | null
  dim_action_status: { status_name: string; is_closed: boolean } | null
}

function severityRAG(score: number): RAGColor {
  if (score >= 13) return 'Red'
  if (score >= 6) return 'Amber'
  return 'Green'
}

function statusRAG(code: string): RAGColor {
  if (code === 'CP') return 'Green'
  if (code === 'IP') return 'Amber'
  if (['BL', 'DL', 'AT'].includes(code)) return 'Red'
  return 'Grey'
}

const STATUS_LABELS: Record<string, string> = {
  NS: 'Not Started', IP: 'In Progress', BL: 'Blocked',
  DL: 'Delayed', AT: 'At Risk', CP: 'Complete',
}

const ACTION_STATUS_LABELS: Record<string, string> = {
  AS_OPEN: 'Open', AS_PROG: 'In Progress', AS_DONE: 'Done',
  AS_CANC: 'Cancelled', AS_OVER: 'Overdue',
}

const OWNERS = [
  { id: 'OWN_001', label: 'CEO' }, { id: 'OWN_002', label: 'CFO' },
  { id: 'OWN_003', label: 'COO' }, { id: 'OWN_004', label: 'PD Madrid' },
  { id: 'OWN_005', label: 'PD Birmingham' },
]

const CATEGORIES = [
  { id: 'RC_CONS', label: 'Construction' }, { id: 'RC_FIN', label: 'Financial' },
  { id: 'RC_REG', label: 'Regulatory' }, { id: 'RC_OP', label: 'Operational' },
]

export default function RisksPage() {
  const [activeProject, setActiveProject] = useState<ProjectTab>('MAD')
  const [risks, setRisks] = useState<Risk[]>([])
  const [actions, setActions] = useState<Action[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [riskOpen, setRiskOpen] = useState(false)
  const [actionOpen, setActionOpen] = useState(false)

  // Risk form state
  const [rTitle, setRTitle] = useState('')
  const [rDesc, setRDesc] = useState('')
  const [rCat, setRCat] = useState('RC_CONS')
  const [rProb, setRProb] = useState(3)
  const [rDays, setRDays] = useState(0)
  const [rMit, setRMit] = useState('')
  const [rSubmitting, setRSubmitting] = useState(false)

  // Action form state
  const [aTitle, setATitle] = useState('')
  const [aOwner, setAOwner] = useState('OWN_001')
  const [aDue, setADue] = useState('')
  const [aLinkedRisk, setALinkedRisk] = useState('')
  const [aSubmitting, setASubmitting] = useState(false)

  const today = new Date().toISOString().split('T')[0]

  async function fetchRiskState(project: ProjectTab) {
    const supabase = createClient()
    const [
      { data: riskData, error: riskError },
      { data: actionData, error: actionError },
    ] = await Promise.all([
      supabase
        .from('fct_risk_snapshot')
        .select('*, dim_owner(full_name, department), dim_risk_category(category_name, scope)')
        .eq('project_id', project)
        .order('as_of_date', { ascending: false }),
      supabase
        .from('fct_action_snapshot')
        .select('*, dim_owner(full_name), dim_action_status(status_name, is_closed)')
        .eq('project_id', project)
        .order('as_of_date', { ascending: false }),
    ])

    if (riskError) throw riskError
    if (actionError) throw actionError

    // Deduplicate: keep latest snapshot per risk_id / action_id
    const latestRisks = Object.values(
      ((riskData || []) as Risk[]).reduce<Record<string, Risk>>((acc, r) => {
        if (!acc[r.risk_id]) acc[r.risk_id] = r
        return acc
      }, {})
    ).sort((a, b) => b.severity_score - a.severity_score)

    const latestActions = Object.values(
      ((actionData || []) as Action[]).reduce<Record<string, Action>>((acc, a) => {
        if (!acc[a.action_id]) acc[a.action_id] = a
        return acc
      }, {})
    )

    return { risks: latestRisks, actions: latestActions }
  }

  async function load() {
    setLoading(true)
    setLoadError(false)
    try {
      const data = await fetchRiskState(activeProject)
      setRisks(data.risks)
      setActions(data.actions)
    } catch (e) {
      console.error(e)
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    fetchRiskState(activeProject)
      .then(data => {
        if (cancelled) return
        setRisks(data.risks)
        setActions(data.actions)
        setLoading(false)
      })
      .catch(e => {
        if (cancelled) return
        console.error(e)
        setLoadError(true)
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [activeProject])

  const openRisks = risks.filter(r => r.status_code !== 'CP')
  const criticalRisks = risks.filter(r => r.severity_score >= 13)
  const escalatedRisks = risks.filter(r => r.escalation_flag)

  async function submitRisk() {
    if (!rTitle.trim() || !rMit.trim()) { toast.error('Title and Mitigation are required'); return }
    setRSubmitting(true)
    const supabase = createClient()
    const severity = Math.round(rProb * Math.max(1, rDays / 5))
    const { error } = await supabase.from('fct_risk_snapshot').insert({
      risk_id: `RSK-${Date.now()}`, project_id: activeProject, as_of_date: today,
      risk_title: rTitle.trim(), risk_description: rDesc.trim(), risk_category_id: rCat,
      probability_score: rProb, impact_days: rDays, severity_score: severity,
      mitigation_summary: rMit.trim(), status_code: 'IP', escalation_flag: false,
    })
    setRSubmitting(false)
    if (error) { toast.error('Failed to save risk: ' + error.message); return }
    toast.success('Risk added successfully')
    setRiskOpen(false)
    setRTitle(''); setRDesc(''); setRCat('RC_CONS'); setRProb(3); setRDays(0); setRMit('')
    load()
  }

  async function submitAction() {
    if (!aTitle.trim() || !aDue) { toast.error('Title and Due Date are required'); return }
    setASubmitting(true)
    const supabase = createClient()
    const { error } = await supabase.from('fct_action_snapshot').insert({
      action_id: `ACT-${Date.now()}`, project_id: activeProject, as_of_date: today,
      action_title: aTitle.trim(), owner_id: aOwner, due_date: aDue,
      action_status_id: 'AS_OPEN', linked_risk_id: aLinkedRisk || null,
    })
    setASubmitting(false)
    if (error) { toast.error('Failed to save action: ' + error.message); return }
    toast.success('Action added successfully')
    setActionOpen(false)
    setATitle(''); setAOwner('OWN_001'); setADue(''); setALinkedRisk('')
    load()
  }

  return (
    <div className="space-y-6">
      {/* Header + Tabs */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Risks & Actions</h1>
          <p className="text-sm text-slate-500">Risk register and action log by project</p>
        </div>
        <div className="flex gap-1 rounded-lg border bg-white p-1">
          {(['MAD', 'BHX'] as const).map(tab => (
            <button type="button" key={tab} onClick={() => setActiveProject(tab)}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${activeProject === tab ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
              {tab === 'MAD' ? 'Madrid Playa Surf' : 'Birmingham'}
            </button>
          ))}
        </div>
      </div>

      {loadError ? (
        <div className="rounded-lg border bg-white p-8 text-center">
          <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-amber-500" />
          <p className="text-sm font-medium text-slate-700">Could not load risks — your session may have expired.</p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <button type="button" onClick={load} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
              Retry
            </button>
            <a href="/login" className="rounded-md border px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
              Sign in
            </a>
          </div>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center h-64">
          <p className="text-slate-400">Loading risks...</p>
        </div>
      ) : (
        <>
          {/* KPI Row */}
          <div className="grid grid-cols-3 gap-4">
            <KPICard title="Open Risks" value={openRisks.length} subtitle="Status ≠ Complete" rag={openRisks.length > 5 ? 'Amber' : 'Green'} />
            <KPICard title="Critical Risks" value={criticalRisks.length} subtitle="Severity ≥ 13" rag={criticalRisks.length > 0 ? 'Red' : 'Green'} />
            <KPICard title="Escalated" value={escalatedRisks.length} subtitle="Escalation flag active" rag={escalatedRisks.length > 0 ? 'Amber' : 'Green'} />
          </div>

          {/* Risk Register */}
          <div className="rounded-lg border bg-white overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-sm font-medium text-slate-700">Risk Register</h3>
              <Dialog.Root open={riskOpen} onOpenChange={setRiskOpen}>
                <Dialog.Trigger asChild>
                  <button type="button" className="flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700">
                    <Plus className="h-3.5 w-3.5" /> Add Risk
                  </button>
                </Dialog.Trigger>
                <Dialog.Portal>
                  <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
                  <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-6 shadow-xl">
                    <div className="flex items-center justify-between mb-4">
                      <Dialog.Title className="text-base font-semibold text-slate-900">New Risk</Dialog.Title>
                      <Dialog.Close asChild>
                        <button type="button" aria-label="Close dialog" className="rounded p-1 text-slate-400 hover:text-slate-600">
                          <X className="h-4 w-4" />
                        </button>
                      </Dialog.Close>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label htmlFor="r-title" className="text-xs font-medium text-slate-600">Title *</label>
                        <input id="r-title" value={rTitle} onChange={e => setRTitle(e.target.value)} className="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" placeholder="Risk title" />
                      </div>
                      <div>
                        <label htmlFor="r-desc" className="text-xs font-medium text-slate-600">Description</label>
                        <textarea id="r-desc" value={rDesc} onChange={e => setRDesc(e.target.value)} rows={2} className="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" placeholder="Optional description" />
                      </div>
                      <div>
                        <label htmlFor="r-cat" className="text-xs font-medium text-slate-600">Category</label>
                        <select id="r-cat" value={rCat} onChange={e => setRCat(e.target.value)} className="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900">
                          {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label htmlFor="r-prob" className="text-xs font-medium text-slate-600">Probability (1–5)</label>
                          <input id="r-prob" type="number" min={1} max={5} value={rProb} onChange={e => setRProb(Number(e.target.value))} placeholder="1–5" className="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
                        </div>
                        <div>
                          <label htmlFor="r-days" className="text-xs font-medium text-slate-600">Impact (days)</label>
                          <input id="r-days" type="number" min={0} value={rDays} onChange={e => setRDays(Number(e.target.value))} placeholder="0" className="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
                        </div>
                      </div>
                      <div>
                        <label htmlFor="r-mit" className="text-xs font-medium text-slate-600">Mitigation *</label>
                        <textarea id="r-mit" value={rMit} onChange={e => setRMit(e.target.value)} rows={2} className="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" placeholder="Mitigation plan summary" />
                      </div>
                    </div>
                    <div className="mt-4 flex justify-end gap-2">
                      <Dialog.Close asChild>
                        <button type="button" className="rounded-md border px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
                      </Dialog.Close>
                      <button type="button" onClick={submitRisk} disabled={rSubmitting} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50">
                        {rSubmitting ? 'Saving…' : 'Save Risk'}
                      </button>
                    </div>
                  </Dialog.Content>
                </Dialog.Portal>
              </Dialog.Root>
            </div>
            {risks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <AlertTriangle className="h-8 w-8 mb-2 opacity-30" />
                <p className="text-sm">No risks recorded for this project</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-slate-50 text-left">
                      <th className="px-3 py-3 font-medium text-slate-600">#</th>
                      <th className="px-3 py-3 font-medium text-slate-600">Title</th>
                      <th className="px-3 py-3 font-medium text-slate-600">Category</th>
                      <th className="px-3 py-3 font-medium text-slate-600 text-center">P</th>
                      <th className="px-3 py-3 font-medium text-slate-600 text-center">I (d)</th>
                      <th className="px-3 py-3 font-medium text-slate-600 text-center">Score</th>
                      <th className="px-3 py-3 font-medium text-slate-600">RAG</th>
                      <th className="px-3 py-3 font-medium text-slate-600">Owner</th>
                      <th className="px-3 py-3 font-medium text-slate-600">Mitigation</th>
                      <th className="px-3 py-3 font-medium text-slate-600">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {risks.map((r, i) => {
                      const rag = severityRAG(r.severity_score)
                      const rowBg = rag === 'Red' ? 'bg-red-50' : rag === 'Amber' ? 'bg-amber-50' : ''
                      return (
                        <tr key={r.id} className={`border-b hover:brightness-95 ${rowBg}`}>
                          <td className="px-3 py-2.5 text-slate-500 font-mono text-xs">{i + 1}</td>
                          <td className="px-3 py-2.5 font-medium text-slate-900 max-w-[180px]">
                            <span className="line-clamp-2">{r.risk_title}</span>
                            {r.escalation_flag && <span className="ml-1 inline-flex items-center rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700">ESC</span>}
                          </td>
                          <td className="px-3 py-2.5 text-slate-600 text-xs">{r.dim_risk_category?.category_name || r.risk_category_id}</td>
                          <td className="px-3 py-2.5 text-center font-mono">{r.probability_score}</td>
                          <td className="px-3 py-2.5 text-center font-mono">{r.impact_days}</td>
                          <td className="px-3 py-2.5 text-center font-semibold font-mono">{r.severity_score}</td>
                          <td className="px-3 py-2.5"><RAGBadge status={rag} label={rag} /></td>
                          <td className="px-3 py-2.5 text-slate-600 text-xs">{r.dim_owner?.full_name || r.owner_id || '—'}</td>
                          <td className="px-3 py-2.5 text-slate-500 text-xs max-w-[160px]"><span className="line-clamp-2">{r.mitigation_summary || '—'}</span></td>
                          <td className="px-3 py-2.5"><RAGBadge status={statusRAG(r.status_code)} label={STATUS_LABELS[r.status_code] || r.status_code} /></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Action Log */}
          <div className="rounded-lg border bg-white overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-sm font-medium text-slate-700">Action Log</h3>
              <Dialog.Root open={actionOpen} onOpenChange={setActionOpen}>
                <Dialog.Trigger asChild>
                  <button type="button" className="flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700">
                    <Plus className="h-3.5 w-3.5" /> Add Action
                  </button>
                </Dialog.Trigger>
                <Dialog.Portal>
                  <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
                  <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-6 shadow-xl">
                    <div className="flex items-center justify-between mb-4">
                      <Dialog.Title className="text-base font-semibold text-slate-900">New Action</Dialog.Title>
                      <Dialog.Close asChild>
                        <button type="button" aria-label="Close dialog" className="rounded p-1 text-slate-400 hover:text-slate-600">
                          <X className="h-4 w-4" />
                        </button>
                      </Dialog.Close>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label htmlFor="a-title" className="text-xs font-medium text-slate-600">Title *</label>
                        <input id="a-title" value={aTitle} onChange={e => setATitle(e.target.value)} className="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" placeholder="Action title" />
                      </div>
                      <div>
                        <label htmlFor="a-owner" className="text-xs font-medium text-slate-600">Owner</label>
                        <select id="a-owner" value={aOwner} onChange={e => setAOwner(e.target.value)} className="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900">
                          {OWNERS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label htmlFor="a-due" className="text-xs font-medium text-slate-600">Due Date *</label>
                        <input id="a-due" type="date" value={aDue} onChange={e => setADue(e.target.value)} title="Due date" className="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
                      </div>
                      <div>
                        <label htmlFor="a-risk" className="text-xs font-medium text-slate-600">Linked Risk (optional)</label>
                        <select id="a-risk" value={aLinkedRisk} onChange={e => setALinkedRisk(e.target.value)} className="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900">
                          <option value="">— None —</option>
                          {risks.map(r => <option key={r.risk_id} value={r.risk_id}>{r.risk_title}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="mt-4 flex justify-end gap-2">
                      <Dialog.Close asChild>
                        <button type="button" className="rounded-md border px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
                      </Dialog.Close>
                      <button type="button" onClick={submitAction} disabled={aSubmitting} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50">
                        {aSubmitting ? 'Saving…' : 'Save Action'}
                      </button>
                    </div>
                  </Dialog.Content>
                </Dialog.Portal>
              </Dialog.Root>
            </div>
            {actions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <p className="text-sm">No actions recorded for this project</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-slate-50 text-left">
                      <th className="px-4 py-3 font-medium text-slate-600">Action</th>
                      <th className="px-4 py-3 font-medium text-slate-600">Owner</th>
                      <th className="px-4 py-3 font-medium text-slate-600">Due Date</th>
                      <th className="px-4 py-3 font-medium text-slate-600">Status</th>
                      <th className="px-4 py-3 font-medium text-slate-600">Linked Risk</th>
                    </tr>
                  </thead>
                  <tbody>
                    {actions.map(a => {
                      const isClosed = a.dim_action_status?.is_closed
                      const isOver = a.action_status_id === 'AS_OVER'
                      const statusBg = isClosed ? 'bg-green-50 text-green-700' : isOver ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
                      const linkedRisk = risks.find(r => r.risk_id === a.linked_risk_id)
                      return (
                        <tr key={a.id} className="border-b hover:bg-slate-50">
                          <td className="px-4 py-2.5 font-medium text-slate-900 max-w-[200px]"><span className="line-clamp-2">{a.action_title}</span></td>
                          <td className="px-4 py-2.5 text-slate-600 text-xs">{a.dim_owner?.full_name || a.owner_id || '—'}</td>
                          <td className="px-4 py-2.5 font-mono text-xs text-slate-600">{a.due_date ? new Date(a.due_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
                          <td className="px-4 py-2.5">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBg}`}>
                              {a.dim_action_status?.status_name || ACTION_STATUS_LABELS[a.action_status_id] || a.action_status_id}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-slate-500">{linkedRisk ? linkedRisk.risk_title : (a.linked_risk_id || '—')}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
