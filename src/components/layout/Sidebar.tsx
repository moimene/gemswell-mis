'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Briefcase, Building2, GitBranch,
  Banknote, Shield, Utensils, Tag, BarChart3,
  AlertTriangle, FileText, MessageSquare, Upload, ChevronLeft, ChevronRight,
  FlaskConical, Layers
} from 'lucide-react'
import { useState } from 'react'

const navItems = [
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
  { label: 'AI Assistant', href: '/chat', icon: MessageSquare },
  { label: 'Ingestion', href: '/admin/ingest', icon: Upload },
  { label: 'Evidence Review', href: '/admin/review', icon: FlaskConical },
  { label: 'Pack Grounding',  href: '/admin/packs',  icon: Layers },
]

export function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

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
      <nav className="flex-1 space-y-1 p-2">
        {navItems.map(item => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
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
      </nav>
    </aside>
  )
}
