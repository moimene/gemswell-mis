import { cn, type RAGColor, ragColorMap } from '@/lib/utils'

export function RAGBadge({ status, label }: { status: RAGColor; label?: string }) {
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium text-white')}
      style={{ backgroundColor: ragColorMap[status] }}
    >
      {label || status}
    </span>
  )
}

export function RAGDot({ status }: { status: RAGColor }) {
  return (
    <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: ragColorMap[status] }} />
  )
}
