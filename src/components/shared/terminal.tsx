import { cn, type RAGColor } from '@/lib/utils'

// ─── Single source of truth for the "financial terminal" design language ───────────────
// Promoted from the CEO dashboard so every page speaks the same dialect.

/** RAG status → soft tinted background + dark readable text (WCAG-safe; no white-on-yellow). */
export const STATUS_RAG: Record<string, { bg: string; text: string; label: string }> = {
  Green: { bg: 'bg-[#DCFCE7]', text: 'text-[#14532D]', label: 'Green' },
  Amber: { bg: 'bg-[#FEF3C7]', text: 'text-[#78350F]', label: 'Amber' },
  Red:   { bg: 'bg-[#FEE2E2]', text: 'text-[#7F1D1D]', label: 'Red'   },
  Blue:  { bg: 'bg-[#DBEAFE]', text: 'text-[#1E3A8A]', label: 'Done'  },
  Grey:  { bg: 'bg-[#F1F5F9]', text: 'text-[#475569]', label: 'N/A'   },
}

export const STATUS_DOT: Record<string, string> = {
  Green: 'bg-green-500', Amber: 'bg-amber-500', Red: 'bg-red-500', Blue: 'bg-blue-500', Grey: 'bg-slate-400',
}

/** Project visual identity (accent colours). */
export const PROJECT_ACCENT: Record<string, string> = {
  MAD: '#0B4A6F', BHX: '#166534', KLP: '#7C3AED', PHILAE: '#B45309', GVF: '#0F766E', ETP: '#334155',
}
export function projectAccent(pid: string): string {
  return PROJECT_ACCENT[pid] || '#334155'
}

/** Soft RAG chip with a status dot — the dashboard's canonical status pill. */
export function RagChip({ status, label }: { status: RAGColor; label?: string }) {
  const s = STATUS_RAG[status] || STATUS_RAG.Grey
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-[2px] px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide', s.bg, s.text)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT[status])} />
      {label ?? s.label}
    </span>
  )
}

export function RagDot({ status }: { status: RAGColor }) {
  return <span className={cn('inline-block h-2 w-2 rounded-full', STATUS_DOT[status])} />
}

/** Small project tag in the project's accent colour. */
export function ProjectBadge({ projectId }: { projectId: string }) {
  return (
    <span className="rounded-[2px] px-1.5 py-0.5 font-mono text-[10px] font-bold text-white" style={{ backgroundColor: projectAccent(projectId) }}>
      {projectId}
    </span>
  )
}

/**
 * Standard page header. Use across all non-dashboard pages for a consistent, on-brand title.
 * Renders the slate-900 "terminal" band by default (band=true) or a lighter inline header.
 */
export function PageHeader({
  title, subtitle, eyebrow = 'Gemswell Ventures · MIS', right, band = true,
}: { title: string; subtitle?: string; eyebrow?: string; right?: React.ReactNode; band?: boolean }) {
  if (band) {
    return (
      <header className="rounded-xl bg-slate-900 px-6 py-4 shadow-lg">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">{eyebrow}</p>
            <h1 className="mt-1 text-[20px] font-bold tracking-tight text-white">{title}</h1>
            {subtitle && <p className="mt-0.5 font-mono text-[11px] text-slate-400">{subtitle}</p>}
          </div>
          {right && <div className="flex items-center gap-2">{right}</div>}
        </div>
      </header>
    )
  }
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 pb-3">
      <div>
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">{eyebrow}</p>
        <h1 className="mt-0.5 text-[20px] font-bold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
      </div>
      {right && <div className="flex items-center gap-2">{right}</div>}
    </div>
  )
}
