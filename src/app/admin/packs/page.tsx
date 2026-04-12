'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Clock, CheckCircle, AlertTriangle, ChevronRight } from 'lucide-react'

type Pack = {
  pack_id: string
  project_id: string
  area: string
  status: string
  completeness_score: number
  submitted_at: string | null
  due_at: string | null
  is_critical: boolean
  notes: string | null
}

const STATUS_STYLES: Record<string, string> = {
  submitted:   'bg-blue-50 text-blue-700',
  published:   'bg-green-50 text-green-700',
  in_progress: 'bg-amber-50 text-amber-700',
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function PacksListPage() {
  const [packs, setPacks] = useState<Pack[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const sb = (await import('@/lib/supabase')).createClient()
      const { data } = await sb
        .from('rpt_pack')
        .select('pack_id, project_id, area, status, completeness_score, submitted_at, due_at, is_critical, notes')
        .order('due_at', { ascending: true })
      setPacks(data || [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Clock className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Packs de Reporting</h1>
        <p className="text-sm text-slate-500">Ciclos de extracción de métricas con información de fuente y evidencia</p>
      </div>

      <div className="space-y-3">
        {packs.map(pack => {
          const isOverdue = pack.due_at && new Date(pack.due_at) < new Date() && pack.status !== 'published'
          return (
            <Link
              key={pack.pack_id}
              href={`/admin/packs/${pack.pack_id}`}
              className="flex items-center justify-between rounded-lg border bg-white p-4 shadow-sm hover:shadow-md transition-shadow group"
            >
              <div className="flex items-center gap-4">
                <div className="flex-col">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-slate-400">{pack.project_id}</span>
                    <span className="text-slate-300">·</span>
                    <span className="text-xs text-slate-500 capitalize">{pack.area}</span>
                    {pack.is_critical && (
                      <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700">Crítico</span>
                    )}
                  </div>
                  <p className="font-medium text-slate-900">{pack.project_id} Finance Pack</p>
                  <p className="text-xs text-slate-500">
                    Due {fmtDate(pack.due_at)}
                    {pack.submitted_at && ` · Enviado ${fmtDate(pack.submitted_at)}`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                {/* Completeness */}
                <div className="text-right">
                  <div className="flex items-center gap-1.5 justify-end mb-1">
                    <div className="h-1.5 w-20 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={cn('h-full rounded-full', pack.completeness_score >= 80 ? 'bg-green-500' : pack.completeness_score >= 60 ? 'bg-amber-500' : 'bg-red-500')}
                        style={{ width: `${pack.completeness_score}%` }}
                      />
                    </div>
                    <span className="text-xs text-slate-500 tabular-nums">{pack.completeness_score}%</span>
                  </div>
                  <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', STATUS_STYLES[pack.status] || 'bg-slate-100 text-slate-600')}>
                    {pack.status}
                  </span>
                </div>

                {isOverdue ? (
                  <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
                ) : pack.status === 'published' ? (
                  <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                ) : (
                  <Clock className="h-4 w-4 text-slate-300 shrink-0" />
                )}

                <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
              </div>
            </Link>
          )
        })}

        {packs.length === 0 && (
          <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white">
            <p className="text-sm text-slate-500">No hay packs registrados</p>
          </div>
        )}
      </div>
    </div>
  )
}
