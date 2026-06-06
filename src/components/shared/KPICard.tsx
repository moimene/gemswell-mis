'use client'
import { cn, type RAGColor } from '@/lib/utils'
import { STATUS_DOT } from '@/components/shared/terminal'

interface KPICardProps {
  title: string
  value: string | number
  subtitle?: string
  rag?: RAGColor
  className?: string
}

/** Terminal-style KPI block: mono tracked label, tabular figure, slate palette — matches the dashboard. */
export function KPICard({ title, value, subtitle, rag, className }: KPICardProps) {
  return (
    <div className={cn('rounded-xl border border-slate-200 bg-white p-4 shadow-sm', className)}>
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">{title}</p>
        {rag && <span className={cn('h-2 w-2 rounded-full', STATUS_DOT[rag] ?? 'bg-slate-400')} />}
      </div>
      <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-slate-900">{value}</p>
      {subtitle && <p className="mt-1 font-mono text-[11px] text-slate-400">{subtitle}</p>}
    </div>
  )
}
