'use client'
import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { CheckCircle } from 'lucide-react'

type MaybeJoined<T> = T | T[] | null | undefined
function firstJoined<T>(v: MaybeJoined<T>): T | null {
  if (Array.isArray(v)) return v[0] ?? null
  return v ?? null
}

type Decision = {
  id: string
  decision_id: string | null
  project_id: string
  decision_topic: string | null
  decision_text: string | null
  meeting_type: string | null
  implementation_due: string | null
  status_code: string
  dim_owner?: MaybeJoined<{ full_name: string | null }>
}

const PROJECT_ACCENT: Record<string, string> = { MAD: '#0B4A6F', BHX: '#166534' }

const OPEN_STATUSES = ['AS_OPEN', 'AS_PROG']
const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  AS_OPEN: { label: 'Abierta', cls: 'bg-slate-100 text-slate-600' },
  AS_PROG: { label: 'En curso', cls: 'bg-amber-100 text-amber-700' },
  AS_DONE: { label: 'Cerrada', cls: 'bg-blue-100 text-blue-700' },
  AS_CANC: { label: 'Cancelada', cls: 'bg-slate-100 text-slate-400' },
}

function fmtDate(s: string | null): string {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function DecisionsPage() {
  const [decisions, setDecisions] = useState<Decision[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  const load = useCallback(async () => {
    setLoadError(false)
    setLoading(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('fct_decision_log')
        .select('id, decision_id, project_id, decision_topic, decision_text, meeting_type, implementation_due, status_code, dim_owner:decision_owner_id(full_name)')
        .order('implementation_due', { ascending: true, nullsFirst: false })
      if (error) throw error
      setDecisions((data || []) as unknown as Decision[])
    } catch (e) {
      console.error('[decisions] load failed', e)
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const now = new Date()
  const open = decisions.filter(d => OPEN_STATUSES.includes(d.status_code))

  return (
    <div className="space-y-4 pb-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Decisiones</h1>
        <p className="text-sm text-slate-500">Registro de decisiones de gobierno · {open.length} abiertas</p>
      </div>

      {loadError ? (
        <div className="max-w-md space-y-3 rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <p className="text-sm font-medium text-slate-800">No se pudieron cargar las decisiones</p>
          <p className="text-xs text-slate-500">La sesión pudo expirar. Reintenta o vuelve a iniciar sesión.</p>
          <div className="flex justify-center gap-2">
            <button onClick={() => load()} className="rounded bg-slate-800 px-4 py-2 text-xs font-medium text-white hover:bg-slate-700">Reintentar</button>
            <a href="/login" className="rounded border px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50">Iniciar sesión</a>
          </div>
        </div>
      ) : loading ? (
        <div className="flex h-48 items-center justify-center">
          <div className="space-y-2 text-center">
            <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
            <p className="font-mono text-xs text-slate-400">Cargando decisiones...</p>
          </div>
        </div>
      ) : decisions.length === 0 ? (
        <div className="flex items-center gap-2 rounded-xl border border-dashed border-slate-200 bg-white px-4 py-8 text-slate-400">
          <CheckCircle className="h-4 w-4 text-green-500" />
          <span className="font-mono text-[12px]">Sin decisiones registradas</span>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                {['ID', 'Proyecto', 'Decisión', 'Responsable', 'Reunión', 'Estado', 'Vence'].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {decisions.map((d, i) => {
                const overdue = OPEN_STATUSES.includes(d.status_code) && d.implementation_due && new Date(d.implementation_due) < now
                const status = STATUS_LABEL[d.status_code] || { label: d.status_code, cls: 'bg-slate-100 text-slate-600' }
                return (
                  <tr key={d.id} className={cn('border-b border-slate-50 last:border-0 align-top', i % 2 === 1 ? 'bg-slate-50/40' : '')}>
                    <td className="px-3 py-2.5 font-mono text-[11px] text-slate-500 whitespace-nowrap">{d.decision_id || '—'}</td>
                    <td className="px-3 py-2.5">
                      <span className="rounded-[2px] px-1.5 py-0.5 font-mono text-[10px] font-bold text-white" style={{ backgroundColor: PROJECT_ACCENT[d.project_id] || '#475569' }}>{d.project_id}</span>
                    </td>
                    <td className="px-3 py-2.5 max-w-[420px]">
                      <p className="font-medium text-slate-800">{d.decision_topic || '—'}</p>
                      {d.decision_text && <p className="mt-0.5 text-[12px] text-slate-500 line-clamp-2">{d.decision_text}</p>}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">{firstJoined(d.dim_owner)?.full_name || 'Sin asignar'}</td>
                    <td className="px-3 py-2.5 font-mono text-[11px] text-slate-500 whitespace-nowrap">{d.meeting_type || '—'}</td>
                    <td className="px-3 py-2.5"><span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', status.cls)}>{status.label}</span></td>
                    <td className={cn('px-3 py-2.5 font-mono text-[11px] whitespace-nowrap', overdue ? 'font-bold text-red-600' : 'text-slate-400')}>{overdue ? '⚠ ' : ''}{fmtDate(d.implementation_due)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
