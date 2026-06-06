'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { cn, type RAGColor } from '@/lib/utils'
import { CheckCircle, AlertTriangle, ChevronRight } from 'lucide-react'
import { PageHeader, RagChip, ProjectBadge } from '@/components/shared/terminal'

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

const STATUS_RAG_MAP: Record<string, RAGColor> = {
  submitted:   'Amber',
  published:   'Blue',
  in_progress: 'Grey',
}

const STATUS_LABEL: Record<string, string> = {
  submitted:   'Enviado',
  published:   'Publicado',
  in_progress: 'En curso',
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function PacksListPage() {
  const [packs, setPacks] = useState<Pack[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  async function load() {
    setLoading(true)
    setLoadError(false)
    try {
      const sb = (await import('@/lib/supabase')).createClient()
      const { data, error } = await sb
        .from('rpt_pack')
        .select('pack_id, project_id, area, status, completeness_score, submitted_at, due_at, is_critical, notes')
        .order('due_at', { ascending: true })
      if (error) throw error
      setPacks(data || [])
    } catch (e) {
      console.error(e)
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  if (loading) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
        <p className="font-mono text-xs text-slate-400">Cargando…</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Packs de Reporting"
        subtitle="Ciclos de extracción de métricas con información de fuente y evidencia"
      />

      {loadError ? (
        <div className="flex h-48 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-red-300 bg-white shadow-sm">
          <div className="flex items-center gap-2 text-sm text-red-700">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>No se pudieron cargar los packs (la sesión pudo expirar).</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => { load() }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
            >
              Reintentar
            </button>
            <a
              href="/login"
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-slate-700 transition-colors"
            >
              Iniciar sesión
            </a>
          </div>
        </div>
      ) : (
      <div className="space-y-3">
        {packs.map(pack => {
          const isOverdue = pack.due_at && new Date(pack.due_at) < new Date() && pack.status !== 'published'
          return (
            <Link
              key={pack.pack_id}
              href={`/admin/packs/${pack.pack_id}`}
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow group"
            >
              <div className="flex items-center gap-4">
                <div className="flex-col">
                  <div className="flex items-center gap-2">
                    <ProjectBadge projectId={pack.project_id} />
                    <span className="text-slate-300">·</span>
                    <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">{pack.area}</span>
                    {pack.is_critical && (
                      <span className="rounded-[2px] bg-[#FEE2E2] px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide text-[#7F1D1D]">Crítico</span>
                    )}
                  </div>
                  <p className="font-medium text-slate-900">Pack Financiero {pack.project_id}</p>
                  <p className="text-xs text-slate-500">
                    Vence {fmtDate(pack.due_at)}
                    {pack.submitted_at && ` · Enviado ${fmtDate(pack.submitted_at)}`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                {/* Completitud */}
                <div className="text-right">
                  <div className="flex items-center gap-1.5 justify-end mb-1">
                    <div className="h-1.5 w-20 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={cn('h-full rounded-full', pack.completeness_score >= 80 ? 'bg-green-500' : pack.completeness_score >= 60 ? 'bg-amber-500' : 'bg-red-500')}
                        style={{ width: `${pack.completeness_score}%` }}
                      />
                    </div>
                    <span className="font-mono text-xs tabular-nums text-slate-600">{pack.completeness_score}%</span>
                  </div>
                  <RagChip status={STATUS_RAG_MAP[pack.status] || 'Grey'} label={STATUS_LABEL[pack.status] || pack.status} />
                </div>

                {isOverdue ? (
                  <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
                ) : pack.status === 'published' ? (
                  <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                ) : (
                  <span className="h-4 w-4 shrink-0" />
                )}

                <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
              </div>
            </Link>
          )
        })}

        {packs.length === 0 && (
          <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white shadow-sm">
            <p className="text-sm text-slate-500">No hay packs registrados</p>
          </div>
        )}
      </div>
      )}
    </div>
  )
}
