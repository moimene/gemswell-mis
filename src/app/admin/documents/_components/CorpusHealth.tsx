'use client'
import { useEffect, useState } from 'react'

type Health = {
  total: number
  governance: { approved: number; needs_review: number; rejected: number; pending: number }
  retired: number; source_of_record: number; avg_authority: number; pct_markdown: number; pct_source_hash: number
  queue: { total: number; queued: number; processing: number; done: number; error: number }
}
const Stat = ({ label, value, hint }: { label: string; value: string | number; hint?: string }) => (
  <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm" title={hint}>
    <div className="flex items-center gap-1 font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">
      {label}{hint && <span className="cursor-help text-slate-300">ⓘ</span>}
    </div>
    <div className="mt-1 font-mono text-lg font-bold tabular-nums text-slate-900">{value}</div>
  </div>
)

export function CorpusHealth() {
  const [h, setH] = useState<Health | null>(null)
  const [err, setErr] = useState(false)
  useEffect(() => {
    let cancelled = false
    fetch('/api/knowledge/corpus/health')
      .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
      // validate the shape before trusting it — a 401 body ({error:'unauthorized'}) is truthy
      // but has no .governance/.avg_authority, which would TypeError the render below.
      .then(j => { if (cancelled) return; if (j && typeof j.total === 'number' && j.governance) setH(j); else setErr(true) })
      .catch(() => { if (!cancelled) setErr(true) })
    return () => { cancelled = true }
  }, [])
  if (err) return <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-400 shadow-sm">No se pudo cargar el estado del corpus.</div>
  if (!h) return null
  const pct = (n: number) => `${(n * 100).toFixed(1)}%`
  return (
    <div className="grid grid-cols-3 gap-2 md:grid-cols-5">
      <Stat label="Total" value={h.total} />
      <Stat label="Aprobados" value={h.governance.approved} />
      <Stat label="Sin revisar" value={h.governance.needs_review} />
      <Stat label="Rechazados" value={h.governance.rejected} />
      <Stat label="Retirados" value={h.retired} />
      <Stat label="Fuente de registro" value={h.source_of_record}
        hint="Documentos con autoridad ≥90 Y clasificación humana (human/agent_reviewed/agent_corrected). Es 0 hasta que un revisor humano valide fuentes: el clasificador automático nunca llega aquí por diseño." />
      <Stat label="Autoridad media" value={h.avg_authority.toFixed(1)} />
      <Stat label="% Markdown" value={pct(h.pct_markdown)} />
      <Stat label="% source_hash" value={pct(h.pct_source_hash)} />
      <Stat label="Cola (cola/proc/err)" value={`${h.queue.queued}/${h.queue.processing}/${h.queue.error}`} />
    </div>
  )
}
