'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/shared/terminal'
import { UploadPanel, type UploadResult } from '@/app/admin/documents/_components/UploadPanel'
import { Info, ArrowRight, FileInput, FileCheck2, CheckCircle2, RefreshCw, AlertTriangle, RotateCcw, XCircle } from 'lucide-react'

// Ingesta documental (UX refactor §8). Solo ENCOLA documentos generales en el corpus (mismo motor que
// la subida de la Biblioteca: parse → clasificación → embeddings → needs_review). NO aprueba ni
// publica métricas — eso ocurre después en el Centro de revisión. Sin botón "Procesar ahora" (§21):
// la ingesta es asíncrona y la revisión es un paso aparte.

type CorpusHealth = {
  total: number
  governance: { approved?: number; needs_review?: number; rejected?: number; pending?: number }
  pct_markdown: number
  pct_source_hash: number
  queue: { total: number; queued: number; processing: number; done: number; error: number }
}

type IngestJobStatus = 'queued' | 'processing' | 'done' | 'error' | 'canceled'
type IngestJob = {
  id: string
  created_at: string
  updated_at: string
  status: IngestJobStatus
  stage: string
  attempts: number
  max_attempts: number
  file_name: string
  file_size: number | null
  project_id: string | null
  doc_type_hint: string | null
  document_id: string | null
  chunks: number | null
  parser: string | null
  error_message: string | null
}
type IngestJobsResp = {
  items: IngestJob[]
  summary: Record<IngestJobStatus, number> & { total: number; unavailable?: boolean }
  unavailable?: boolean
}

function pct(v: number): string {
  return `${Math.round((v || 0) * 100)}%`
}

function formatBytes(v: number | null): string {
  if (!v) return '—'
  if (v >= 1024 * 1024) return `${(v / 1024 / 1024).toFixed(1)} MB`
  return `${Math.round(v / 1024)} KB`
}

function IngestStatusPanel() {
  const [health, setHealth] = useState<CorpusHealth | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setErr(false)
    try {
      const r = await fetch('/api/knowledge/corpus/health')
      if (!r.ok) { setErr(true); return }
      setHealth(await r.json() as CorpusHealth)
    } catch {
      setErr(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="font-mono text-[11px] font-bold uppercase tracking-widest text-slate-500">Estado de ingesta</h2>
          <p className="mt-1 text-sm text-slate-500">Revisión pendiente y cobertura técnica del corpus.</p>
        </div>
        <button onClick={load} disabled={loading} className="flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Actualizar
        </button>
      </div>
      {err && <p className="text-sm text-amber-700">No se pudo cargar el estado. La subida sigue disponible.</p>}
      {!err && !health && <p className="font-mono text-xs text-slate-400">Cargando estado…</p>}
      {health && (
        <div className="grid gap-2 sm:grid-cols-4">
          <Stat label="Cola legacy" value={health.queue.queued + health.queue.processing} tone={health.queue.error > 0 ? 'amber' : 'slate'} />
          <Stat label="Errores legacy" value={health.queue.error} tone={health.queue.error > 0 ? 'red' : 'slate'} />
          <Stat label="Sin revisar" value={health.governance.needs_review ?? 0} tone={(health.governance.needs_review ?? 0) > 0 ? 'amber' : 'slate'} />
          <Stat label="Artifact/hash" value={`${pct(health.pct_markdown)} / ${pct(health.pct_source_hash)}`} tone={health.pct_source_hash < 0.5 ? 'amber' : 'slate'} />
        </div>
      )}
    </div>
  )
}

function JobStatusBadge({ status }: { status: IngestJobStatus }) {
  const cls = status === 'done' ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
    : status === 'error' ? 'bg-rose-50 text-rose-700 border-rose-100'
      : status === 'processing' ? 'bg-sky-50 text-sky-700 border-sky-100'
        : 'bg-slate-50 text-slate-600 border-slate-100'
  const label = status === 'queued' ? 'en cola'
    : status === 'processing' ? 'procesando'
      : status === 'done' ? 'indexado'
        : status === 'canceled' ? 'cancelado'
          : 'error'
  return <span className={`rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest ${cls}`}>{label}</span>
}

function IngestJobsPanel({ refreshKey }: { refreshKey: number }) {
  const [items, setItems] = useState<IngestJob[]>([])
  const [summary, setSummary] = useState<IngestJobsResp['summary'] | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [retrying, setRetrying] = useState<string | null>(null)
  const [canceling, setCanceling] = useState<string | null>(null)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    setErr(null)
    try {
      const r = await fetch('/api/knowledge/ingest/jobs?limit=20')
      if (!r.ok) { setErr('No se pudo cargar la cola de jobs.'); return }
      const data = await r.json() as IngestJobsResp
      if (data.unavailable) setErr('La migración sql/031 aún no está aplicada; la cola durable no está disponible.')
      setItems(data.items ?? [])
      setSummary(data.summary ?? null)
    } catch {
      setErr('No se pudo cargar la cola de jobs.')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load, refreshKey])

  // Auto-refresh while jobs are in flight so stage transitions (queued → processing → indexed) show live,
  // not only on manual "Actualizar". Polls silently every 4s; stops once nothing is queued/processing.
  const activeCount = (summary?.queued ?? 0) + (summary?.processing ?? 0)
  useEffect(() => {
    if (activeCount <= 0) return
    const t = setInterval(() => { load(true) }, 4000)
    return () => clearInterval(t)
  }, [activeCount, load])

  async function retry(id: string) {
    setRetrying(id)
    setErr(null)
    try {
      const r = await fetch(`/api/knowledge/ingest/jobs/${id}/retry`, { method: 'POST' })
      const data = await r.json().catch(() => ({})) as { error?: string }
      if (!r.ok) { setErr(data.error ?? 'No se pudo reintentar el job.'); return }
      await load()
    } catch {
      setErr('No se pudo reintentar el job.')
    } finally {
      setRetrying(null)
    }
  }

  async function cancel(id: string) {
    setCanceling(id)
    setErr(null)
    try {
      const r = await fetch(`/api/knowledge/ingest/jobs/${id}/cancel`, { method: 'POST' })
      const data = await r.json().catch(() => ({})) as { error?: string }
      if (!r.ok) { setErr(data.error ?? 'No se pudo cancelar el job.'); return }
      await load()
    } catch {
      setErr('No se pudo cancelar el job.')
    } finally {
      setCanceling(null)
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-mono text-[11px] font-bold uppercase tracking-widest text-slate-500">Cola durable</h2>
          <p className="mt-1 text-sm text-slate-500">Jobs de upload procesados por cron/worker con retry visible. Se actualiza sola mientras hay jobs activos.</p>
        </div>
        <button onClick={() => load()} disabled={loading} className="flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Actualizar
        </button>
      </div>
      {summary && (
        <div className="mb-3 flex flex-wrap gap-2 text-xs text-slate-500">
          <span>{summary.total} total</span>
          <span>{summary.queued} en cola</span>
          <span>{summary.processing} procesando</span>
          <span>{summary.done} indexados</span>
          <span className={summary.error > 0 ? 'font-medium text-rose-700' : ''}>{summary.error} errores</span>
        </div>
      )}
      {err && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {err}
        </div>
      )}
      {!loading && items.length === 0 && !err && (
        <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">No hay jobs recientes.</p>
      )}
      {items.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-slate-100">
          <ul className="divide-y divide-slate-100">
            {items.map(job => (
              <li key={job.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5 text-sm">
                <JobStatusBadge status={job.status} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-800">{job.file_name}</p>
                  <p className="font-mono text-[10px] text-slate-400">
                    {formatBytes(job.file_size)} · {job.stage} · intento {job.attempts}/{job.max_attempts} · {job.project_id ?? 'auto'} · {job.doc_type_hint ?? 'auto'}
                  </p>
                  {job.error_message && <p className="mt-1 text-xs text-rose-700">{job.error_message}</p>}
                </div>
                {job.document_id && (
                  <Link href={`/admin/documents?doc=${job.document_id}`} className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 underline">
                    ficha <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                )}
                {job.status === 'error' && (
                  <button
                    onClick={() => retry(job.id)}
                    disabled={retrying === job.id}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                  >
                    <RotateCcw className={`h-3.5 w-3.5 ${retrying === job.id ? 'animate-spin' : ''}`} /> Reintentar
                  </button>
                )}
                {(job.status === 'queued' || job.status === 'error') && (
                  <button
                    onClick={() => cancel(job.id)}
                    disabled={canceling === job.id}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                  >
                    <XCircle className={`h-3.5 w-3.5 ${canceling === job.id ? 'animate-spin' : ''}`} /> Cancelar
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone: 'slate' | 'amber' | 'red' }) {
  const cls = tone === 'red' ? 'text-rose-700' : tone === 'amber' ? 'text-amber-700' : 'text-slate-800'
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
      <p className={`font-mono text-lg font-bold tabular-nums ${cls}`}>{value}</p>
      <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
    </div>
  )
}

export default function IngestaPage() {
  // Re-key the panel after a successful upload so the form resets cleanly for the next document.
  const [round, setRound] = useState(0)
  const [jobsRefreshKey, setJobsRefreshKey] = useState(0)
  const [lastUpload, setLastUpload] = useState<UploadResult | null>(null)

  return (
    <div className="space-y-4 p-6">
      <PageHeader
        eyebrow="Gemswell Ventures · MIS · Documentos & Reporting"
        title="Ingesta documental"
        subtitle="Encola documentos para incorporarlos al corpus. La revisión y publicación se hacen después."
      />

      <IngestStatusPanel />

      {/* Aviso fijo (§8.3) */}
      <div className="flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2.5 text-sm text-sky-900">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
        <p>Esta pantalla <strong>no aprueba documentos ni publica métricas</strong>. Solo prepara documentos para revisión. Cada documento queda en estado <em>sin revisar</em> y pasa al <Link href="/admin/review" className="font-medium underline">Centro de revisión</Link>.</p>
      </div>

      {/* Qué entra / Qué sale */}
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-widest text-slate-500"><FileInput className="h-4 w-4" /> Qué entra</div>
          <ul className="space-y-1 text-sm text-slate-600">
            <li>· Documentos sueltos (PDF, DOCX, XLSX, TXT…)</li>
            <li>· XLS no asociados a un pack</li>
            <li>· Contratos, actas, modelos</li>
            <li>· Evidencias complementarias</li>
          </ul>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-widest text-slate-500"><FileCheck2 className="h-4 w-4" /> Qué sale</div>
          <ul className="space-y-1 text-sm text-slate-600">
            <li>· Documento en el corpus, sin revisar</li>
            <li>· Pendiente de revisión documental</li>
            <li>· Métricas candidatas, si aplica</li>
            <li>· Fuente fiable para el Chat tras aprobarse</li>
          </ul>
        </div>
      </div>

      {/* Motor de subida (mismo que la Biblioteca) */}
      <UploadPanel
        key={round}
        mode="async"
        onClose={() => setRound(r => r + 1)}
        onUploaded={(result) => { setLastUpload(result); setRound(r => r + 1); setJobsRefreshKey(k => k + 1) }}
      />

      {lastUpload?.jobId && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2.5 text-sm text-sky-900">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-sky-600" />
          <span className="font-medium">{lastUpload.file}</span>
          <span className="text-sky-700">encolado · el worker lo procesará en segundo plano</span>
          <button onClick={() => setJobsRefreshKey(k => k + 1)} className="ml-auto inline-flex items-center gap-1 font-medium underline">
            Ver cola <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {lastUpload?.documentId && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-900">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span className="font-medium">{lastUpload.file}</span>
          <span className="text-emerald-700">{lastUpload.chunks ?? 0} fragmentos · pendiente de revisión</span>
          <Link href={`/admin/documents?doc=${lastUpload.documentId}`} className="ml-auto inline-flex items-center gap-1 font-medium underline">
            Abrir ficha <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/admin/review" className="inline-flex items-center gap-1 font-medium underline">
            Revisar <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}

      <IngestJobsPanel refreshKey={jobsRefreshKey} />

      <div className="flex items-center gap-3 text-sm">
        <Link href="/admin/review" className="inline-flex items-center gap-1 font-medium text-slate-700 hover:text-slate-900">
          Ir al Centro de revisión <ArrowRight className="h-4 w-4" />
        </Link>
        <span className="text-slate-300">·</span>
        <Link href="/admin/documents" className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900">
          Ver Biblioteca documental <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  )
}
