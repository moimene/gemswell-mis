'use client'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { FlaskConical, ArrowRight } from 'lucide-react'

// UX refactor §12: Tower Control panels are an executive MOCK layer. Every panel must carry a visible
// banner clarifying it's a prototype whose data should trace back to metrics published from the
// Centro de revisión. Mounted once in the layout, shown only on Tower Control routes.

const TOWER_ROUTES = new Set<string>([
  '/', '/portfolio', '/critical-path', '/funding', '/ops-readiness',
  '/fnb-readiness', '/pricing', '/commercial', '/bp-budget', '/risks', '/decisions',
])

export function TowerControlBanner() {
  const pathname = usePathname()
  if (!TOWER_ROUTES.has(pathname)) return null
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
      <div className="flex items-center gap-2">
        <FlaskConical className="h-4 w-4 shrink-0 text-amber-600" />
        <span>
          <strong>Panel en prototipo (Mock).</strong> Los datos deben trazarse a métricas publicadas desde el Centro de revisión.
        </span>
      </div>
      <Link href="/admin/review" className="inline-flex items-center gap-1 font-medium text-amber-800 hover:text-amber-950">
        Ver métricas <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  )
}
