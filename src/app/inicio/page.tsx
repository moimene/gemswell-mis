'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/shared/terminal'
import {
  MessageSquare, ClipboardCheck, LayoutDashboard, Layers,
  CheckCircle2, Circle, AlertTriangle, ArrowRight,
} from 'lucide-react'

// Inicio MIS — landing operativa (UX refactor §5). Da el estado del ciclo de reporting de un vistazo:
// qué falta para que Tower Control y el Chat estén actualizados. Las cifras de corpus son reales
// (corpus health); el pipeline de packs es mock realista hasta que el módulo de packs sea real.

type Health = {
  total: number
  governance: { approved: number; needs_review: number; rejected: number; pending: number }
  source_of_record: number
}

type StepState = 'done' | 'current' | 'pending' | 'blocked'
type Step = { n: number; label: string; detail: string; state: StepState; cta?: { label: string; href: string } }

const stateStyle: Record<StepState, { ring: string; text: string; icon: React.ReactNode }> = {
  done: { ring: 'border-emerald-300 bg-emerald-50', text: 'text-emerald-700', icon: <CheckCircle2 className="h-4 w-4 text-emerald-600" /> },
  current: { ring: 'border-slate-800 bg-slate-900 text-white', text: 'text-white', icon: <Circle className="h-4 w-4 text-white" /> },
  pending: { ring: 'border-slate-200 bg-white', text: 'text-slate-400', icon: <Circle className="h-4 w-4 text-slate-300" /> },
  blocked: { ring: 'border-amber-300 bg-amber-50', text: 'text-amber-700', icon: <AlertTriangle className="h-4 w-4 text-amber-600" /> },
}

const QUICK = [
  { label: 'Preguntar al Chat', href: '/chat', icon: MessageSquare },
  { label: 'Subir pack', href: '/admin/packs', icon: Layers },
  { label: 'Revisar documentos', href: '/admin/review', icon: ClipboardCheck },
  { label: 'Revisar métricas', href: '/admin/review', icon: ClipboardCheck },
  { label: 'Abrir Tower Control', href: '/', icon: LayoutDashboard },
]

export default function InicioPage() {
  const [h, setH] = useState<Health | null>(null)
  const [err, setErr] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/knowledge/corpus/health')
      .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(j => { if (!cancelled) { if (j && typeof j.total === 'number' && j.governance) setH(j); else setErr(true) } })
      .catch(() => { if (!cancelled) setErr(true) })
    return () => { cancelled = true }
  }, [])

  const needsReview = h?.governance.needs_review ?? null

  // Pipeline del ciclo de reporting (§5.2). Estado de packs/métricas es mock realista; documentos
  // pendientes es real (needs_review del corpus).
  const steps: Step[] = [
    { n: 1, label: 'Pack recibido', detail: 'MAD · Semana 23/2026', state: 'done' },
    { n: 2, label: 'XLS ingestados', detail: 'Finanzas, Construcción, Marketing', state: 'done' },
    {
      n: 3, label: 'Documentos revisados',
      detail: needsReview == null ? 'cargando…' : `${needsReview} pendientes de revisión`,
      state: needsReview && needsReview > 0 ? 'current' : 'done',
      cta: { label: 'Revisar documentos', href: '/admin/review' },
    },
    { n: 4, label: 'Métricas validadas', detail: '13 pendientes · 4 contradicciones', state: 'blocked', cta: { label: 'Revisar métricas', href: '/admin/review' } },
    { n: 5, label: 'Tower Control actualizado', detail: 'Pendiente de publicación', state: 'pending', cta: { label: 'Abrir Tower Control', href: '/' } },
    { n: 6, label: 'Chat actualizado', detail: 'Actualizado parcialmente', state: 'pending', cta: { label: 'Preguntar al Chat', href: '/chat' } },
  ]

  return (
    <div className="space-y-4 p-6">
      <PageHeader
        eyebrow="Gemswell Ventures · MIS"
        title="Inicio MIS"
        subtitle="Estado del corpus, reporting y paneles del portfolio."
      />

      {/* Estado del último reporting */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Último pack" value="MAD · Sem 23/26" />
        <Stat label="Áreas recibidas" value="3 / 5" hint="Operaciones y F&B pendientes" />
        <Stat label="Documentos por revisar" value={needsReview == null ? (err ? '—' : '…') : String(needsReview)} accent={needsReview ? 'amber' : undefined} />
        <Stat label="Métricas pendientes" value="13" hint="4 contradicciones" accent="amber" />
      </div>

      {/* Pipeline visual */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-mono text-[11px] font-bold uppercase tracking-widest text-slate-500">Ciclo de reporting</h2>
          <span className="font-mono text-[10px] text-slate-400">XLS → ingesta → revisión → métricas → Tower + Chat</span>
        </div>
        <ol className="grid gap-2 md:grid-cols-6">
          {steps.map(s => {
            const st = stateStyle[s.state]
            return (
              <li key={s.n} className={`flex flex-col gap-1 rounded-lg border p-2.5 ${st.ring}`}>
                <div className={`flex items-center gap-1.5 text-[11px] font-semibold ${s.state === 'current' ? 'text-white' : 'text-slate-700'}`}>
                  {st.icon}<span>{s.label}</span>
                </div>
                <p className={`text-[11px] ${s.state === 'current' ? 'text-slate-200' : 'text-slate-500'}`}>{s.detail}</p>
                {s.cta && (
                  <Link href={s.cta.href} className={`mt-auto inline-flex items-center gap-0.5 text-[11px] font-medium ${s.state === 'current' ? 'text-white underline' : 'text-slate-600 hover:text-slate-900'}`}>
                    {s.cta.label} <ArrowRight className="h-3 w-3" />
                  </Link>
                )}
              </li>
            )
          })}
        </ol>
      </section>

      {/* Accesos rápidos */}
      <section>
        <h2 className="mb-2 font-mono text-[11px] font-bold uppercase tracking-widest text-slate-500">Accesos rápidos</h2>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
          {QUICK.map(q => (
            <Link key={q.label} href={q.href} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50">
              <q.icon className="h-4 w-4 text-slate-500" /> {q.label}
            </Link>
          ))}
        </div>
      </section>

      <p className="font-mono text-[10px] text-slate-400">
        El módulo de Packs de reporting está en prototipo (Mock). Las cifras de documentos provienen del corpus real; las de packs/métricas son ilustrativas hasta conectar el flujo de reporting.
      </p>
    </div>
  )
}

function Stat({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: 'amber' }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm" title={hint}>
      <div className="font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</div>
      <div className={`mt-1 font-mono text-lg font-bold tabular-nums ${accent === 'amber' ? 'text-amber-700' : 'text-slate-900'}`}>{value}</div>
      {hint && <div className="font-mono text-[10px] text-slate-400">{hint}</div>}
    </div>
  )
}
