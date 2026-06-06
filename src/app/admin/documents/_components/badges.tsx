import { cn } from '@/lib/utils'
import { verificationFromGovernance } from '@/lib/knowledge/source-reference'
import type { ClassificationSource, ReviewStatus } from '@/lib/knowledge/contracts'

const REVIEW_CONFIG: Record<string, { label: string; cls: string }> = {
  approved:     { label: 'Aprobado',   cls: 'bg-green-100 text-green-800' },
  needs_review: { label: 'Sin revisar', cls: 'bg-amber-100 text-amber-800' },
  rejected:     { label: 'Rechazado',  cls: 'bg-red-100 text-red-800' },
  pending:      { label: 'Pendiente',  cls: 'bg-slate-100 text-slate-600' },
}

export function ReviewBadge({ status }: { status: string }) {
  const c = REVIEW_CONFIG[status] ?? REVIEW_CONFIG.pending
  return <span className={cn('rounded-[2px] px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide', c.cls)}>{c.label}</span>
}

export function AuthorityBadge({ score, tier }: { score: number | null; tier?: string | null }) {
  if (score == null) return null
  const cls = score >= 90 ? 'text-green-700 bg-green-50' : score >= 75 ? 'text-amber-700 bg-amber-50' : 'text-slate-600 bg-slate-100'
  return <span className={cn('rounded-[2px] px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wide', cls)}>Auth {score}{tier ? ` · ${tier}` : ''}</span>
}

export function VerificationBadge({ score, review, source }: { score: number | null; review: string; source: string }) {
  // F11: single source of truth — reuse the chat/retrieval verification logic so the gestor
  // badge can never drift from how the same doc is graded in RAG answers.
  const v = verificationFromGovernance(score ?? undefined, review as ReviewStatus, source as ClassificationSource)
  const cfg = {
    source_of_record: { label: 'Fuente de registro', cls: 'bg-emerald-600 text-white' },
    supporting:       { label: 'Respaldo',           cls: 'bg-sky-100 text-sky-800' },
    context:          { label: 'Contexto',           cls: 'bg-slate-100 text-slate-600' },
    unverified:       { label: 'Sin verificar',      cls: 'bg-slate-100 text-slate-500' },
  }[v]
  return <span className={cn('rounded-[2px] px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide', cfg.cls)}>{cfg.label}</span>
}
