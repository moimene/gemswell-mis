import Anthropic from '@anthropic-ai/sdk'

let client: Anthropic | null = null
function getClient() {
  if (!client) {
    const key = process.env.ANTHROPIC_API_KEY
    if (!key) throw new Error('ANTHROPIC_API_KEY not set')
    client = new Anthropic({ apiKey: key })
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

const RERANK_PROMPT = `You are a financial data relevance expert for Gemswell Ventures, a wave park development company managing projects in Madrid (MAD) and Birmingham (BHX).

Score each document chunk's relevance to the user's question on a scale of 0-10:
- 10: Directly answers the question with specific financial data (amounts, dates, percentages)
- 8-9: Contains closely related financial information for the correct project/period
- 5-7: Contains relevant context but not the specific data asked about
- 3-4: Tangentially related (same project but different financial domain)
- 0-2: Irrelevant or about the wrong project/period

Key financial domains:
- CapEx: Budget baseline, approved budget, committed, invoiced, paid, EAC, variance
- Cash Flow: 13-week rolling, inflows, outflows, net position, confidence levels
- Funding: Debt facilities (CESCE), equity, drawn/undrawn, utilization
- BP Model: IRR, NPV, revenue projections, opening dates, construction milestones

Return ONLY a JSON array of scores in the same order as the chunks, e.g. [8, 3, 10, 1]
No explanation, just the array.`

/**
 * Rerank chunks using Claude as a cross-encoder.
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
    const anthropic = getClient()

    const chunkDescriptions = chunks.map((c, i) => {
      const meta = c.metadata || {}
      const metaStr = Object.entries(meta)
        .filter(([, v]) => v != null)
        .map(([k, v]) => `${k}=${v}`)
        .join(', ')
      return `[Chunk ${i}] ${metaStr ? `(${metaStr}) ` : ''}${c.content.slice(0, 500)}`
    }).join('\n\n')

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 256,
      messages: [{
        role: 'user',
        content: `Question: ${query}\n\nChunks to score:\n\n${chunkDescriptions}`
      }],
      system: RERANK_PROMPT,
    })

    const text = response.content[0]?.type === 'text' ? response.content[0].text : ''
    const jsonMatch = text.match(/\[[\d,\s.]+\]/)
    if (!jsonMatch) throw new Error('No JSON array in rerank response')

    const scores: number[] = JSON.parse(jsonMatch[0])

    const ranked = chunks.map((c, i) => ({
      ...c,
      relevanceScore: (scores[i] ?? 0) / 10  // normalize to 0-1
    }))

    return ranked
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, topK)

  } catch (err) {
    console.warn('Reranking failed, falling back to similarity:', err)
    return chunks
      .sort((a, b) => (b.similarity || 0) - (a.similarity || 0))
      .slice(0, topK)
      .map(c => ({ ...c, relevanceScore: c.similarity || 0 }))
  }
}
