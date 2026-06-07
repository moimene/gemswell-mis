'use client'
import { useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { PageHeader, ProjectBadge } from '@/components/shared/terminal'
import {
  CheckCircle2, Circle, AlertTriangle, Clock, ChevronRight, ChevronDown,
  FileSpreadsheet, MessageSquare, LayoutDashboard, ArrowRight, FlaskConical,
} from 'lucide-react'

// Packs de reporting (UX refactor §6). MOCK realista: la pantalla simula el ciclo de reporting por
// áreas (Pack = proyecto + periodo, con varias entregas XLS dentro) hasta conectar el flujo real.
// Estados, áreas, métricas y contradicciones son ilustrativos pero coherentes (§6.5).

type AreaState = 'recibido' | 'pendiente' | 'no_aplica' | 'error'
type Area = {
  area: string; periodicity: string; state: AreaState
  metricsExtracted: number; metricsPublished: number; incident?: string
}
type PackState = 'Borrador' | 'Abierto' | 'Recibido' | 'En revisión' | 'Publicado' | 'Bloqueado' | 'Cerrado'
type Pack = {
  id: string; project: string; period: string; periodicity: string
  dueDate: string; receivedDate: string | null; state: PackState; owner: string
  docsPending: number; metricsPending: number; contradictions: number
  tower: 'pendiente' | 'parcial' | 'actualizado'; chat: 'pendiente' | 'parcial' | 'actualizado'
  areas: Area[]
}

const PACK_STATE_STYLE: Record<PackState, string> = {
  'Borrador': 'bg-slate-100 text-slate-600',
  'Abierto': 'bg-sky-50 text-sky-700 border border-sky-200',
  'Recibido': 'bg-indigo-50 text-indigo-700 border border-indigo-200',
  'En revisión': 'bg-amber-50 text-amber-700 border border-amber-200',
  'Publicado': 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  'Bloqueado': 'bg-rose-50 text-rose-700 border border-rose-200',
  'Cerrado': 'bg-slate-100 text-slate-500',
}
const AREA_STATE: Record<AreaState, { label: string; cls: string }> = {
  recibido: { label: 'XLS recibido', cls: 'text-emerald-700 bg-emerald-50' },
  pendiente: { label: 'Pendiente', cls: 'text-amber-700 bg-amber-50' },
  no_aplica: { label: 'No aplica', cls: 'text-slate-500 bg-slate-100' },
  error: { label: 'Error de plantilla', cls: 'text-rose-700 bg-rose-50' },
}
const FEED_STATE: Record<string, { label: string; cls: string }> = {
  pendiente: { label: 'Pendiente', cls: 'text-slate-500' },
  parcial: { label: 'Parcial', cls: 'text-amber-600' },
  actualizado: { label: 'Actualizado', cls: 'text-emerald-600' },
}

const PACKS: Pack[] = [
  {
    id: 'MAD-S23-2026', project: 'MAD', period: 'Semana 23 · 2026', periodicity: 'Semanal',
    dueDate: '2026-06-05', receivedDate: '2026-06-04', state: 'En revisión', owner: 'Controlling MAD',
    docsPending: 4, metricsPending: 13, contradictions: 2, tower: 'pendiente', chat: 'parcial',
    areas: [
      { area: 'Finanzas', periodicity: 'Semanal', state: 'recibido', metricsExtracted: 9, metricsPublished: 0 },
      { area: 'Construcción', periodicity: 'Semanal', state: 'recibido', metricsExtracted: 6, metricsPublished: 0 },
      { area: 'Operaciones', periodicity: 'Semanal', state: 'pendiente', metricsExtracted: 0, metricsPublished: 0 },
      { area: 'F&B', periodicity: 'Mensual', state: 'no_aplica', metricsExtracted: 0, metricsPublished: 0 },
      { area: 'Marketing', periodicity: 'Semanal', state: 'recibido', metricsExtracted: 4, metricsPublished: 0, incident: '1 contradicción de CAC' },
    ],
  },
  {
    id: 'BHX-M05-2026', project: 'BHX', period: 'Mayo · 2026', periodicity: 'Mensual',
    dueDate: '2026-06-03', receivedDate: '2026-06-02', state: 'Publicado', owner: 'Controlling BHX',
    docsPending: 0, metricsPending: 0, contradictions: 0, tower: 'actualizado', chat: 'actualizado',
    areas: [
      { area: 'Finanzas', periodicity: 'Mensual', state: 'recibido', metricsExtracted: 12, metricsPublished: 12 },
      { area: 'Construcción', periodicity: 'Mensual', state: 'recibido', metricsExtracted: 8, metricsPublished: 8 },
      { area: 'Operaciones', periodicity: 'Mensual', state: 'recibido', metricsExtracted: 5, metricsPublished: 5 },
    ],
  },
  {
    id: 'MAD-S22-2026', project: 'MAD', period: 'Semana 22 · 2026', periodicity: 'Semanal',
    dueDate: '2026-05-29', receivedDate: '2026-05-28', state: 'Bloqueado', owner: 'Controlling MAD',
    docsPending: 1, metricsPending: 5, contradictions: 3, tower: 'parcial', chat: 'actualizado',
    areas: [
      { area: 'Finanzas', periodicity: 'Semanal', state: 'recibido', metricsExtracted: 9, metricsPublished: 4, incident: '3 contradicciones CapEx EAC' },
      { area: 'Construcción', periodicity: 'Semanal', state: 'error', metricsExtracted: 0, metricsPublished: 0, incident: 'Plantilla v1 obsoleta' },
      { area: 'Marketing', periodicity: 'Semanal', state: 'recibido', metricsExtracted: 4, metricsPublished: 4 },
    ],
  },
  {
    id: 'BHX-S23-2026', project: 'BHX', period: 'Semana 23 · 2026', periodicity: 'Semanal',
    dueDate: '2026-06-08', receivedDate: null, state: 'Abierto', owner: 'Controlling BHX',
    docsPending: 0, metricsPending: 0, contradictions: 0, tower: 'pendiente', chat: 'pendiente',
    areas: [
      { area: 'Finanzas', periodicity: 'Semanal', state: 'pendiente', metricsExtracted: 0, metricsPublished: 0 },
      { area: 'Construcción', periodicity: 'Semanal', state: 'pendiente', metricsExtracted: 0, metricsPublished: 0 },
    ],
  },
]

const PIPELINE = [
  'XLS recibido', 'Ingestado como documento', 'Pendiente de revisión documental', 'Documento aprobado',
  'Métricas extraídas', 'Métricas revisadas', 'Publicado en Tower Control', 'Disponible para Chat',
]

function fmt(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

export default function PacksListPage() {
  const [open, setOpen] = useState<string | null>('MAD-S23-2026')

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Gemswell Ventures · MIS · Documentos & Reporting"
        title="Packs de reporting"
        subtitle="Entregas periódicas por área. Cada XLS actualiza el corpus documental y genera métricas para Tower Control."
        right={<span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide text-amber-700"><FlaskConical className="h-3 w-3" /> Mock</span>}
      />

      <div className="space-y-3">
        {PACKS.map(pack => {
          const isOpen = open === pack.id
          const received = pack.areas.filter(a => a.state === 'recibido').length
          const expected = pack.areas.filter(a => a.state !== 'no_aplica').length
          return (
            <div key={pack.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              {/* Fila resumen (§6.3) */}
              <button onClick={() => setOpen(isOpen ? null : pack.id)} className="flex w-full items-center justify-between gap-4 p-4 text-left hover:bg-slate-50">
                <div className="flex items-center gap-3">
                  {isOpen ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                  <ProjectBadge projectId={pack.project} />
                  <div>
                    <p className="font-medium text-slate-900">Pack {pack.project} · {pack.period}</p>
                    <p className="text-xs text-slate-500">{pack.periodicity} · vence {fmt(pack.dueDate)}{pack.receivedDate ? ` · recibido ${fmt(pack.receivedDate)}` : ''}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Metric label="Áreas" value={`${received}/${expected}`} />
                  <Metric label="Docs" value={pack.docsPending} amber={pack.docsPending > 0} />
                  <Metric label="Métricas" value={pack.metricsPending} amber={pack.metricsPending > 0} />
                  <Metric label="Contra." value={pack.contradictions} red={pack.contradictions > 0} />
                  <span className={cn('rounded px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide', PACK_STATE_STYLE[pack.state])}>{pack.state}</span>
                </div>
              </button>

              {/* Detalle (§6.4) */}
              {isOpen && (
                <div className="space-y-4 border-t border-slate-100 bg-slate-50/50 p-4">
                  {/* Resumen */}
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                    <Field label="Proyecto" value={pack.project} />
                    <Field label="Periodo" value={pack.period} />
                    <Field label="Responsable" value={pack.owner} />
                    <Field label="Fecha límite" value={fmt(pack.dueDate)} />
                  </div>

                  {/* Áreas */}
                  <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 text-left font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">
                          <th className="px-3 py-2">Área</th><th className="px-3 py-2">Periodicidad</th><th className="px-3 py-2">Entrega</th>
                          <th className="px-3 py-2 text-right">Extraídas</th><th className="px-3 py-2 text-right">Publicadas</th><th className="px-3 py-2">Incidencias</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pack.areas.map(a => (
                          <tr key={a.area} className="border-b border-slate-50">
                            <td className="px-3 py-2 font-medium text-slate-800">{a.area}</td>
                            <td className="px-3 py-2 text-slate-500">{a.periodicity}</td>
                            <td className="px-3 py-2"><span className={cn('rounded px-1.5 py-0.5 font-mono text-[10px] font-medium', AREA_STATE[a.state].cls)}>{AREA_STATE[a.state].label}</span></td>
                            <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-600">{a.metricsExtracted}</td>
                            <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-600">{a.metricsPublished}</td>
                            <td className="px-3 py-2 text-xs text-rose-600">{a.incident ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pipeline del pack */}
                  <div>
                    <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">Pipeline del pack</p>
                    <ol className="flex flex-wrap gap-1.5">
                      {PIPELINE.map((step, i) => {
                        // mock progress: posición proporcional al estado del pack
                        const reached = pack.state === 'Publicado' ? 8 : pack.state === 'Bloqueado' ? 4 : pack.state === 'En revisión' ? 3 : pack.state === 'Recibido' ? 2 : pack.state === 'Abierto' ? 1 : 0
                        const done = i < reached
                        const blocked = pack.state === 'Bloqueado' && i === reached
                        return (
                          <li key={step} className={cn('flex items-center gap-1 rounded border px-2 py-1 text-[11px]',
                            blocked ? 'border-rose-300 bg-rose-50 text-rose-700' : done ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-400')}>
                            {blocked ? <AlertTriangle className="h-3 w-3" /> : done ? <CheckCircle2 className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
                            {step}
                          </li>
                        )
                      })}
                    </ol>
                  </div>

                  {/* Mensaje clave (§6.4) */}
                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
                    Este pack tiene <strong>dos salidas</strong>: actualiza el <Link href="/chat" className="font-medium text-slate-800 underline">Chat</Link> como documentación clave y alimenta <Link href="/" className="font-medium text-slate-800 underline">Tower Control</Link> mediante métricas aprobadas.
                  </div>

                  {/* Estado salidas + CTAs */}
                  <div className="flex flex-wrap items-center gap-4">
                    <Feed icon={<MessageSquare className="h-3.5 w-3.5" />} label="Chat" state={pack.chat} />
                    <Feed icon={<LayoutDashboard className="h-3.5 w-3.5" />} label="Tower Control" state={pack.tower} />
                    <div className="ml-auto flex gap-2">
                      <Link href="/admin/review" className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-800">Revisar <ArrowRight className="h-3.5 w-3.5" /></Link>
                      <Link href="/chat" className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50"><FileSpreadsheet className="h-3.5 w-3.5" /> Consultar en Chat</Link>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
        <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
        Vista en prototipo. El flujo real conectará la subida de XLS por área con la ingesta documental y el Centro de revisión.
      </div>
    </div>
  )
}

function Metric({ label, value, amber, red }: { label: string; value: string | number; amber?: boolean; red?: boolean }) {
  return (
    <div className="text-right">
      <div className={cn('font-mono text-sm font-bold tabular-nums', red ? 'text-rose-600' : amber ? 'text-amber-600' : 'text-slate-700')}>{value}</div>
      <div className="font-mono text-[9px] font-bold uppercase tracking-widest text-slate-400">{label}</div>
    </div>
  )
}
function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
      <div className="font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</div>
      <div className="mt-0.5 text-sm font-medium text-slate-800">{value}</div>
    </div>
  )
}
function Feed({ icon, label, state }: { icon: React.ReactNode; label: string; state: string }) {
  const s = FEED_STATE[state] ?? FEED_STATE.pendiente
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
      {icon}{label}: <span className={cn('font-medium', s.cls)}>{s.label}</span>
    </span>
  )
}
