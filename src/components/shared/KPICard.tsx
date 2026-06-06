'use client'
import { cn, type RAGColor, ragColorMap } from '@/lib/utils'

interface KPICardProps {
  title: string
  value: string | number
  subtitle?: string
  rag?: RAGColor
  className?: string
}

export function KPICard({ title, value, subtitle, rag, className }: KPICardProps) {
  return (
    <div className={cn('rounded-lg border bg-card p-4 shadow-sm', className)}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        {rag && (
          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: ragColorMap[rag] }} />
        )}
      </div>
      <p className="mt-2 text-2xl font-bold">{value}</p>
      {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
    </div>
  )
}
