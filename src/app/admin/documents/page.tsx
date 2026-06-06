'use client'
import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, Search, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'
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
const DOCTYPE_OPTIONS = ['', 'legal', 'board', 'funding', 'capex', 'cash_flow', 'bp_model', 'financial_statements', 'tax', 'kyc', 'dd', 'asset_management', 'monitoring', 'correspondence', 'general', 'other', 'unknown']
const PROJECT_OPTIONS = ['', 'MAD', 'BHX', 'KLP', 'PHILAE', 'GVF', 'ETP']

export default function DocumentsPage() {
  const [rows, setRows] = useState<DocRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<false | 'auth' | 'error'>(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [showUpload, setShowUpload] = useState(false)
  const [filters, setFilters] = useState({ status: '', doc_type: '', project: '', authority_min: '', q: '', onlyNeedsReview: false, onlyNoMarkdown: false, includeRetired: false })

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const sp = new URLSearchParams()
      sp.set('page', String(page)); sp.set('pageSize', '50')
      if (filters.status) sp.set('status', filters.status)
      if (filters.doc_type) sp.set('doc_type', filters.doc_type)
      if (filters.project) sp.set('project', filters.project)
      if (filters.authority_min) sp.set('authority_min', filters.authority_min)
      if (filters.q) sp.set('q', filters.q)
      if (filters.onlyNeedsReview) sp.set('onlyNeedsReview', 'true')
      if (filters.onlyNoMarkdown) sp.set('onlyNoMarkdown', 'true')
      if (filters.includeRetired) sp.set('includeRetired', 'true')
      const r = await fetch(`/api/knowledge/documents?${sp.toString()}`)
      if (!r.ok) { setRows([]); setTotal(0); setLoadError(r.status === 401 ? 'auth' : 'error'); return }
      const j: ListResp = await r.json()
      setRows(j.items ?? []); setTotal(j.total ?? 0)
    } catch (e) {
      console.error(e); setLoadError('error')
    } finally { setLoading(false) }
  }, [page, filters])

  useEffect(() => { load() }, [load])

  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-auto p-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-900">Gestor Documental</h1>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowUpload(s => !s)} className="flex items-center gap-2 rounded-md bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700">
              <Upload className="h-4 w-4" /> Subir documento
            </button>
            <button onClick={load} className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-slate-50">
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} /> Actualizar
            </button>
          </div>
        </div>

        {showUpload && <UploadPanel onClose={() => setShowUpload(false)} onUploaded={() => { setPage(1); load() }} />}

        <CorpusHealth />

        {/* Filters */}
        <div className="mb-3 mt-4 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-md border px-2">
            <Search className="h-4 w-4 text-slate-400" />
            <input value={filters.q} onChange={e => setFilters(f => ({ ...f, q: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && (setPage(1), load())}
              placeholder="Buscar título…" className="py-1.5 text-sm outline-none" />
          </div>
          <select value={filters.status} onChange={e => { setPage(1); setFilters(f => ({ ...f, status: e.target.value })) }} className="rounded-md border px-2 py-1.5 text-sm">
            {REVIEW_OPTIONS.map(o => <option key={o} value={o}>{o || 'Estado: todos'}</option>)}
          </select>
          <select value={filters.doc_type} onChange={e => { setPage(1); setFilters(f => ({ ...f, doc_type: e.target.value })) }} className="rounded-md border px-2 py-1.5 text-sm">
            {DOCTYPE_OPTIONS.map(o => <option key={o} value={o}>{o || 'Tipo: todos'}</option>)}
          </select>
          <select value={filters.project} onChange={e => { setPage(1); setFilters(f => ({ ...f, project: e.target.value })) }} className="rounded-md border px-2 py-1.5 text-sm">
            {PROJECT_OPTIONS.map(o => <option key={o} value={o}>{o || 'Proyecto: todos'}</option>)}
          </select>
          <input value={filters.authority_min} onChange={e => { setPage(1); setFilters(f => ({ ...f, authority_min: e.target.value })) }}
            placeholder="Auth≥" className="w-20 rounded-md border px-2 py-1.5 text-sm" />
          <label className="flex items-center gap-1 text-xs text-slate-600"><input type="checkbox" checked={filters.onlyNoMarkdown} onChange={e => { setPage(1); setFilters(f => ({ ...f, onlyNoMarkdown: e.target.checked })) }} /> sin markdown</label>
          <label className="flex items-center gap-1 text-xs text-slate-600"><input type="checkbox" checked={filters.includeRetired} onChange={e => { setPage(1); setFilters(f => ({ ...f, includeRetired: e.target.checked })) }} /> incluir retirados</label>
        </div>

        {/* Table */}
        <table className="w-full text-sm">
          <thead className="border-b text-left text-xs uppercase tracking-wide text-slate-400">
            <tr><th className="py-2">Título</th><th>Proj</th><th>Tipo</th><th>Auth</th><th>Estado</th><th>Trust</th><th>Chk</th></tr>
          </thead>
          <tbody>
            {rows.map(d => (
              <tr key={d.id} onClick={() => setSelected(d.id)}
                className={cn('cursor-pointer border-b hover:bg-slate-50', selected === d.id && 'bg-sky-50')}>
                <td className="max-w-md truncate py-2 font-medium text-slate-800">{d.title ?? '(sin título)'}</td>
                <td className="text-slate-500">{d.project_id ?? '—'}</td>
                <td className="text-slate-500">{d.doc_type ?? '—'}</td>
                <td><AuthorityBadge score={d.authority_score} tier={d.authority_tier} /></td>
                <td><ReviewBadge status={d.review_status} /></td>
                <td><VerificationBadge score={d.authority_score} review={d.review_status} source={d.classification_source} /></td>
                <td className="text-slate-400">{d.chunk_count ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {loadError && !loading && (
          <div className="mt-6 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <p className="font-medium">No se pudo cargar el listado{loadError === 'auth' ? ' — la sesión pudo expirar.' : '.'}</p>
            <div className="mt-3 flex items-center gap-3">
              <button onClick={load} className="rounded-md border border-amber-300 bg-white px-3 py-1.5 text-amber-800 hover:bg-amber-100">Reintentar</button>
              {loadError === 'auth' && <a href="/login" className="text-amber-700 underline hover:text-amber-900">Iniciar sesión</a>}
            </div>
          </div>
        )}
        {rows.length === 0 && !loading && !loadError && <p className="mt-6 text-center text-sm text-slate-400">Sin documentos para estos filtros.</p>}

        {/* Pagination */}
        <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
          <span>{total} documentos</span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="rounded border px-2 py-1 disabled:opacity-40">Anterior</button>
            <span className="px-2 py-1">Pág {page}</span>
            <button disabled={page * 50 >= total} onClick={() => setPage(p => p + 1)} className="rounded border px-2 py-1 disabled:opacity-40">Siguiente</button>
          </div>
        </div>
      </div>

      {selected && <DocumentPanel key={selected} docId={selected} onClose={() => setSelected(null)} onChanged={load} />}
    </div>
  )
}
