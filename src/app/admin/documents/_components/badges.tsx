import { cn } from '@/lib/utils'

const REVIEW_CONFIG: Record<string, { label: string; cls: string }> = {
  approved:     { label: 'Aprobado',   cls: 'bg-green-100 text-green-800' },
  needs_review: { label: 'Sin revisar', cls: 'bg-amber-100 text-amber-800' },
  rejected:     { label: 'Rechazado',  cls: 'bg-red-100 text-red-800' },
  pending:      { label: 'Pendiente',  cls: 'bg-slate-100 text-slate-600' },
}

export function ReviewBadge({ status }: { status: string }) {
  const c = REVIEW_CONFIG[status] ?? REVIEW_CONFIG.pending
  return <span className={cn('rounded px-1.5 py-0.5 text-xs font-medium', c.cls)}>{c.label}</span>
}

export function AuthorityBadge({ score, tier }: { score: number | null; tier?: string | null }) {
  if (score == null) return null
  const cls = score >= 90 ? 'text-green-700 bg-green-50' : score >= 75 ? 'text-amber-700 bg-amber-50' : 'text-slate-600 bg-slate-100'
  return <span className={cn('rounded px-1.5 py-0.5 text-xs font-medium', cls)}>Auth {score}{tier ? ` · ${tier}` : ''}</span>
}

const HUMAN_VALIDATED = new Set(['human', 'agent_reviewed', 'agent_corrected'])
/** Mirrors source-reference verificationFromGovernance for the badge shown in the gestor. */
export function verification(score: number | null, review: string, source: string): 'source_of_record' | 'supporting' | 'context' | 'unverified' {
  if (review === 'rejected') return 'unverified'
  if (score == null) return 'unverified'
  if (score >= 90 && review === 'approved' && HUMAN_VALIDATED.has(source)) return 'source_of_record'
  if (score >= 75 && review === 'approved') return 'supporting'
  if (score >= 75) return 'context'
  return 'context'
}

export function VerificationBadge({ score, review, source }: { score: number | null; review: string; source: string }) {
  const v = verification(score, review, source)
  const cfg = {
    source_of_record: { label: 'Source of record', cls: 'bg-emerald-600 text-white' },
    supporting:       { label: 'Supporting',       cls: 'bg-sky-100 text-sky-800' },
    context:          { label: 'Context',          cls: 'bg-slate-100 text-slate-600' },
    unverified:       { label: 'Unverified',       cls: 'bg-slate-100 text-slate-500' },
  }[v]
  return <span className={cn('rounded px-1.5 py-0.5 text-xs font-medium', cfg.cls)}>{cfg.label}</span>
}
