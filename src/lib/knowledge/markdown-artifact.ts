import type {
  AuthorityTier,
  ClassificationSource,
  Lifecycle,
  ReviewStatus,
  SourceChannel,
} from '@/lib/knowledge/contracts'

export type MarkdownFrontmatter = {
  document_id: string
  source_channel: SourceChannel
  source_hash: string
  file_name: string
  mime_type: string
  business_line_id?: string | null
  project_id?: string | null
  doc_type?: string | null
  lifecycle: Lifecycle
  authority_tier: AuthorityTier
  authority_score: number
  classification_source: ClassificationSource
  review_status: ReviewStatus
  parser: string
  ocr_used: boolean
  generated_at: string
  version: number
}

function yamlScalar(value: string | number | boolean): string {
  if (typeof value === 'boolean' || typeof value === 'number') return String(value)
  const safe = value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r?\n/g, '\\n')
  return `"${safe}"`
}

export function buildMarkdownArtifact(content: string, meta: MarkdownFrontmatter): string {
  const lines = ['---']

  for (const [key, value] of Object.entries(meta)) {
    if (value === undefined || value === null || value === '') continue
    lines.push(`${key}: ${yamlScalar(value)}`)
  }

  lines.push('---', '')
  return `${lines.join('\n')}\n${content.trimStart()}`
}

