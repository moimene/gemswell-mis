export type ReconstructChunk = { chunk_index: number; content: string }

export function reconstructMarkdown(chunks: ReconstructChunk[]): string {
  return [...chunks]
    .sort((a, b) => a.chunk_index - b.chunk_index)
    .map((c) => (c.content ?? '').trim())
    .filter(Boolean)
    .join('\n\n')
}
