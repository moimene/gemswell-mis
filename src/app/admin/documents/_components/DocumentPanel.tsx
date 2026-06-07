'use client'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { X, Check, Ban, Tag, Archive, RotateCcw, GitMerge, ChevronDown, ChevronRight } from 'lucide-react'
import { ReviewBadge, AuthorityBadge, VerificationBadge } from './badges'
import { SupersedePicker } from './SupersedePicker'
import { AUTHORITY_TIER_SCORE, DOC_TYPE_OPTIONS } from '@/lib/knowledge/contracts'
import type { AuthorityTier } from '@/lib/knowledge/contracts'

type DocDetail = {
  title: string | null
  project_id: string | null
  doc_type: string | null
  period: string | null
  source_channel: string | null
  classification_source: string
  source_hash: string | null
  current_version: number | null
  review_status: string
  authority_score: number | null
  authority_tier: string | null
  status: string
  summary: string | null
}
type DocEvent = {
  action: string
  field: string | null
  old_value: string | null
  new_value: string | null
  actor: string
  reason: string | null
  created_at: string
}
type Detail = {
  document: DocDetail
  chunks: { chunk_index: number; content: string; metadata: unknown }[]
  events: DocEvent[]
  markdown: { source: string; content: string }
}

type PatchBody = {
  action: 'approve' | 'reject' | 'reclassify' | 'retire' | 'restore' | 'supersede'
  fields?: Record<string, string>
  supersedesId?: string
  reason?: string
}

async function patch(id: string, body: PatchBody): Promise<boolean> {
  const r = await fetch(`/api/knowledge/documents/${id}`, {
    method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  })
  const j = await r.json()
  if (!r.ok) { toast.error(j.error ?? 'Error'); return false }
  toast.success(`Acción «${body.action}» aplicada`); return true
}

const DOCTYPES = DOC_TYPE_OPTIONS
const TIERS = ['audited', 'executed', 'controller', 'board_pack', 'dd_memo', 'internal', 'narrative', 'unverified']

export function DocumentPanel({ docId, onClose, onChanged }: { docId: string; onClose: () => void; onChanged: () => void }) {
  const [d, setD] = useState<Detail | null>(null)
  const [loadErr, setLoadErr] = useState<number | null>(null)
  const [open, setOpen] = useState({ md: false, chunks: false, history: false, reclass: false })
  const [supersedeOpen, setSupersedeOpen] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [reclass, setReclass] = useState({ doc_type: '', authority_tier: '', project_id: '' })

  const load = useCallback(async () => {
    // Post-action refresh: a transient failure here must NOT replace an already-populated panel
    // with the full error screen (the action itself succeeded). Toast and keep the panel.
    const r = await fetch(`/api/knowledge/documents/${docId}`)
    if (!r.ok) { toast.error('No se pudo refrescar el documento'); return }
    setD(await r.json())
    setLoadErr(null)
  }, [docId])

  useEffect(() => {
    let cancelled = false
    fetch(`/api/knowledge/documents/${docId}`)
      .then(async r => { if (!r.ok) { if (!cancelled) setLoadErr(r.status); return null } return r.json() })
      .then(j => { if (!cancelled && j) { setD(j); setLoadErr(null) } })
      .catch(() => { if (!cancelled) setLoadErr(0) })
    return () => { cancelled = true }
  }, [docId])

  const act = async (body: PatchBody) => { if (await patch(docId, body)) { await load(); onChanged() } }

  if (loadErr !== null) return (
    <aside className="w-[460px] border-l border-slate-200 bg-white p-6 text-sm text-slate-600">
      <div className="flex items-center justify-between">
        <span>{loadErr === 401 ? 'Sesión expirada — vuelve a iniciar sesión.' : loadErr === 404 ? 'Documento no encontrado.' : 'No se pudo cargar el documento.'}</span>
        <button onClick={onClose}><X className="h-4 w-4 text-slate-400" /></button>
      </div>
    </aside>
  )
  if (!d?.document) return (
    <aside className="flex w-[460px] flex-col items-center justify-center gap-3 border-l border-slate-200 bg-white p-6">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
      <p className="font-mono text-xs text-slate-400">Cargando documento…</p>
    </aside>
  )
  const doc = d.document
  const retired = doc.status === 'retired'

  return (
    <aside className="flex w-[460px] shrink-0 flex-col overflow-auto border-l border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 p-4">
        <h2 className="truncate pr-2 font-semibold text-slate-800">{doc.title ?? '(sin título)'}</h2>
        <button onClick={onClose}><X className="h-4 w-4 text-slate-400" /></button>
      </div>

      <div className="space-y-3 p-4">
        <div className="flex flex-wrap gap-1.5">
          <ReviewBadge status={doc.review_status} />
          <AuthorityBadge score={doc.authority_score} tier={doc.authority_tier} />
          <VerificationBadge score={doc.authority_score} review={doc.review_status} source={doc.classification_source} />
          {retired && <span className="rounded-[2px] bg-slate-700 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide text-white">Retirado</span>}
        </div>
        <dl className="grid grid-cols-3 gap-x-2 gap-y-1 text-xs text-slate-600">
          <dt className="font-mono uppercase tracking-wide text-slate-400">Proyecto</dt><dd className="col-span-2">{doc.project_id ?? '—'}</dd>
          <dt className="font-mono uppercase tracking-wide text-slate-400">Tipo</dt><dd className="col-span-2">{doc.doc_type ?? '—'}</dd>
          <dt className="font-mono uppercase tracking-wide text-slate-400">Periodo</dt><dd className="col-span-2">{doc.period ?? '—'}</dd>
          <dt className="font-mono uppercase tracking-wide text-slate-400">Origen</dt><dd className="col-span-2">{doc.source_channel ?? '—'}</dd>
          <dt className="font-mono uppercase tracking-wide text-slate-400">Clasif.</dt><dd className="col-span-2">{doc.classification_source}</dd>
          <dt className="font-mono uppercase tracking-wide text-slate-400">source_hash</dt><dd className="col-span-2 truncate font-mono">{doc.source_hash ?? '—'}</dd>
          <dt className="font-mono uppercase tracking-wide text-slate-400">Versión</dt><dd className="col-span-2 font-mono tabular-nums">{doc.current_version}</dd>
        </dl>
        {doc.summary && <p className="rounded bg-slate-50 p-2 text-xs text-slate-700">{doc.summary}</p>}

        {/* Actions */}
        <div className="grid grid-cols-2 gap-2 pt-2">
          <button onClick={() => act({ action: 'approve' })} className="flex items-center justify-center gap-1 rounded bg-green-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-green-700"><Check className="h-3.5 w-3.5" /> Aprobar</button>
          <button onClick={() => setRejectOpen(o => !o)} className="flex items-center justify-center gap-1 rounded bg-red-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-red-700"><Ban className="h-3.5 w-3.5" /> Rechazar</button>
          <button onClick={() => setOpen(o => ({ ...o, reclass: !o.reclass }))} className="flex items-center justify-center gap-1 rounded border border-slate-200 px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"><Tag className="h-3.5 w-3.5" /> Reclasificar</button>
          {retired
            ? <button onClick={() => act({ action: 'restore' })} className="flex items-center justify-center gap-1 rounded border border-slate-200 px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"><RotateCcw className="h-3.5 w-3.5" /> Restaurar</button>
            : <button onClick={() => act({ action: 'retire' })} className="flex items-center justify-center gap-1 rounded border border-slate-200 px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"><Archive className="h-3.5 w-3.5" /> Retirar</button>}
          <button disabled={retired || doc.review_status === 'rejected'} title={retired || doc.review_status === 'rejected' ? 'Un documento retirado o rechazado no puede superseder a otro' : undefined} onClick={() => setSupersedeOpen(true)} className="col-span-2 flex items-center justify-center gap-1 rounded border border-slate-200 px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"><GitMerge className="h-3.5 w-3.5" /> Superseder…</button>
        </div>

        {/* Reject inline form (F9): reason required; Cancel does NOT dispatch */}
        {rejectOpen && (
          <div className="space-y-2 rounded border border-red-200 bg-red-50 p-2">
            <input
              autoFocus
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Motivo del rechazo (obligatorio)…"
              className="w-full rounded border border-slate-200 px-2 py-1 text-xs text-slate-700"
            />
            <div className="grid grid-cols-2 gap-2">
              <button
                disabled={!rejectReason.trim()}
                onClick={async () => {
                  const reason = rejectReason.trim()
                  if (!reason) return
                  await act({ action: 'reject', reason })
                  setRejectOpen(false); setRejectReason('')
                }}
                className="rounded bg-red-600 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-40"
              >Confirmar rechazo</button>
              <button
                onClick={() => { setRejectOpen(false); setRejectReason('') }}
                className="rounded border border-slate-200 bg-white py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >Cancelar</button>
            </div>
          </div>
        )}

        {/* Reclassify inline form */}
        {open.reclass && (
          <div className="space-y-2 rounded border border-slate-200 p-2">
            <select value={reclass.doc_type} onChange={e => setReclass(r => ({ ...r, doc_type: e.target.value }))} className="w-full rounded border border-slate-200 px-2 py-1 text-xs text-slate-700"><option value="">doc_type…</option>{DOCTYPES.map(t => <option key={t} value={t}>{t}</option>)}</select>
            <div className="flex items-center gap-2">
              <select value={reclass.authority_tier} onChange={e => setReclass(r => ({ ...r, authority_tier: e.target.value }))} className="flex-1 rounded border border-slate-200 px-2 py-1 text-xs text-slate-700"><option value="">authority_tier…</option>{TIERS.map(t => <option key={t} value={t}>{t}</option>)}</select>
              {reclass.authority_tier && (
                <span className="shrink-0 whitespace-nowrap font-mono text-[11px] font-medium text-slate-500">→ authority_score = {AUTHORITY_TIER_SCORE[reclass.authority_tier as AuthorityTier]}</span>
              )}
            </div>
            <input value={reclass.project_id} onChange={e => setReclass(r => ({ ...r, project_id: e.target.value }))} placeholder="project_id (MAD/BHX/…)" className="w-full rounded border border-slate-200 px-2 py-1 text-xs text-slate-700" />
            <button onClick={() => {
              const fields: Record<string, string> = {}
              if (reclass.doc_type) fields.doc_type = reclass.doc_type
              if (reclass.authority_tier) fields.authority_tier = reclass.authority_tier
              if (reclass.project_id) fields.project_id = reclass.project_id
              if (Object.keys(fields).length === 0) { toast.error('Nada que reclasificar'); return }
              act({ action: 'reclassify', fields })
            }} className="w-full rounded bg-slate-900 py-1 text-xs font-medium text-white hover:bg-slate-800">Aplicar reclasificación</button>
          </div>
        )}

        {/* Collapsibles */}
        <Section title="Markdown (reconstruido)" open={open.md} onToggle={() => setOpen(o => ({ ...o, md: !o.md }))}>
          <p className="mb-1 font-mono text-[10px] uppercase tracking-wide text-slate-400">{d.markdown.source === 'reconstructed' ? 'Markdown reconstruido (no es el artefacto original)' : 'Artefacto'}</p>
          <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded bg-slate-50 p-2 text-xs text-slate-700">{d.markdown.content || 'Sin contenido indexado'}</pre>
        </Section>
        <Section title={`Fragmentos (${d.chunks.length})`} open={open.chunks} onToggle={() => setOpen(o => ({ ...o, chunks: !o.chunks }))}>
          <div className="max-h-80 space-y-2 overflow-auto">{d.chunks.map(c => <div key={c.chunk_index} className="rounded border border-slate-200 p-1.5 text-xs"><span className="font-mono text-slate-400">#{c.chunk_index}</span> <span className="text-slate-700">{c.content.slice(0, 240)}</span></div>)}</div>
        </Section>
        <Section title={`Historial (${d.events.length})`} open={open.history} onToggle={() => setOpen(o => ({ ...o, history: !o.history }))}>
          <ul className="max-h-80 space-y-1 overflow-auto text-xs">{d.events.map((e, i) => <li key={i} className="border-b border-slate-100 py-1"><span className="font-medium text-slate-700">{e.action}</span> {e.field ? <span className="text-slate-500">{e.field}: {e.old_value} → {e.new_value}</span> : null} <span className="text-slate-400">· {e.actor} · {new Date(e.created_at).toLocaleString()}</span>{e.reason ? <div className="text-slate-400">{e.reason}</div> : null}</li>)}</ul>
        </Section>
      </div>

      {supersedeOpen && <SupersedePicker currentId={docId} onPick={async (oldId, reason) => { setSupersedeOpen(false); await act({ action: 'supersede', supersedesId: oldId, reason }) }} onClose={() => setSupersedeOpen(false)} />}
    </aside>
  )
}

function Section({ title, open, onToggle, children }: { title: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="border-t border-slate-100 pt-2">
      <button onClick={onToggle} className="flex w-full items-center gap-1 font-mono text-[11px] font-bold uppercase tracking-widest text-slate-500">
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />} {title}
      </button>
      {open && <div className="mt-2">{children}</div>}
    </div>
  )
}
