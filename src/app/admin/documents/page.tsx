'use client'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { RefreshCw, Search, Upload, Check, Ban } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/shared/terminal'
import { DOC_TYPE_OPTIONS } from '@/lib/knowledge/contracts'
import { ReviewBadge, AuthorityBadge, VerificationBadge } from './_components/badges'
import { DocumentPanel } from './_components/DocumentPanel'
import { CorpusHealth } from './_components/CorpusHealth'
import { UploadPanel } from './_components/UploadPanel'

type DocRow = {
  id: string; title: string | null; project_id: string | null; doc_type: string | null
  period: string | null; review_status: string; authority_score: number | null; authority_tier: string | null
  classification_source: string; status: string; source_channel: string | null; chunk_count: number | null
  summary: string | null; md_path: string | null
}
type ListResp = { items: DocRow[]; page: number; pageSize: number; total: number; totalPages: number }

const REVIEW_OPTIONS = ['', 'needs_review', 'approved', 'rejected', 'pending']
const REVIEW_LABELS: Record<string, string> = { needs_review: 'Sin revisar', approved: 'Aprobado', rejected: 'Rechazado', pending: 'Pendiente' }
const DOCTYPE_OPTIONS = ['', ...DOC_TYPE_OPTIONS]
const PROJECT_OPTIONS = ['', 'MAD', 'BHX', 'KLP', 'PHILAE', 'GVF', 'ETP']
const SOURCE_CHANNEL_OPTIONS = [
  ['', 'Origen: todos'],
  ['browser_upload', 'Origen: upload navegador'],
  ['manual_admin', 'Origen: legacy/manual'],
  ['local_backfill', 'Origen: backfill local'],
  ['drive_sync', 'Origen: Drive'],
  ['gmail_bot', 'Origen: Gmail'],
] as const

export default function DocumentsPage() {
  const [rows, setRows] = useState<DocRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<false | 'auth' | 'error'>(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [showUpload, setShowUpload] = useState(false)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)
  const [filters, setFilters] = useState({ status: '', doc_type: '', project: '', channel: '', authority_min: '', q: '', sort: 'authority', onlyNeedsReview: false, onlyNoMarkdown: false, includeRetired: false, onlyErrors: false })

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    setChecked(new Set())
    try {
      const sp = new URLSearchParams()
      sp.set('page', String(page)); sp.set('pageSize', '50')
      if (filters.status) sp.set('status', filters.status)
      if (filters.doc_type) sp.set('doc_type', filters.doc_type)
      if (filters.project) sp.set('project', filters.project)
      if (filters.channel) sp.set('channel', filters.channel)
      if (filters.authority_min) sp.set('authority_min', filters.authority_min)
      if (filters.q) sp.set('q', filters.q)
      if (filters.sort === 'review') sp.set('sort', 'review')
      if (filters.onlyNeedsReview) sp.set('onlyNeedsReview', 'true')
      if (filters.onlyNoMarkdown) sp.set('onlyNoMarkdown', 'true')
      if (filters.includeRetired) sp.set('includeRetired', 'true')
      if (filters.onlyErrors) sp.set('onlyErrors', 'true')
      const r = await fetch(`/api/knowledge/documents?${sp.toString()}`)
      if (!r.ok) { setRows([]); setTotal(0); setLoadError(r.status === 401 ? 'auth' : 'error'); return }
      const j: ListResp = await r.json()
      setRows(j.items ?? []); setTotal(j.total ?? 0)
    } catch (e) {
      console.error(e); setLoadError('error')
    } finally { setLoading(false) }
  }, [page, filters])

  function toggleRow(id: string) {
    setChecked(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }
  function toggleAll() {
    setChecked(prev => prev.size === rows.length ? new Set() : new Set(rows.map(r => r.id)))
  }

  // F18: bulk governance — approve/reject every selected doc via the same atomic per-doc RPC.
  async function bulkApply(action: 'approve' | 'reject') {
    if (bulkBusy || checked.size === 0) return
    if (action === 'reject' && !confirm(`¿Rechazar ${checked.size} documento(s)? Quedarán excluidos del chat.`)) return
    setBulkBusy(true)
    const ids = [...checked]
    let ok = 0, fail = 0
    for (const id of ids) {
      try {
        const r = await fetch(`/api/knowledge/documents/${id}`, {
          method: 'PATCH', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action, reason: action === 'reject' ? 'bulk reject' : undefined }),
        })
        if (r.ok) ok++; else fail++
      } catch { fail++ }
    }
    setBulkBusy(false)
    if (ok) toast.success(`${ok} documento(s) ${action === 'approve' ? 'aprobados' : 'rechazados'}.`)
    if (fail) toast.error(`${fail} fallaron (recarga e inténtalo de nuevo).`)
    load()
  }

  useEffect(() => { load() }, [load])

  // Deep-link from a chat citation: /admin/documents?doc=<id> opens that document's detail directly
  // (the panel fetches by id, so it works even when the doc isn't on the current list page). F1.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const doc = new URLSearchParams(window.location.search).get('doc')
    if (doc) setSelected(doc)
  }, [])

  return (
    <div className="flex h-full">
      <div className="flex-1 space-y-4 overflow-auto p-6">
        <PageHeader
          eyebrow="Gemswell Ventures · MIS · Documentos & Reporting"
          title="Biblioteca documental"
          subtitle="Busca, consulta y gobierna los documentos del corpus."
          right={
            <>
              <button onClick={() => setShowUpload(s => !s)} className="flex items-center gap-2 rounded-md bg-white/10 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/20">
                <Upload className="h-4 w-4" /> Subir documento
              </button>
              <button onClick={load} className="flex items-center gap-2 rounded-md border border-white/20 px-3 py-1.5 text-sm text-white hover:bg-white/10">
                <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} /> Actualizar
              </button>
            </>
          }
        />

        {showUpload && <UploadPanel onClose={() => setShowUpload(false)} onUploaded={() => { setPage(1); load() }} />}

        <CorpusHealth />

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-md border border-slate-200 px-2">
            <Search className="h-4 w-4 text-slate-400" />
            <input value={filters.q} onChange={e => setFilters(f => ({ ...f, q: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && (setPage(1), load())}
              placeholder="Buscar título…" className="py-1.5 text-sm text-slate-700 outline-none placeholder:text-slate-400" />
          </div>
          <select value={filters.status} onChange={e => { setPage(1); setFilters(f => ({ ...f, status: e.target.value })) }} className="rounded-md border border-slate-200 px-2 py-1.5 text-sm text-slate-700">
            {REVIEW_OPTIONS.map(o => <option key={o} value={o}>{o ? REVIEW_LABELS[o] : 'Estado: todos'}</option>)}
          </select>
          <select value={filters.doc_type} onChange={e => { setPage(1); setFilters(f => ({ ...f, doc_type: e.target.value })) }} className="rounded-md border border-slate-200 px-2 py-1.5 text-sm text-slate-700">
            {DOCTYPE_OPTIONS.map(o => <option key={o} value={o}>{o || 'Tipo: todos'}</option>)}
          </select>
          <select value={filters.project} onChange={e => { setPage(1); setFilters(f => ({ ...f, project: e.target.value })) }} className="rounded-md border border-slate-200 px-2 py-1.5 text-sm text-slate-700">
            {PROJECT_OPTIONS.map(o => <option key={o} value={o}>{o || 'Proyecto: todos'}</option>)}
          </select>
          <select value={filters.channel} onChange={e => { setPage(1); setFilters(f => ({ ...f, channel: e.target.value })) }} className="rounded-md border border-slate-200 px-2 py-1.5 text-sm text-slate-700">
            {SOURCE_CHANNEL_OPTIONS.map(([value, label]) => <option key={value || 'all'} value={value}>{label}</option>)}
          </select>
          <input value={filters.authority_min} onChange={e => { setPage(1); setFilters(f => ({ ...f, authority_min: e.target.value })) }}
            placeholder="Auth ≥" className="w-20 rounded-md border border-slate-200 px-2 py-1.5 text-sm text-slate-700 placeholder:text-slate-400" />
          <select value={filters.sort} onChange={e => { setPage(1); setFilters(f => ({ ...f, sort: e.target.value })) }} className="rounded-md border border-slate-200 px-2 py-1.5 text-sm text-slate-700" title="Orden">
            <option value="authority">Orden: autoridad</option>
            <option value="review">Orden: prioridad de revisión</option>
          </select>
          <label className="flex items-center gap-1 text-xs text-slate-600"><input type="checkbox" checked={filters.onlyNeedsReview} onChange={e => { setPage(1); setFilters(f => ({ ...f, onlyNeedsReview: e.target.checked })) }} /> Solo sin revisar</label>
          <label className="flex items-center gap-1 text-xs text-slate-600"><input type="checkbox" checked={filters.onlyNoMarkdown} onChange={e => { setPage(1); setFilters(f => ({ ...f, onlyNoMarkdown: e.target.checked })) }} /> Sin markdown</label>
          <label className="flex items-center gap-1 text-xs text-slate-600"><input type="checkbox" checked={filters.includeRetired} onChange={e => { setPage(1); setFilters(f => ({ ...f, includeRetired: e.target.checked })) }} /> Incluir retirados</label>
          <label className="flex items-center gap-1 text-xs text-slate-600"><input type="checkbox" checked={filters.onlyErrors} onChange={e => { setPage(1); setFilters(f => ({ ...f, onlyErrors: e.target.checked })) }} /> Solo errores</label>
        </div>

        {/* F18: bulk governance action bar (appears when rows are selected) */}
        {checked.size > 0 && (
          <div className="flex items-center gap-3 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm">
            <span className="font-medium text-sky-800">{checked.size} seleccionado(s)</span>
            <button disabled={bulkBusy} onClick={() => bulkApply('approve')} className="flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
              <Check className="h-3.5 w-3.5" /> Aprobar
            </button>
            <button disabled={bulkBusy} onClick={() => bulkApply('reject')} className="flex items-center gap-1 rounded-md bg-rose-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-rose-700 disabled:opacity-50">
              <Ban className="h-3.5 w-3.5" /> Rechazar
            </button>
            <button disabled={bulkBusy} onClick={() => setChecked(new Set())} className="text-xs text-slate-500 hover:text-slate-700">Limpiar</button>
            {bulkBusy && <span className="font-mono text-xs text-slate-400">aplicando…</span>}
          </div>
        )}

        {/* Tabla */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">
                <th className="px-3 py-2.5"><input type="checkbox" aria-label="Seleccionar todo" checked={rows.length > 0 && checked.size === rows.length} onChange={toggleAll} /></th>
                <th className="px-3 py-2.5">Título</th>
                <th className="px-3 py-2.5">Proyecto</th>
                <th className="px-3 py-2.5">Tipo</th>
                <th className="px-3 py-2.5">Autoridad</th>
                <th className="px-3 py-2.5">Estado</th>
                <th className="px-3 py-2.5">Verificación</th>
                <th className="px-3 py-2.5 text-right">Fragm.</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(d => (
                <tr key={d.id} onClick={() => setSelected(d.id)}
                  className={cn('cursor-pointer border-b border-slate-50 odd:bg-slate-50/30 hover:bg-slate-50', (selected === d.id || checked.has(d.id)) && 'bg-sky-50')}>
                  <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                    <input type="checkbox" aria-label="Seleccionar" checked={checked.has(d.id)} onChange={() => toggleRow(d.id)} />
                  </td>
                  <td className="max-w-md truncate px-3 py-2.5 font-medium text-slate-800">{d.title ?? '(sin título)'}</td>
                  <td className="px-3 py-2.5 text-slate-600">{d.project_id ?? '—'}</td>
                  <td className="px-3 py-2.5 text-slate-600">{d.doc_type ?? '—'}</td>
                  <td className="px-3 py-2.5"><AuthorityBadge score={d.authority_score} tier={d.authority_tier} /></td>
                  <td className="px-3 py-2.5">
                    {d.status === 'error'
                      ? <span className="rounded bg-rose-50 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-rose-700">Error ingesta</span>
                      : <ReviewBadge status={d.review_status} />}
                  </td>
                  <td className="px-3 py-2.5"><VerificationBadge score={d.authority_score} review={d.review_status} source={d.classification_source} /></td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-600">{d.chunk_count ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {loading && rows.length === 0 && !loadError && (
            <div className="flex flex-col items-center gap-3 py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
              <p className="font-mono text-xs text-slate-400">Cargando documentos…</p>
            </div>
          )}
          {rows.length === 0 && !loading && !loadError && <p className="py-12 text-center font-mono text-xs text-slate-400">Sin documentos para estos filtros.</p>}
        </div>

        {loadError && !loading && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 shadow-sm">
            <p className="font-medium">No se pudo cargar el listado{loadError === 'auth' ? ' — la sesión pudo expirar.' : '.'}</p>
            <div className="mt-3 flex items-center gap-3">
              <button onClick={load} className="rounded-md border border-amber-300 bg-white px-3 py-1.5 text-amber-800 hover:bg-amber-100">Reintentar</button>
              {loadError === 'auth' && <a href="/login" className="text-amber-700 underline hover:text-amber-900">Iniciar sesión</a>}
            </div>
          </div>
        )}

        {/* Paginación */}
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span className="font-mono tabular-nums">{total} documentos</span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="rounded border border-slate-200 px-2 py-1 hover:bg-slate-50 disabled:opacity-40">Anterior</button>
            <span className="px-2 py-1 font-mono tabular-nums">Pág {page}</span>
            <button disabled={page * 50 >= total} onClick={() => setPage(p => p + 1)} className="rounded border border-slate-200 px-2 py-1 hover:bg-slate-50 disabled:opacity-40">Siguiente</button>
          </div>
        </div>
      </div>

      {selected && <DocumentPanel key={selected} docId={selected} onClose={() => setSelected(null)} onChanged={load} />}
    </div>
  )
}
