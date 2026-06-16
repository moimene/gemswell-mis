'use client'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Upload, X, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { DOC_TYPE_OPTIONS } from '@/lib/knowledge/contracts'

const PROJECTS = ['', 'MAD', 'BHX', 'KLP', 'PHILAE', 'GVF', 'ETP']
const DOCTYPES = ['', ...DOC_TYPE_OPTIONS]
const ACCEPT = '.pdf,.docx,.xlsx,.xls,.csv,.txt,.pptx'
const MAX_MB = 50

export type UploadResult = {
  ok: boolean
  file: string
  documentId?: string
  jobId?: string
  status?: 'queued' | 'processing' | 'done' | 'error'
  chunks?: number
  parser?: string
  reused?: boolean
  duplicateTitleCount?: number
}

/** Browser upload → governed ingest. The raw file is PUT directly to Storage via a signed URL
 *  (bypassing the serverless body cap, F3), then ingested server-side: parsed, classified, chunked,
 *  embedded and indexed; it then appears in the list (typically as "needs_review"). */
export function UploadPanel({
  onClose,
  onUploaded,
  mode = 'sync',
}: {
  onClose: () => void
  onUploaded: (result: UploadResult) => void
  mode?: 'sync' | 'async'
}) {
  const [file, setFile] = useState<File | null>(null)
  const [project, setProject] = useState('')
  const [docType, setDocType] = useState('')
  const [busy, setBusy] = useState(false)
  const [stage, setStage] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  async function submit() {
    if (!file || busy) return
    if (file.size > MAX_MB * 1024 * 1024) { toast.error(`El archivo supera ${MAX_MB} MB`); return }
    if (file.size === 0) { toast.error('El archivo está vacío'); return }
    setBusy(true)
    try {
      // 1) signed upload URL
      setStage('Preparando subida…')
      const signRes = await fetch('/api/knowledge/upload/sign', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, fileSize: file.size }),
      })
      const sign = await signRes.json().catch(() => ({}))
      if (signRes.status === 401) { toast.error('Sesión expirada — vuelve a iniciar sesión'); return }
      if (!signRes.ok) { toast.error(sign.error || 'No se pudo preparar la subida'); return }

      // 2) PUT the raw file straight to Storage (no serverless body limit)
      setStage('Subiendo archivo…')
      const supabase = createClient()
      const up = await supabase.storage.from(sign.bucket).uploadToSignedUrl(sign.path, sign.token, file)
      if (up.error) { toast.error(`Fallo al subir a Storage: ${up.error.message}`); return }

      // 3) server-side handoff. Beta upload surfaces use async jobs; sync mode is kept for explicit callers.
      setStage(mode === 'async' ? 'Encolando ingesta…' : 'Procesando (parse · clasificación · embeddings)…')
      const endpoint = mode === 'async' ? '/api/knowledge/ingest/jobs' : '/api/knowledge/upload'
      const r = await fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storagePath: sign.path,
          fileName: file.name,
          fileSize: file.size,
          project_id: project || undefined,
          doc_type: docType || undefined,
        }),
      })
      const j = await r.json().catch(() => ({})) as Partial<UploadResult> & { error?: string; job?: { id: string; status: UploadResult['status'] } }
      if (r.status === 401) { toast.error('Sesión expirada — vuelve a iniciar sesión'); return }
      if (!r.ok) { toast.error(j.error || 'No se pudo procesar el documento'); return }
      if (mode === 'async') {
        toast.success(`«${file.name}» encolado para ingesta. Puedes cerrar la página.`)
        onUploaded({ ok: true, file: file.name, jobId: j.job?.id, status: j.job?.status ?? 'queued' })
        onClose()
        return
      }
      toast.success(`«${j.file}» ingestado: ${j.chunks} fragmentos${j.reused ? ' (re-ingesta)' : ''}. Queda en revisión.`)
      if (!j.reused && (j.duplicateTitleCount ?? 0) > 0) {
        toast.warning(`Aviso: ya existían ${j.duplicateTitleCount} documento(s) con este nombre en el corpus.`)
      }
      onUploaded(j as UploadResult)
      onClose()
    } catch {
      toast.error('Fallo de red al subir el documento')
    } finally {
      setBusy(false)
      setStage('')
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-mono text-[11px] font-bold uppercase tracking-widest text-slate-500">Subir documento al corpus</h2>
        <button onClick={onClose} disabled={busy} className="text-slate-400 hover:text-slate-700 disabled:opacity-40"><X className="h-4 w-4" /></button>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">Archivo (PDF, DOCX, XLSX, CSV, TXT · ≤50 MB)</label>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            onChange={e => setFile(e.target.files?.[0] ?? null)}
            disabled={busy}
            className="text-sm text-slate-700 file:mr-3 file:rounded file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-white hover:file:bg-slate-800"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">Proyecto</label>
          <select value={project} onChange={e => setProject(e.target.value)} disabled={busy} className="rounded border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700">
            {PROJECTS.map(p => <option key={p} value={p}>{p || '— (auto)'}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">Tipo (opcional)</label>
          <select value={docType} onChange={e => setDocType(e.target.value)} disabled={busy} className="rounded border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700">
            {DOCTYPES.map(d => <option key={d} value={d}>{d || '— (auto-clasificar)'}</option>)}
          </select>
        </div>
        <button
          onClick={submit}
          disabled={!file || busy}
          className="flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {busy ? (mode === 'async' ? 'Encolando…' : 'Procesando…') : (mode === 'async' ? 'Subir y encolar' : 'Subir e ingestar')}
        </button>
      </div>
      {busy && (
        <p className="mt-2 font-mono text-[11px] text-slate-500">
          {stage || 'Procesando…'} {mode === 'async' ? 'El procesamiento continuará en segundo plano.' : 'Un documento grande puede tardar 1–2 min. No cierres la página.'}
        </p>
      )}
    </div>
  )
}
