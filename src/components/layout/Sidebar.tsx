'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Briefcase, Building2, GitBranch,
  Banknote, Shield, Utensils, Tag, BarChart3,
  AlertTriangle, FileText, MessageSquare, ChevronLeft, ChevronRight,
  Layers, FolderCheck, LogOut, Home, Upload, ClipboardCheck,
  ChevronDown,
} from 'lucide-react'
import { useState } from 'react'

type NavItem = { label: string; href: string; icon: React.ComponentType<{ className?: string }> }
type NavSection = { label: string; items: NavItem[]; badge?: string; defaultCollapsed?: boolean }

// UX refactor (2026-06): the sidebar communicates the real product flow — "Documentos & Reporting"
// is the operative engine (open by default), "Tower Control" is the executive visual layer (marked
// as Mock prototype, collapsed by default). Technical routes are kept; only the visible names change.
const navSections: NavSection[] = [
  {
    label: 'Inicio MIS',
    items: [
      { label: 'Visión general', href: '/inicio', icon: Home },
    ],
  },
  {
    label: 'Documentos & Reporting',
    items: [
      { label: 'Chat con documentos', href: '/chat', icon: MessageSquare },
      { label: 'Packs de reporting', href: '/admin/packs', icon: Layers },
      { label: 'Ingesta documental', href: '/admin/ingest', icon: Upload },
      { label: 'Centro de revisión', href: '/admin/review', icon: ClipboardCheck },
      { label: 'Biblioteca documental', href: '/admin/documents', icon: FolderCheck },
    ],
  },
  {
    label: 'Tower Control',
    badge: 'Mock',
    defaultCollapsed: true,
    items: [
      { label: 'CEO Dashboard', href: '/', icon: LayoutDashboard },
      { label: 'Portfolio', href: '/portfolio', icon: Briefcase },
      { label: 'Critical Path', href: '/critical-path', icon: GitBranch },
      { label: 'Funding & Cash', href: '/funding', icon: Banknote },
      { label: 'Ops Readiness', href: '/ops-readiness', icon: Shield },
      { label: 'F&B Readiness', href: '/fnb-readiness', icon: Utensils },
      { label: 'Pricing', href: '/pricing', icon: Tag },
      { label: 'Commercial', href: '/commercial', icon: BarChart3 },
      { label: 'BP & Budget', href: '/bp-budget', icon: Building2 },
      { label: 'Risks & Actions', href: '/risks', icon: AlertTriangle },
      { label: 'Decisions', href: '/decisions', icon: FileText },
    ],
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  // Per-section collapse — Tower Control starts collapsed (it's a mock layer, not the daily driver).
  const [closedSections, setClosedSections] = useState<Set<string>>(
    () => new Set(navSections.filter(s => s.defaultCollapsed).map(s => s.label))
  )

  // Don't mount the authenticated shell (nav + signout form) on unauthenticated routes.
  if (pathname === '/login' || pathname.startsWith('/auth')) return null

  function toggleSection(label: string) {
    setClosedSections(prev => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label); else next.add(label)
      return next
    })
  }

  return (
    <aside className={cn(
      'flex flex-col border-r bg-slate-50 transition-all duration-300',
      collapsed ? 'w-16' : 'w-64'
    )}>
      <div className="flex h-14 items-center justify-between border-b px-4">
        {!collapsed && <span className="text-lg font-bold text-slate-900">Gemswell MIS</span>}
        <button type="button" onClick={() => setCollapsed(!collapsed)} className="rounded p-1 hover:bg-slate-200">
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>
      <nav className="flex-1 space-y-3 overflow-y-auto p-2">
        {navSections.map(section => {
          const isClosed = !collapsed && section.defaultCollapsed && closedSections.has(section.label)
          return (
            <div key={section.label} className="space-y-1">
              {!collapsed && (
                section.defaultCollapsed ? (
                  <button
                    type="button"
                    onClick={() => toggleSection(section.label)}
                    className="flex w-full items-center justify-between px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 hover:text-slate-600"
                  >
                    <span className="flex items-center gap-1.5">
                      {section.label}
                      {section.badge && (
                        <span className="rounded bg-amber-100 px-1 py-px text-[9px] font-bold tracking-normal text-amber-700">
                          {section.badge}
                        </span>
                      )}
                    </span>
                    <ChevronDown className={cn('h-3 w-3 transition-transform', isClosed && '-rotate-90')} />
                  </button>
                ) : (
                  <p className="flex items-center gap-1.5 px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                    {section.label}
                    {section.badge && (
                      <span className="rounded bg-amber-100 px-1 py-px text-[9px] font-bold tracking-normal text-amber-700">
                        {section.badge}
                      </span>
                    )}
                  </p>
                )
              )}
              {!isClosed && section.items.map(item => {
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={item.label}
                    className={cn(
                      'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                      isActive
                        ? 'bg-slate-200 font-medium text-slate-900'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {!collapsed && <span>{item.label}</span>}
                  </Link>
                )
              })}
            </div>
          )
        })}
      </nav>
      <form method="post" action="/auth/signout" className="border-t p-2">
        <button
          type="submit"
          title="Cerrar sesión"
          className={cn(
            'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900',
            collapsed && 'justify-center'
          )}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Cerrar sesión</span>}
        </button>
      </form>
    </aside>
  )
}
