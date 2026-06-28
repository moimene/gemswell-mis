'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { RefreshCw, Search, Upload, Check, Ban, Sparkles } from 'lucide-react'
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
  smart_score?: number; smart_reason?: string; smart_role?: string
  smart_entities?: { kind: string; value: string }[]
  smart_snippets?: { chunk_id: string; chunk_index: number | null; text: string; relevance: number }[]
}
type ListResp = { items: DocRow[]; page: number; pageSize: number; total: number; totalPages: number }
type SmartResp = {
  items: DocRow[]
  total: number
  degraded: boolean
  retrievalIncomplete: boolean
  graphUsed: boolean
  graphEntities: string[]
  modelRerankUsed: boolean
  modelUsed: boolean
  model: string | null
  cacheHit: boolean
}
type SearchMode = 'title' | 'smart'
type SelectedDoc = { id: string; chunkIndex?: number | null }

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
  const [selected, setSelected] = useState<SelectedDoc | null>(null)
  const [showUpload, setShowUpload] = useState(false)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)
  const [searchMode, setSearchMode] = useState<SearchMode>('title')
  const [searchWithin, setSearchWithin] = useState('')
  const [smartMeta, setSmartMeta] = useState<Pick<SmartResp, 'degraded' | 'retrievalIncomplete' | 'graphUsed' | 'graphEntities' | 'modelRerankUsed' | 'modelUsed' | 'model' | 'cacheHit'> | null>(null)
  const [filters, setFilters] = useState({ status: '', doc_type: '', project: '', channel: '', authority_min: '', q: '', sort: 'authority', onlyNeedsReview: false, onlyNoMarkdown: false, includeRetired: false, onlyErrors: false })

  const displayRows = useMemo(() => {
    if (searchMode !== 'smart') return rows
    const term = searchWithin.trim().toLowerCase()
    if (!term) return rows
    return rows.filter((row) => [
      row.title,
      row.project_id,
      row.doc_type,
      row.smart_role,
      row.smart_reason,
      row.smart_entities?.map(entity => entity.value).join(' '),
      row.smart_snippets?.map(snippet => snippet.text).join(' '),
    ].filter(Boolean).join(' ').toLowerCase().includes(term))
  }, [rows, searchMode, searchWithin])

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    setChecked(new Set())
    try {
      if (searchMode === 'smart') {
        const q = filters.q.trim()
        if (q.length < 3) {
          setRows([]); setTotal(0); setSmartMeta(null); return
        }
        const r = await fetch('/api/knowledge/documents/intelligent-search', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            query: q,
            limit: 25,
            filters: {
              project: filters.project || undefined,
              doc_type: filters.doc_type || undefined,
              review_status: filters.onlyNeedsReview ? 'needs_review' : filters.status || undefined,
              authority_min: filters.authority_min ? Number(filters.authority_min) : undefined,
              channel: filters.channel || undefined,
              includeRetired: filters.includeRetired,
              onlyNoMarkdown: filters.onlyNoMarkdown,
              onlyErrors: filters.onlyErrors,
            },
          }),
        })
        if (!r.ok) { setRows([]); setTotal(0); setSmartMeta(null); setLoadError(r.status === 401 ? 'auth' : 'error'); return }
        const j: SmartResp = await r.json()
        setRows(j.items ?? []); setTotal(j.total ?? 0)
        setSmartMeta({
          degraded: j.degraded,
          retrievalIncomplete: j.retrievalIncomplete,
          graphUsed: j.graphUsed,
          graphEntities: j.graphEntities ?? [],
          modelRerankUsed: j.modelRerankUsed,
          modelUsed: j.modelUsed,
          model: j.model,
          cacheHit: j.cacheHit,
        })
        return
      }
      setSmartMeta(null)
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
  }, [page, filters, searchMode])

  function toggleRow(id: string) {
    setChecked(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }
  function toggleAll() {
    setChecked(prev => prev.size === displayRows.length ? new Set() : new Set(displayRows.map(r => r.id)))
  }
  function openDocument(id: string, chunkIndex?: number | null) {
    setSelected({ id, chunkIndex })
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.searchParams.set('doc', id)
      if (chunkIndex != null) url.searchParams.set('chunk', String(chunkIndex))
      else url.searchParams.delete('chunk')
      window.history.replaceState(null, '', url.toString())
    }
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
    const params = new URLSearchParams(window.location.search)
    const doc = params.get('doc')
    const chunk = params.get('chunk')
    if (doc) setSelected({ id: doc, chunkIndex: chunk != null ? Number(chunk) : null })
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

        {showUpload && <UploadPanel mode="async" onClose={() => setShowUpload(false)} onUploaded={() => { setPage(1); load() }} />}

        <CorpusHealth />

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-md border border-slate-200 bg-white p-0.5">
            <button type="button" onClick={() => { setPage(1); setSearchMode('title') }}
              className={cn('rounded px-2.5 py-1 text-xs font-medium', searchMode === 'title' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50')}>
              Título
            </button>
            <button type="button" onClick={() => { setPage(1); setSearchMode('smart') }}
              className={cn('flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium', searchMode === 'smart' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50')}>
              <Sparkles className="h-3.5 w-3.5" /> Inteligente
            </button>
          </div>
          <div className="flex items-center gap-1 rounded-md border border-slate-200 px-2">
            <Search className="h-4 w-4 text-slate-400" />
            <input value={filters.q} onChange={e => setFilters(f => ({ ...f, q: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && (setPage(1), load())}
              placeholder={searchMode === 'smart' ? 'Buscar contenido…' : 'Buscar título…'} className="py-1.5 text-sm text-slate-700 outline-none placeholder:text-slate-400" />
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

        {searchMode === 'smart' && smartMeta && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
            <span className="font-mono tabular-nums">{total} resultados inteligentes</span>
            <span className={cn('rounded px-1.5 py-0.5 font-mono uppercase tracking-wider', smartMeta.modelUsed ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500')}>
              {smartMeta.modelUsed ? `Modelo ${smartMeta.model ?? ''}` : 'Ranking local'}
            </span>
            {smartMeta.graphUsed && <span className="rounded bg-violet-50 px-1.5 py-0.5 font-mono uppercase tracking-wider text-violet-700">Grafo</span>}
            {smartMeta.modelRerankUsed && <span className="rounded bg-emerald-50 px-1.5 py-0.5 font-mono uppercase tracking-wider text-emerald-700">Rerank</span>}
            {smartMeta.cacheHit && <span className="rounded bg-sky-50 px-1.5 py-0.5 font-mono uppercase tracking-wider text-sky-700">Cache</span>}
            {(smartMeta.degraded || smartMeta.retrievalIncomplete) && <span className="rounded bg-amber-50 px-1.5 py-0.5 font-mono uppercase tracking-wider text-amber-700">Parcial</span>}
            <div className="ml-auto flex items-center gap-1 rounded-md border border-slate-200 px-2">
              <Search className="h-3.5 w-3.5 text-slate-400" />
              <input value={searchWithin} onChange={e => setSearchWithin(e.target.value)}
                placeholder="Filtrar resultados…" className="w-48 py-1 text-xs text-slate-700 outline-none placeholder:text-slate-400" />
            </div>
          </div>
        )}

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
                <th className="px-3 py-2.5"><input type="checkbox" aria-label="Seleccionar todo" checked={displayRows.length > 0 && checked.size === displayRows.length} onChange={toggleAll} /></th>
                <th className="px-3 py-2.5">Título</th>
                {searchMode === 'smart' && <th className="px-3 py-2.5">Score IA</th>}
                <th className="px-3 py-2.5">Proyecto</th>
                <th className="px-3 py-2.5">Tipo</th>
                <th className="px-3 py-2.5">Autoridad</th>
                <th className="px-3 py-2.5">Estado</th>
                <th className="px-3 py-2.5">Verificación</th>
                <th className="px-3 py-2.5 text-right">Fragm.</th>
              </tr>
            </thead>
            <tbody>
              {displayRows.map(d => (
                <tr key={d.id} onClick={() => openDocument(d.id)}
                  className={cn('cursor-pointer border-b border-slate-50 odd:bg-slate-50/30 hover:bg-slate-50', (selected?.id === d.id || checked.has(d.id)) && 'bg-sky-50')}>
                  <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                    <input type="checkbox" aria-label="Seleccionar" checked={checked.has(d.id)} onChange={() => toggleRow(d.id)} />
                  </td>
                  <td className="max-w-md px-3 py-2.5">
                    <div className="truncate font-medium text-slate-800">{d.title ?? '(sin título)'}</div>
                    {searchMode === 'smart' && (
                      <div className="mt-1 space-y-1">
                        {d.smart_reason && <p className="line-clamp-2 text-xs text-slate-500">{d.smart_reason}</p>}
                        {!!d.smart_entities?.length && (
                          <div className="flex flex-wrap gap-1">
                            {d.smart_entities.slice(0, 5).map(entity => (
                              <span key={`${entity.kind}-${entity.value}`} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">{entity.value}</span>
                            ))}
                          </div>
                        )}
                        {(d.smart_snippets ?? []).slice(0, 2).map(s => (
                          <button key={s.chunk_id} type="button" onClick={e => { e.stopPropagation(); openDocument(d.id, s.chunk_index) }}
                            className="block w-full truncate text-left font-mono text-[10px] text-slate-400 hover:text-slate-700">
                            {s.chunk_index != null ? `#${s.chunk_index} · ` : ''}{s.text}
                          </button>
                        ))}
                      </div>
                    )}
                  </td>
                  {searchMode === 'smart' && (
                    <td className="px-3 py-2.5">
                      <div className="font-mono text-xs font-semibold tabular-nums text-slate-700">{Math.round((d.smart_score ?? 0) * 100)}%</div>
                      {d.smart_role && <div className="mt-1 text-[10px] uppercase tracking-wider text-slate-400">{d.smart_role}</div>}
                    </td>
                  )}
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
          {loading && displayRows.length === 0 && !loadError && (
            <div className="flex flex-col items-center gap-3 py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
              <p className="font-mono text-xs text-slate-400">Cargando documentos…</p>
            </div>
          )}
          {displayRows.length === 0 && !loading && !loadError && <p className="py-12 text-center font-mono text-xs text-slate-400">Sin documentos para estos filtros.</p>}
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
          <span className="font-mono tabular-nums">{searchMode === 'smart' && searchWithin ? `${displayRows.length}/${total} documentos` : `${total} documentos`}</span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="rounded border border-slate-200 px-2 py-1 hover:bg-slate-50 disabled:opacity-40">Anterior</button>
            <span className="px-2 py-1 font-mono tabular-nums">Pág {page}</span>
            <button disabled={page * 50 >= total} onClick={() => setPage(p => p + 1)} className="rounded border border-slate-200 px-2 py-1 hover:bg-slate-50 disabled:opacity-40">Siguiente</button>
          </div>
        </div>
      </div>

      {selected && <DocumentPanel key={`${selected.id}:${selected.chunkIndex ?? ''}`} docId={selected.id} targetChunkIndex={selected.chunkIndex ?? null} onClose={() => setSelected(null)} onChanged={load} />}
    </div>
  )
}
