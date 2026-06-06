import { type RAGColor } from '@/lib/utils'
import { RagChip, RagDot } from '@/components/shared/terminal'

// Re-skinned onto the shared terminal chip: soft tinted background + dark text
// (fixes the old white-on-amber ~1.5:1 contrast and the palette divergence from the dashboard).
export function RAGBadge({ status, label }: { status: RAGColor; label?: string }) {
  return <RagChip status={status} label={label} />
}

export { RagDot as RAGDot }
