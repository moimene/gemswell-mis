'use client'
import { useEffect, useState } from 'react'

type Health = {
  total: number
  governance: { approved: number; needs_review: number; rejected: number; pending: number }
  retired: number; source_of_record: number; avg_authority: number; pct_markdown: number; pct_source_hash: number
  queue: { total: number; queued: number; processing: number; done: number; error: number }
}
const Stat = ({ label, value }: { label: string; value: string | number }) => (
  <div className="rounded-md border bg-white px-3 py-2"><div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div><div className="text-lg font-semibold text-slate-800">{value}</div></div>
)

export function CorpusHealth() {
  const [h, setH] = useState<Health | null>(null)
  useEffect(() => { fetch('/api/knowledge/corpus/health').then(r => r.json()).then(setH).catch(() => {}) }, [])
  if (!h) return null
  const pct = (n: number) => `${(n * 100).toFixed(1)}%`
  return (
    <div className="grid grid-cols-3 gap-2 md:grid-cols-5">
      <Stat label="Total" value={h.total} />
      <Stat label="Aprobados" value={h.governance.approved} />
      <Stat label="Sin revisar" value={h.governance.needs_review} />
      <Stat label="Rechazados" value={h.governance.rejected} />
      <Stat label="Retirados" value={h.retired} />
      <Stat label="Source of record" value={h.source_of_record} />
      <Stat label="Autoridad media" value={h.avg_authority.toFixed(1)} />
      <Stat label="% Markdown" value={pct(h.pct_markdown)} />
      <Stat label="% source_hash" value={pct(h.pct_source_hash)} />
      <Stat label="Cola (q/proc/err)" value={`${h.queue.queued}/${h.queue.processing}/${h.queue.error}`} />
    </div>
  )
}
