import { DOC_TYPES } from '@/lib/knowledge/contracts'
import type { DocType, ReviewStatus } from '@/lib/knowledge/contracts'

const REVIEW_STATUSES: ReviewStatus[] = ['pending', 'approved', 'rejected', 'needs_review']

export const LIST_COLUMNS = [
  'id', 'title', 'project_id', 'doc_type', 'period', 'review_status',
  'authority_score', 'authority_tier', 'classification_source', 'classification_confidence',
  'status', 'source_channel', 'chunk_count', 'summary', 'md_path', 'source_hash',
  'created_at', 'current_version', 'supersedes_document_id',
].join(', ')

export type ListParams = {
  page: number
  pageSize: number
  offset: number
  status?: ReviewStatus
  doc_type?: DocType
  project?: string
  authorityMin?: number
  channel?: string
  q?: string
  onlyNeedsReview: boolean
  onlyNoMarkdown: boolean
  includeRetired: boolean
  // F17: a doc_type that isn't in the allowlist must return ZERO results, not silently drop the
  // filter and return the full list (a wrong-result-not-error compliance hazard).
  docTypeInvalid: boolean
  // F18: 'authority' (default) = authority desc; 'review' = review-priority (lowest classifier
  // confidence first, then oldest) so the deepest-uncertainty docs surface first in the queue.
  sort: 'authority' | 'review'
}

function clampInt(v: string | null, min: number, max: number, dflt: number): number {
  const n = v == null ? NaN : parseInt(v, 10)
  if (!Number.isFinite(n)) return dflt
  return Math.min(max, Math.max(min, n))
}

export function parseListParams(sp: URLSearchParams): ListParams {
  const page = clampInt(sp.get('page'), 1, 1_000_000, 1)
  const pageSize = clampInt(sp.get('pageSize'), 1, 200, 50)
  const statusRaw = sp.get('status') ?? undefined
  const docTypeRaw = sp.get('doc_type') ?? undefined
  const project = sp.get('project')?.trim() || undefined
  const channel = sp.get('channel')?.trim() || undefined
  const q = sp.get('q')?.trim() || undefined
  const authorityMinRaw = sp.get('authority_min')
  const docTypeValid = !!docTypeRaw && (DOC_TYPES as readonly string[]).includes(docTypeRaw)
  return {
    page, pageSize, offset: (page - 1) * pageSize,
    status: statusRaw && REVIEW_STATUSES.includes(statusRaw as ReviewStatus) ? (statusRaw as ReviewStatus) : undefined,
    doc_type: docTypeValid ? (docTypeRaw as DocType) : undefined,
    docTypeInvalid: !!docTypeRaw && !docTypeValid,
    project,
    authorityMin: authorityMinRaw != null ? clampInt(authorityMinRaw, 0, 100, 0) : undefined,
    channel, q,
    onlyNeedsReview: sp.get('onlyNeedsReview') === 'true',
    onlyNoMarkdown: sp.get('onlyNoMarkdown') === 'true',
    includeRetired: sp.get('includeRetired') === 'true',
    sort: sp.get('sort') === 'review' ? 'review' : 'authority',
  }
}
