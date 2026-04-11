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
}

type RankedChunk = ChunkForRerank & {
  relevanceScore: number
}

/**
 * Rerank chunks using Cohere rerank-v3.5.
 * Purpose-built neural reranker — faster, cheaper, and more accurate
 * than using an LLM as cross-encoder. $0.002 per query (up to 100 docs).
 * Falls back to similarity-based ordering if reranking fails.
 */
export async function rerankChunks(
  query: string,
  chunks: ChunkForRerank[],
  topK = 5
): Promise<RankedChunk[]> {
  if (chunks.length === 0) return []
  if (chunks.length <= topK) {
    return chunks.map(c => ({ ...c, relevanceScore: c.similarity || 0.5 }))
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

    const result = await cohere.rerank({
      model: 'rerank-v3.5',
      query,
      documents,
      topN: topK,
    })

    return result.results.map(r => ({
      ...chunks[r.index],
      relevanceScore: r.relevanceScore,
    }))

  } catch (err) {
    console.warn('Cohere reranking failed, falling back to similarity:', err)
    return chunks
      .sort((a, b) => (b.similarity || 0) - (a.similarity || 0))
      .slice(0, topK)
      .map(c => ({ ...c, relevanceScore: c.similarity || 0 }))
  }
}
