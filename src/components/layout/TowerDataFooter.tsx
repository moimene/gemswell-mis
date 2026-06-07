'use client'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

// UX refactor §12: every Tower Control dashboard shows a "pie de datos" tracing what it reflects —
// último pack publicado, periodo, métricas pendientes, contradicciones, y enlaces al Centro de
// revisión y al pack origen. Mock data hasta conectar el flujo real (coherente con Packs §6.5).

const TOWER_ROUTES = new Set<string>([
  '/', '/portfolio', '/critical-path', '/funding', '/ops-readiness',
  '/fnb-readiness', '/pricing', '/commercial', '/bp-budget', '/risks', '/decisions',
])

export function TowerDataFooter() {
  const pathname = usePathname()
  if (!TOWER_ROUTES.has(pathname)) return null
  return (
    <footer className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-1 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-[11px] text-slate-500 shadow-sm">
      <span className="font-mono font-bold uppercase tracking-widest text-slate-400">Pie de datos</span>
      <span>Datos hasta <strong className="font-medium text-slate-700">Semana 23/2026</strong></span>
      <span>Último pack publicado: <strong className="font-medium text-slate-700">BHX · Mayo 2026</strong></span>
      <span>Pendientes: <strong className="font-medium text-amber-600">13 métricas</strong></span>
      <span>Contradicciones: <strong className="font-medium text-rose-600">4</strong></span>
      <Link href="/admin/review" className="inline-flex items-center gap-1 font-medium text-slate-700 hover:text-slate-900">Ver métricas <ArrowRight className="h-3 w-3" /></Link>
      <Link href="/admin/packs" className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900">Pack origen <ArrowRight className="h-3 w-3" /></Link>
    </footer>
  )
}
