'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { KPICard } from '@/components/shared/KPICard'
import { PageHeader, RagChip, projectAccent } from '@/components/shared/terminal'
import { cn, type RAGColor } from '@/lib/utils'
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
  NS: 'Sin iniciar', IP: 'En curso', BL: 'Bloqueado',
  DL: 'Retrasado', AT: 'En riesgo', CP: 'Completado',
}

const ACTION_STATUS_LABELS: Record<string, string> = {
  AS_OPEN: 'Abierta', AS_PROG: 'En curso', AS_DONE: 'Cerrada',
  AS_CANC: 'Cancelada', AS_OVER: 'Vencida',
}

// Responsables (NOT NULL owner_id en fct_risk_snapshot / fct_action_snapshot)
const OWNERS = [
  { id: 'OWN_000', label: 'Íñigo Garayar' }, { id: 'OWN_001', label: 'Carlos Mendez' },
  { id: 'OWN_002', label: 'Sarah Whitaker' }, { id: 'OWN_003', label: 'Ana Ruiz' },
  { id: 'OWN_004', label: 'David Chen' }, { id: 'OWN_005', label: 'Lucia Delgado' },
  { id: 'OWN_006', label: 'James Parker' }, { id: 'OWN_007', label: 'Marina Costa' },
  { id: 'OWN_008', label: 'Pablo Vega' }, { id: 'OWN_009', label: 'Sophie Laurent' },
  { id: 'OWN_010', label: 'Thomas Berg' }, { id: 'OWN_011', label: 'Elena Marino' },
]

const CATEGORIES = [
  { id: 'RC_CONS', label: 'Construcción' }, { id: 'RC_FIN', label: 'Financiero' },
  { id: 'RC_REG', label: 'Regulatorio' }, { id: 'RC_OP', label: 'Operacional' },
]

/** ID por proyecto: RSK-MAD-12345 / ACT-BHX-00042 */
function makeId(prefix: 'RSK' | 'ACT', project: ProjectTab): string {
  const n = Math.floor(Math.random() * 100000).toString().padStart(5, '0')
  return `${prefix}-${project}-${n}`
}

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
  const [rOwner, setROwner] = useState('OWN_001')
  const [rProb, setRProb] = useState(3)
  const [rDays, setRDays] = useState(0)
  const [rMit, setRMit] = useState('')
  const [rSubmitting, setRSubmitting] = useState(false)

  // Action form state
  const [aTitle, setATitle] = useState('')
  const [aDesc, setADesc] = useState('')
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
        .select('*, dim_owner!fct_action_snapshot_owner_id_fkey(full_name), dim_action_status(status_name, is_closed)')
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
        setLoadError(false)  // clear a prior tab's error when a fresh load succeeds
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
    if (!rTitle.trim() || !rMit.trim()) { toast.error('El título y la mitigación son obligatorios'); return }
    setRSubmitting(true)
    const supabase = createClient()
    const severity = Math.round(rProb * Math.max(1, rDays / 5))
    const { error } = await supabase.from('fct_risk_snapshot').insert({
      risk_id: makeId('RSK', activeProject), project_id: activeProject, as_of_date: today,
      risk_title: rTitle.trim(), risk_description: rDesc.trim(), risk_category_id: rCat,
      owner_id: rOwner,
      probability_score: rProb, impact_days: rDays, severity_score: severity,
      mitigation_summary: rMit.trim(), status_code: 'IP', escalation_flag: false,
    })
    if (error) {
      setRSubmitting(false)
      toast.error('No se pudo guardar el riesgo: ' + error.message)
      return
    }
    toast.success('Riesgo añadido')
    setRiskOpen(false)
    setRTitle(''); setRDesc(''); setRCat('RC_CONS'); setROwner('OWN_001'); setRProb(3); setRDays(0); setRMit('')
    setRSubmitting(false)
    load()
  }

  async function submitAction() {
    if (!aTitle.trim() || !aDue) { toast.error('El título y el vencimiento son obligatorios'); return }
    setASubmitting(true)
    const supabase = createClient()
    const description = aDesc.trim() || aTitle.trim()
    const { error } = await supabase.from('fct_action_snapshot').insert({
      action_id: makeId('ACT', activeProject), project_id: activeProject, as_of_date: today,
      action_title: aTitle.trim(), action_description: description, owner_id: aOwner, due_date: aDue,
      action_status_id: 'AS_OPEN', linked_risk_id: aLinkedRisk || null,
    })
    if (error) {
      setASubmitting(false)
      toast.error('No se pudo guardar la acción: ' + error.message)
      return
    }
    toast.success('Acción guardada')
    setActionOpen(false)
    setATitle(''); setADesc(''); setAOwner('OWN_001'); setADue(''); setALinkedRisk('')
    setASubmitting(false)
    load()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Riesgos y Acciones"
        subtitle="Registro de riesgos y log de acciones por proyecto"
        right={
          <div className="flex gap-1 rounded-lg border border-slate-700 bg-slate-800 p-1">
            {(['MAD', 'BHX'] as const).map(tab => (
              <button type="button" key={tab} onClick={() => setActiveProject(tab)}
                className={cn(
                  'rounded-md px-3 py-1 font-mono text-xs font-bold tracking-wide transition-colors',
                  activeProject === tab ? 'text-white' : 'text-slate-400 hover:text-white'
                )}
                style={activeProject === tab ? { backgroundColor: projectAccent(tab) } : undefined}>
                {tab}
              </button>
            ))}
          </div>
        }
      />

      {loadError ? (
        <div className="max-w-md space-y-3 rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <AlertTriangle className="mx-auto h-6 w-6 text-amber-500" />
          <p className="text-sm font-medium text-slate-800">No se pudieron cargar los riesgos</p>
          <p className="text-xs text-slate-500">La sesión pudo expirar. Reintenta o vuelve a iniciar sesión.</p>
          <div className="flex justify-center gap-2">
            <button type="button" onClick={load} className="rounded bg-slate-800 px-4 py-2 text-xs font-medium text-white hover:bg-slate-700">
              Reintentar
            </button>
            <a href="/login" className="rounded border px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50">
              Iniciar sesión
            </a>
          </div>
        </div>
      ) : loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="space-y-2 text-center">
            <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
            <p className="font-mono text-xs text-slate-400">Cargando riesgos...</p>
          </div>
        </div>
      ) : (
        <>
          {/* KPI Row */}
          <div className="grid grid-cols-3 gap-4">
            <KPICard title="Riesgos abiertos" value={openRisks.length} subtitle="Estado ≠ Completado" rag={openRisks.length > 5 ? 'Amber' : 'Green'} />
            <KPICard title="Riesgos críticos" value={criticalRisks.length} subtitle="Severidad ≥ 13" rag={criticalRisks.length > 0 ? 'Red' : 'Green'} />
            <KPICard title="Escalados" value={escalatedRisks.length} subtitle="Marca de escalado activa" rag={escalatedRisks.length > 0 ? 'Amber' : 'Green'} />
          </div>

          {/* Risk Register */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <h3 className="font-mono text-[11px] font-bold uppercase tracking-widest text-slate-500">Registro de Riesgos</h3>
              <Dialog.Root open={riskOpen} onOpenChange={setRiskOpen}>
                <Dialog.Trigger asChild>
                  <button type="button" className="flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800">
                    <Plus className="h-3.5 w-3.5" /> Añadir riesgo
                  </button>
                </Dialog.Trigger>
                <Dialog.Portal>
                  <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
                  <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-6 shadow-xl">
                    <div className="mb-4 flex items-center justify-between">
                      <Dialog.Title className="text-base font-semibold text-slate-900">Nuevo Riesgo</Dialog.Title>
                      <Dialog.Close asChild>
                        <button type="button" aria-label="Cerrar diálogo" className="rounded p-1 text-slate-400 hover:text-slate-600">
                          <X className="h-4 w-4" />
                        </button>
                      </Dialog.Close>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label htmlFor="r-title" className="font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">Título *</label>
                        <input id="r-title" value={rTitle} onChange={e => setRTitle(e.target.value)} className="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" placeholder="Título del riesgo" />
                      </div>
                      <div>
                        <label htmlFor="r-desc" className="font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">Descripción</label>
                        <textarea id="r-desc" value={rDesc} onChange={e => setRDesc(e.target.value)} rows={2} className="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" placeholder="Descripción opcional" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label htmlFor="r-cat" className="font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">Categoría</label>
                          <select id="r-cat" value={rCat} onChange={e => setRCat(e.target.value)} className="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900">
                            {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                          </select>
                        </div>
                        <div>
                          <label htmlFor="r-owner" className="font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">Responsable</label>
                          <select id="r-owner" value={rOwner} onChange={e => setROwner(e.target.value)} className="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900">
                            {OWNERS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label htmlFor="r-prob" className="font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">Probabilidad (1–5)</label>
                          <input id="r-prob" type="number" min={1} max={5} value={rProb} onChange={e => setRProb(Number(e.target.value))} placeholder="1–5" className="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
                        </div>
                        <div>
                          <label htmlFor="r-days" className="font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">Impacto (días)</label>
                          <input id="r-days" type="number" min={0} value={rDays} onChange={e => setRDays(Number(e.target.value))} placeholder="0" className="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
                        </div>
                      </div>
                      <div>
                        <label htmlFor="r-mit" className="font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">Mitigación *</label>
                        <textarea id="r-mit" value={rMit} onChange={e => setRMit(e.target.value)} rows={2} className="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" placeholder="Resumen del plan de mitigación" />
                      </div>
                    </div>
                    <div className="mt-4 flex justify-end gap-2">
                      <Dialog.Close asChild>
                        <button type="button" className="rounded-md border px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Cancelar</button>
                      </Dialog.Close>
                      <button type="button" onClick={submitRisk} disabled={rSubmitting} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50">
                        {rSubmitting ? 'Guardando…' : 'Guardar riesgo'}
                      </button>
                    </div>
                  </Dialog.Content>
                </Dialog.Portal>
              </Dialog.Root>
            </div>
            {risks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <AlertTriangle className="mb-2 h-8 w-8 opacity-30" />
                <p className="font-mono text-[12px]">Sin riesgos registrados para este proyecto</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[13px]">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-left">
                      <th className="px-3 py-2.5 font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">#</th>
                      <th className="px-3 py-2.5 font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">Título</th>
                      <th className="px-3 py-2.5 font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">Categoría</th>
                      <th className="px-3 py-2.5 text-right font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">Prob.</th>
                      <th className="px-3 py-2.5 text-right font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">Impacto (d)</th>
                      <th className="px-3 py-2.5 text-right font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">Severidad</th>
                      <th className="px-3 py-2.5 font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">RAG</th>
                      <th className="px-3 py-2.5 font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">Responsable</th>
                      <th className="px-3 py-2.5 font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">Mitigación</th>
                      <th className="px-3 py-2.5 font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {risks.map((r, i) => {
                      const rag = severityRAG(r.severity_score)
                      return (
                        <tr
                          key={r.id}
                          className={cn('border-b border-slate-50 last:border-0 hover:bg-slate-50', i % 2 === 1 ? 'bg-slate-50/40' : '')}
                          style={{ borderLeft: `2px solid ${projectAccent(activeProject)}` }}
                        >
                          <td className="px-3 py-2.5 font-mono text-[11px] text-slate-400">{i + 1}</td>
                          <td className="max-w-[180px] px-3 py-2.5 font-medium text-slate-800">
                            <span className="line-clamp-2">{r.risk_title}</span>
                            {r.escalation_flag && <span className="ml-1 inline-flex items-center rounded-[2px] bg-red-100 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide text-red-700">ESC</span>}
                          </td>
                          <td className="px-3 py-2.5 text-xs text-slate-600">{r.dim_risk_category?.category_name || r.risk_category_id}</td>
                          <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-600">{r.probability_score}</td>
                          <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-600">{r.impact_days}</td>
                          <td className={cn('px-3 py-2.5 text-right font-mono font-semibold tabular-nums', rag === 'Red' ? 'text-red-600' : rag === 'Amber' ? 'text-amber-600' : 'text-slate-700')}>{r.severity_score}</td>
                          <td className="px-3 py-2.5"><RagChip status={rag} /></td>
                          <td className="px-3 py-2.5 text-xs text-slate-600">{r.dim_owner?.full_name || r.owner_id || '—'}</td>
                          <td className="max-w-[160px] px-3 py-2.5 text-xs text-slate-500"><span className="line-clamp-2">{r.mitigation_summary || '—'}</span></td>
                          <td className="px-3 py-2.5"><RagChip status={statusRAG(r.status_code)} label={STATUS_LABELS[r.status_code] || r.status_code} /></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Action Log */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <h3 className="font-mono text-[11px] font-bold uppercase tracking-widest text-slate-500">Log de Acciones</h3>
              <Dialog.Root open={actionOpen} onOpenChange={setActionOpen}>
                <Dialog.Trigger asChild>
                  <button type="button" className="flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800">
                    <Plus className="h-3.5 w-3.5" /> Añadir acción
                  </button>
                </Dialog.Trigger>
                <Dialog.Portal>
                  <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
                  <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-6 shadow-xl">
                    <div className="mb-4 flex items-center justify-between">
                      <Dialog.Title className="text-base font-semibold text-slate-900">Nueva Acción</Dialog.Title>
                      <Dialog.Close asChild>
                        <button type="button" aria-label="Cerrar diálogo" className="rounded p-1 text-slate-400 hover:text-slate-600">
                          <X className="h-4 w-4" />
                        </button>
                      </Dialog.Close>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label htmlFor="a-title" className="font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">Título *</label>
                        <input id="a-title" value={aTitle} onChange={e => setATitle(e.target.value)} className="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" placeholder="Título de la acción" />
                      </div>
                      <div>
                        <label htmlFor="a-desc" className="font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">Descripción</label>
                        <textarea id="a-desc" value={aDesc} onChange={e => setADesc(e.target.value)} rows={2} className="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" placeholder="Descripción opcional (si se omite, se usa el título)" />
                      </div>
                      <div>
                        <label htmlFor="a-owner" className="font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">Responsable</label>
                        <select id="a-owner" value={aOwner} onChange={e => setAOwner(e.target.value)} className="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900">
                          {OWNERS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label htmlFor="a-due" className="font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">Vencimiento *</label>
                        <input id="a-due" type="date" value={aDue} onChange={e => setADue(e.target.value)} title="Fecha de vencimiento" className="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
                      </div>
                      <div>
                        <label htmlFor="a-risk" className="font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">Riesgo vinculado (opcional)</label>
                        <select id="a-risk" value={aLinkedRisk} onChange={e => setALinkedRisk(e.target.value)} className="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900">
                          <option value="">— Ninguno —</option>
                          {risks.map(r => <option key={r.risk_id} value={r.risk_id}>{r.risk_title}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="mt-4 flex justify-end gap-2">
                      <Dialog.Close asChild>
                        <button type="button" className="rounded-md border px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Cancelar</button>
                      </Dialog.Close>
                      <button type="button" onClick={submitAction} disabled={aSubmitting} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50">
                        {aSubmitting ? 'Guardando…' : 'Guardar acción'}
                      </button>
                    </div>
                  </Dialog.Content>
                </Dialog.Portal>
              </Dialog.Root>
            </div>
            {actions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <p className="font-mono text-[12px]">Sin acciones registradas para este proyecto</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[13px]">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-left">
                      <th className="px-4 py-2.5 font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">Acción</th>
                      <th className="px-4 py-2.5 font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">Responsable</th>
                      <th className="px-4 py-2.5 font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">Vencimiento</th>
                      <th className="px-4 py-2.5 font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">Estado</th>
                      <th className="px-4 py-2.5 font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">Riesgo vinculado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {actions.map((a, i) => {
                      const isClosed = a.dim_action_status?.is_closed
                      const isOver = a.action_status_id === 'AS_OVER'
                      const statusRag: RAGColor = isClosed ? 'Blue' : isOver ? 'Red' : 'Amber'
                      const linkedRisk = risks.find(r => r.risk_id === a.linked_risk_id)
                      return (
                        <tr key={a.id} className={cn('border-b border-slate-50 last:border-0 hover:bg-slate-50', i % 2 === 1 ? 'bg-slate-50/40' : '')}>
                          <td className="max-w-[200px] px-4 py-2.5 font-medium text-slate-800"><span className="line-clamp-2">{a.action_title}</span></td>
                          <td className="px-4 py-2.5 text-xs text-slate-600">{a.dim_owner?.full_name || a.owner_id || '—'}</td>
                          <td className="px-4 py-2.5 font-mono tabular-nums text-xs text-slate-600">{a.due_date ? new Date(a.due_date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
                          <td className="px-4 py-2.5">
                            <RagChip status={statusRag} label={a.dim_action_status?.status_name || ACTION_STATUS_LABELS[a.action_status_id] || a.action_status_id} />
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
