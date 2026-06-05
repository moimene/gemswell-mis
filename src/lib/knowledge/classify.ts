import { scoreToTier } from '@/lib/knowledge/authority'
import type { AuthorityTier, ReviewStatus } from '@/lib/knowledge/contracts'

export type ChunkMetaLite = {
  authority?: number | string | null
  doc_type?: string | null
  project_id?: string | null
  period?: string | null
  dms_folder?: string | null
}

export type LiftedLabels = {
  authority_score: number | null
  authority_tier: AuthorityTier
  doc_type: string | null
  project_id: string | null
  period: string | null
  dms_folder: string | null
  confidence: number
}

function mode(values: (string | null | undefined)[]): { value: string | null; share: number } {
  const counts = new Map<string, number>()
  let total = 0
  for (const v of values) {
    if (!v) continue
    counts.set(v, (counts.get(v) ?? 0) + 1)
    total++
  }
  if (total === 0) return { value: null, share: 0 }
  let best: string | null = null
  let bestN = 0
  for (const [v, n] of counts) if (n > bestN) { best = v; bestN = n }
  return { value: best, share: bestN / total }
}

export function liftUpFromChunks(metas: ChunkMetaLite[]): LiftedLabels {
  const authorities = metas
    .map(m => (m.authority == null ? NaN : Number(m.authority)))
    .filter(n => Number.isFinite(n)) as number[]
  const authority_score = authorities.length ? Math.max(...authorities) : null
  const docTypeMode = mode(metas.map(m => m.doc_type))
  const projectMode = mode(metas.map(m => m.project_id))
  const periodMode = mode(metas.map(m => m.period))
  const folderMode = mode(metas.map(m => m.dms_folder))
  return {
    authority_score,
    authority_tier: authority_score == null ? 'unverified' : scoreToTier(authority_score),
    doc_type: docTypeMode.value,
    project_id: projectMode.value,
    period: periodMode.value,
    dms_folder: folderMode.value,
    confidence: docTypeMode.share,
  }
}

export function decideReviewStatus(labels: {
  doc_type: string | null
  authority_tier: AuthorityTier
  confidence: number
}): ReviewStatus {
  const classified =
    labels.confidence >= 0.5 &&
    !!labels.doc_type &&
    labels.doc_type !== 'other' &&
    labels.authority_tier !== 'unverified'
  return classified ? 'approved' : 'needs_review'
}
