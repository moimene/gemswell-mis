export type SourceChannel =
  | 'browser_upload'
  | 'drive_sync'
  | 'gmail_bot'
  | 'local_backfill'
  | 'manual_admin'

export type ClassificationSource =
  | 'human'
  | 'rule'
  | 'agent_auto'
  | 'agent_reviewed'
  | 'agent_corrected'
  | 'agent_rejected'

export type ReviewStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'needs_review'

export type Confidentiality =
  | 'public'
  | 'internal'
  | 'confidential'
  | 'restricted'

export type DocType =
  | 'legal'
  | 'board'
  | 'funding'
  | 'capex'
  | 'cash_flow'
  | 'bp_model'
  | 'financial_statements'
  | 'tax'
  | 'kyc'
  | 'dd'
  | 'asset_management'
  | 'correspondence'
  | 'general'
  | 'unknown'

export type Lifecycle =
  | 'draft'
  | 'signed'
  | 'executed'
  | 'filed'
  | 'audited'
  | 'working_paper'
  | 'superseded'
  | 'unknown'

export type AuthorityTier =
  | 'audited'
  | 'executed'
  | 'controller'
  | 'board_pack'
  | 'dd_memo'
  | 'internal'
  | 'narrative'
  | 'unverified'

export type RagStatus =
  | 'pending'
  | 'processing'
  | 'indexed'
  | 'failed'

export type MarkdownStatus =
  | 'pending'
  | 'generated'
  | 'needs_ocr'
  | 'failed'

export type KnowledgeIntakeItem = {
  source_channel: SourceChannel
  external_id: string | null
  external_thread_id?: string | null
  source_hash: string
  file_name: string
  mime_type: string
  file_size: number
  storage_path: string | null
  local_path?: string | null
  uploaded_by?: string | null
  from_email?: string | null
  received_at: string
}

export type DocumentLabels = {
  project_id?: string | null
  business_line_id?: string | null
  entity_ids: string[]
  doc_type: DocType
  lifecycle: Lifecycle
  authority_tier: AuthorityTier
  authority_score: number
  topics: string[]
  period?: string | null
  currency?: 'EUR' | 'GBP' | 'USD' | null
  confidence: number
  classification_source: ClassificationSource
  review_status: ReviewStatus
  review_reason?: string | null
}

export type CanonicalDocument = KnowledgeIntakeItem & DocumentLabels & {
  id: string
  md_path: string | null
  rag_status: RagStatus
  md_status: MarkdownStatus
  current_version: number
  supersedes_document_id?: string | null
  created_at: string
  updated_at: string
}

export const AUTHORITY_TIER_SCORE: Record<AuthorityTier, number> = {
  audited: 100,
  executed: 90,
  controller: 80,
  board_pack: 70,
  dd_memo: 60,
  internal: 40,
  narrative: 10,
  unverified: 0,
}

