import type { ClassificationSource, ReviewStatus } from '@/lib/knowledge/contracts'

const HUMAN_VALIDATED_SOURCES = new Set<ClassificationSource>(['human', 'agent_reviewed', 'agent_corrected'])

export type SourceVerification = 'source_of_record' | 'supporting' | 'context' | 'unverified'

export type KnowledgeSource = {
  id: string
  /** Parent rag_documents.id — used to deep-link the citation to the document's gestor detail
   *  (every source is then inspectable even when no storage artifact exists). */
  documentId?: string
  relevance: number
  metadata: Record<string, unknown>
  preview: string
  label: string
  verification: SourceVerification
}

type BuildSourceInput = {
  id: string
  documentId?: string
  relevance: number
  metadata?: Record<string, unknown>
  preview: string
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function numberValue(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

function reviewStatusValue(value: unknown): ReviewStatus {
  return typeof value === 'string' && ['pending', 'approved', 'rejected', 'needs_review'].includes(value)
    ? value as ReviewStatus
    : 'needs_review'
}

function classificationSourceValue(value: unknown): ClassificationSource | 'unknown' {
  return typeof value === 'string' && [
    'human',
    'rule',
    'agent_auto',
    'agent_reviewed',
    'agent_corrected',
    'agent_rejected',
  ].includes(value)
    ? value as ClassificationSource
    : 'unknown'
}

export function verificationFromGovernance(
  authority: number | undefined,
  reviewStatus: ReviewStatus,
  classificationSource: ClassificationSource | 'unknown'
): SourceVerification {
  if (reviewStatus === 'rejected') return 'unverified'
  if (authority == null) return 'unverified'
  if (
    authority >= 90 &&
    reviewStatus === 'approved' &&
    classificationSource !== 'unknown' &&
    HUMAN_VALIDATED_SOURCES.has(classificationSource as ClassificationSource)
  ) return 'source_of_record'
  // Approved + meaningful authority = supporting; everything else (un-reviewed regardless of
  // authority, or low authority) is context. Un-reviewed deliberately caps at context (fail-closed,
  // per sub-project A's governance model) — not a gradation bug.
  if (authority >= 75 && reviewStatus === 'approved') return 'supporting'
  return 'context'
}

export function buildKnowledgeSource(input: BuildSourceInput): KnowledgeSource {
  const metadata = { ...(input.metadata ?? {}) }
  const sourceFile = stringValue(metadata.source_file) ?? stringValue(metadata.file_name) ?? 'unknown source'
  const projectId = stringValue(metadata.project_id)
  const docType = stringValue(metadata.doc_type)
  const dmsFolder = stringValue(metadata.dms_folder)
  const storagePath = stringValue(metadata.storage_path) ?? stringValue(metadata.storage_object_path)
  const publicUrl = stringValue(metadata.public_url)
  const authority = numberValue(metadata.authority_score) ?? numberValue(metadata.authority)
  const reviewStatus = reviewStatusValue(metadata.review_status)
  const classificationSource = classificationSourceValue(metadata.classification_source)
  const verification = verificationFromGovernance(authority, reviewStatus, classificationSource)

  const dmsPath = dmsFolder ? `${dmsFolder}/${sourceFile}` : undefined
  const reviewSuffix = reviewStatus === 'pending' || reviewStatus === 'needs_review'
    ? ' [SIN REVISAR]'
    : ''
  const label = [projectId, docType, sourceFile].filter(Boolean).join(' | ') + reviewSuffix

  return {
    id: input.id,
    documentId: input.documentId,
    relevance: input.relevance,
    preview: input.preview,
    label,
    verification,
    metadata: {
      ...metadata,
      source_file: sourceFile,
      source_label: label,
      source_kind: publicUrl || storagePath ? 'storage' : 'dms_local',
      ...(dmsPath ? { dms_path: dmsPath } : {}),
      ...(storagePath ? { storage_path: storagePath } : {}),
      ...(publicUrl ? { public_url: publicUrl } : {}),
      ...(authority != null ? { authority } : {}),
      ...(authority != null ? { authority_score: authority } : {}),
      review_status: reviewStatus,
      classification_source: classificationSource,
      verification,
    },
  }
}

export function sourceHeader(metadata: Record<string, unknown>, relevance: number, index: number): string {
  const project = stringValue(metadata.project_id) ?? '?'
  const docType = stringValue(metadata.doc_type) ?? '?'
  const source = stringValue(metadata.source_file) ?? stringValue(metadata.file_name) ?? 'unknown'
  const period = stringValue(metadata.period)
  const authority = numberValue(metadata.authority_score) ?? numberValue(metadata.authority)
  const reviewStatus = reviewStatusValue(metadata.review_status)
  const classificationSource = classificationSourceValue(metadata.classification_source)
  const authorityLabel = authority == null ? '' : ` | authority ${authority}`
  const periodLabel = period ? ` | ${period}` : ''
  const governanceLabel = ` | review ${reviewStatus} | class ${classificationSource}`
  return `[Source ${index + 1}] ${project} | ${docType}${periodLabel} | ${source}${authorityLabel}${governanceLabel} (${(relevance * 100).toFixed(0)}%)`
}
