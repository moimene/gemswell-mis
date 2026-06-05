'use client'
import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

type Row = { id: string; title: string | null; project_id: string | null; doc_type: string | null }

export function SupersedePicker({ currentId, onPick, onClose }: { currentId: string; onPick: (oldId: string, reason?: string) => void; onClose: () => void }) {
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [picked, setPicked] = useState<Row | null>(null)
  const [reason, setReason] = useState('')

  useEffect(() => {
    const t = setTimeout(async () => {
      const sp = new URLSearchParams({ pageSize: '20', includeRetired: 'true' })
      if (q) sp.set('q', q)
      const r = await fetch(`/api/knowledge/documents?${sp}`)
      const j = await r.json()
      setRows((j.items ?? []).filter((x: Row) => x.id !== currentId))
    }, 250)
    return () => clearTimeout(t)
  }, [q, currentId])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="w-[520px] rounded-lg bg-white p-4 shadow-xl">
        <div className="mb-2 flex items-center justify-between"><h3 className="font-semibold">Superseder: elige el documento antiguo que este reemplaza</h3><button onClick={onClose}><X className="h-4 w-4" /></button></div>
        <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar título…" className="mb-2 w-full rounded border px-2 py-1.5 text-sm" />
        <div className="max-h-64 overflow-auto rounded border">
          {rows.map(r => (
            <button key={r.id} onClick={() => setPicked(r)} className={`flex w-full items-center justify-between border-b px-2 py-1.5 text-left text-sm hover:bg-slate-50 ${picked?.id === r.id ? 'bg-sky-50' : ''}`}>
              <span className="truncate">{r.title ?? '(sin título)'}</span><span className="text-xs text-slate-400">{r.project_id} · {r.doc_type}</span>
            </button>
          ))}
          {rows.length === 0 && <p className="p-3 text-center text-xs text-slate-400">Sin resultados.</p>}
        </div>
        {picked && (
          <div className="mt-3 space-y-2">
            <p className="text-xs text-slate-600">Este documento sustituirá a: <b>{picked.title}</b> (quedará retirado).</p>
            <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Motivo (obligatorio)" className="w-full rounded border px-2 py-1.5 text-sm" />
            <button disabled={!reason.trim()} onClick={() => onPick(picked.id, reason.trim())} className="w-full rounded bg-slate-800 py-1.5 text-sm text-white disabled:opacity-40">Confirmar supersesión</button>
          </div>
        )}
      </div>
    </div>
  )
}
