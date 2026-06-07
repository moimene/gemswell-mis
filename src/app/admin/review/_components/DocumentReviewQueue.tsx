'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { CheckCircle, XCircle, RefreshCw, FileText, ExternalLink, Info } from 'lucide-react'

// Centro de revisión · pestaña Documentos (UX refactor §9.3). The operative queue of freshly-ingested
// documents awaiting human governance before they become trusted chat sources. Reuses the corpus
// governance APIs (list + atomic per-doc approve/reject RPC). NOTE: approving a document does NOT
// publish metrics to Tower Control — that's the Métricas tab.

type DocRow = {
  id: string; title: string | null; project_id: string | null; doc_type: string | null
  period: string | null; review_status: string; authority_score: number | null; authority_tier: string | null
  classification_source: string; source_channel: string | null; chunk_count: number | null
  classification_confidence: number | null; created_at: string
}

export function DocumentReviewQueue() {
  const [rows, setRows] = useState<DocRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<false | 'auth' | 'error'>(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setErr(false)
    try {
      // sort=review → lowest classifier confidence + oldest first (deepest uncertainty surfaces first)
      const r = await fetch('/api/knowledge/documents?status=needs_review&sort=review&pageSize=50')
      if (!r.ok) { setRows([]); setTotal(0); setErr(r.status === 401 ? 'auth' : 'error'); return }
      const j = await r.json()
      setRows(j.items ?? []); setTotal(j.total ?? 0)
    } catch (e) { console.error(e); setErr('error') } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function decide(id: string, action: 'approve' | 'reject') {
    if (busyId) return
    setBusyId(id)
    try {
      const r = await fetch(`/api/knowledge/documents/${id}`, {
        method: 'PATCH', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, reason: action === 'reject' ? 'rechazado en revisión' : undefined }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { toast.error(j.error || 'No se pudo aplicar la acción'); return }
      toast.success(action === 'approve' ? 'Documento aprobado como fuente' : 'Documento rechazado')
      setRows(prev => prev.filter(d => d.id !== id))
      setTotal(t => Math.max(0, t - 1))
    } catch { toast.error('Fallo de red') } finally { setBusyId(null) }
  }

  return (
    <div className="space-y-3">
      {/* Copy de ayuda (§9.3) */}
      <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
        <p>Aprobar un documento permite que el <strong>Chat</strong> lo use como fuente fiable. <strong>No</strong> publica métricas en Tower Control (eso se hace en la pestaña Métricas).</p>
      </div>

      <div className="flex items-center justify-between">
        <span className="font-mono text-xs tabular-nums text-slate-500">{total} documento{total !== 1 ? 's' : ''} sin revisar</span>
        <button onClick={load} disabled={loading} className="flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50">
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} /> Actualizar
        </button>
      </div>

      {err && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          No se pudieron cargar los documentos{err === 'auth' ? ' — la sesión pudo expirar.' : '.'}{' '}
          <button onClick={load} className="font-medium underline">Reintentar</button>
        </div>
      )}

      {!err && rows.length === 0 && !loading && (
        <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white">
          <FileText className="h-8 w-8 text-slate-300" />
          <p className="text-sm text-slate-500">No hay documentos pendientes de revisión.</p>
        </div>
      )}

      {rows.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">
                <th className="px-3 py-2.5">Documento</th>
                <th className="px-3 py-2.5">Proyecto</th>
                <th className="px-3 py-2.5">Tipo</th>
                <th className="px-3 py-2.5">Autoridad</th>
                <th className="px-3 py-2.5">Confianza</th>
                <th className="px-3 py-2.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(d => (
                <tr key={d.id} className="border-b border-slate-50 odd:bg-slate-50/30">
                  <td className="max-w-sm truncate px-3 py-2.5 font-medium text-slate-800">{d.title ?? '(sin título)'}</td>
                  <td className="px-3 py-2.5 text-slate-600">{d.project_id ?? '—'}</td>
                  <td className="px-3 py-2.5 text-slate-600">{d.doc_type ?? '—'}</td>
                  <td className="px-3 py-2.5 font-mono text-xs tabular-nums text-slate-600">{d.authority_score ?? 0} · {d.authority_tier ?? '—'}</td>
                  <td className="px-3 py-2.5 font-mono text-xs tabular-nums text-slate-500">{d.classification_confidence != null ? `${Math.round(d.classification_confidence * 100)}%` : '—'}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-1.5">
                      <button onClick={() => decide(d.id, 'approve')} disabled={busyId === d.id}
                        className="flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
                        <CheckCircle className="h-3.5 w-3.5" /> Aprobar como fuente
                      </button>
                      <button onClick={() => decide(d.id, 'reject')} disabled={busyId === d.id}
                        className="flex items-center gap-1 rounded-md bg-rose-600 px-2 py-1 text-xs font-medium text-white hover:bg-rose-700 disabled:opacity-50">
                        <XCircle className="h-3.5 w-3.5" /> Rechazar
                      </button>
                      <Link href={`/admin/documents?doc=${d.id}`} title="Abrir en Biblioteca"
                        className="rounded-md border border-slate-200 p-1 text-slate-500 hover:bg-slate-50">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
