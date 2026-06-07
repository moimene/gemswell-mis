import { CohereClient } from 'cohere-ai'

let client: CohereClient | null = null
function getClient() {
  if (!client) {
    const key = process.env.COHERE_API_KEY
    if (!key) throw new Error('COHERE_API_KEY not set')
    client = new CohereClient({ token: key })
  }
  return client
}

type ChunkForRerank = {
  id: string
  content: string
  metadata?: Record<string, unknown>
  similarity?: number
  /** Scale-free Reciprocal Rank Fusion score (Fase 2). Used to order the DEGRADED fallback when Cohere
   *  is down — cosine and raw ts_rank are NOT comparable, so similarity-only ordering mis-ranks (audit A3). */
  fusedScore?: number
}

type RankedChunk = ChunkForRerank & {
  relevanceScore: number
}

export type RerankResult = {
  chunks: RankedChunk[]
  /** True when Cohere reranking failed and we fell back to raw similarity ordering. In that mode
   *  relevanceScore is a normalised approximation, NOT a Cohere relevance — the UI must say so (F13)
   *  because the vector cosine and keyword ts_rank scores live on different, non-comparable scales. */
  degraded: boolean
}

/** Min-max normalise a set of raw similarity scores into [0,1] so the displayed "% relevant" is
 *  bounded and self-consistent within the fallback set (raw ts_rank can exceed 1; cosine sits ~0.2-0.9). */
function normaliseScores(values: number[]): number[] {
  if (values.length === 0) return []
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min
  // Degenerate (all equal): map to a neutral mid so we don't imply false precision.
  if (span < 1e-9) return values.map(() => 0.5)
  return values.map(v => (v - min) / span)
}

/**
 * Rerank chunks using Cohere rerank-v3.5.
 * Purpose-built neural reranker — faster, cheaper, and more accurate
 * than using an LLM as cross-encoder. $0.002 per query (up to 100 docs).
 * Falls back to NORMALISED similarity ordering (degraded=true) if reranking fails.
 */
export async function rerankChunks(
  query: string,
  chunks: ChunkForRerank[],
  topK = 5
): Promise<RerankResult> {
  if (chunks.length === 0) return { chunks: [], degraded: false }
  // Only skip Cohere when there's nothing to rank. (Previously skipped whenever
  // chunks.length <= topK, which defeated "rerank the whole pool then re-sort by trust":
  // callers passing topK >= pool size got raw similarity, not Cohere relevance.)
  if (chunks.length <= 1) {
    return { chunks: chunks.map(c => ({ ...c, relevanceScore: c.similarity || 0.5 })), degraded: false }
  }

  try {
    const cohere = getClient()

    // Cohere rerank accepts documents with text field, max ~500 tokens each
    const documents = chunks.map(c => {
      const meta = c.metadata || {}
      const prefix = [meta.project_id, meta.doc_type, meta.period]
        .filter(Boolean).join(' | ')
      return { text: (prefix ? `[${prefix}] ` : '') + c.content.slice(0, 1500) }
    })

    // One retry before degrading — a transient Cohere blip shouldn't silently drop the pool to the
    // (approximate) fallback ordering. (Fase 2 / WS1-T2)
    let result: { results: Array<{ index: number; relevanceScore: number }> } | undefined
    let lastErr: unknown
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        result = await cohere.rerank({ model: 'rerank-v3.5', query, documents, topN: topK })
        break
      } catch (e) {
        lastErr = e
      }
    }
    if (!result) throw lastErr

    return {
      chunks: result.results.map(r => ({
        ...chunks[r.index],
        relevanceScore: r.relevanceScore,
      })),
      degraded: false,
    }

  } catch (err) {
    console.warn('Cohere reranking failed, falling back to fused/similarity ordering:', err)
    // Order by the scale-free RRF fusedScore when present (audit A3: cosine vs raw ts_rank are NOT
    // comparable, so a similarity-only sort mis-ranks a big keyword ts_rank above a strong vector hit);
    // fall back to similarity only when no fusedScore was supplied.
    const sortKey = (c: ChunkForRerank) => c.fusedScore ?? c.similarity ?? 0
    const sorted = chunks.slice().sort((a, b) => sortKey(b) - sortKey(a)).slice(0, topK)
    const normalised = normaliseScores(sorted.map(sortKey))
    return {
      chunks: sorted.map((c, i) => ({ ...c, relevanceScore: normalised[i] })),
      degraded: true,
    }
  }
}
