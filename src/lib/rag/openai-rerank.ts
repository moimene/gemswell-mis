import OpenAI from 'openai'
import type { RankedRetrievedChunk } from '@/lib/rag/retrieve'
import { openAIErrorSummary } from '@/lib/openai-error'

const OPENAI_RAG_RERANK_MODEL = process.env.RAG_OPENAI_RERANK_MODEL || process.env.OPENAI_CHAT_MODEL || 'gpt-5.5'
const OPENAI_RAG_RERANK_MAX = Number(process.env.RAG_OPENAI_RERANK_MAX || '16')

export type OpenAIChunkRerankResult = {
  chunks: RankedRetrievedChunk[]
  used: boolean
  model: string | null
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, value))
}

function parseRows(text: string): Array<{ id: string; score?: number; reason?: string }> {
  const cleaned = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim()
  const parsed = JSON.parse(cleaned) as unknown
  const rows = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object' && Array.isArray((parsed as { results?: unknown }).results)
      ? (parsed as { results: unknown[] }).results
      : []
  return rows
    .filter((row): row is Record<string, unknown> => !!row && typeof row === 'object')
    .map((row) => ({
      id: String(row.id ?? ''),
      score: typeof row.score === 'number' ? row.score : undefined,
      reason: typeof row.reason === 'string' ? row.reason : undefined,
    }))
    .filter((row) => row.id)
}

function parseToolRows(output: unknown): Array<{ id: string; score?: number; reason?: string }> {
  const items = Array.isArray(output) ? output : []
  const call = items.find((item): item is { type: string; name?: string; arguments?: string } =>
    !!item && typeof item === 'object' &&
    (item as { type?: unknown }).type === 'function_call' &&
    (item as { name?: unknown }).name === 'rank_chunks' &&
    typeof (item as { arguments?: unknown }).arguments === 'string'
  )
  if (!call?.arguments) return []
  try {
    const parsed = JSON.parse(call.arguments) as unknown
    const rows = parsed && typeof parsed === 'object' && Array.isArray((parsed as { results?: unknown }).results)
      ? (parsed as { results: unknown[] }).results
      : []
    return rows
      .filter((row): row is Record<string, unknown> => !!row && typeof row === 'object')
      .map((row) => ({
        id: String(row.id ?? ''),
        score: typeof row.score === 'number' ? row.score : undefined,
        reason: typeof row.reason === 'string' ? row.reason : undefined,
      }))
      .filter((row) => row.id)
  } catch {
    return []
  }
}

function modelRerankEnabled(enabled: boolean): boolean {
  if (!enabled) return false
  if (process.env.NODE_ENV === 'test') return false
  if (process.env.RAG_OPENAI_RERANK_ENABLED === 'false') return false
  return Boolean(process.env.OPENAI_API_KEY)
}

export async function rerankRetrievedChunksWithOpenAI(
  query: string,
  chunks: RankedRetrievedChunk[],
  opts: { enabled?: boolean; maxCandidates?: number } = {},
): Promise<OpenAIChunkRerankResult> {
  if (chunks.length <= 1 || !modelRerankEnabled(opts.enabled ?? true)) {
    return { chunks, used: false, model: null }
  }

  const maxCandidates = Math.min(Math.max(opts.maxCandidates ?? OPENAI_RAG_RERANK_MAX, 2), 40)
  const candidates = chunks.slice(0, maxCandidates)
  const rest = chunks.slice(maxCandidates)

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const response = await client.responses.create({
      model: OPENAI_RAG_RERANK_MODEL,
      store: false,
      max_output_tokens: 2200,
      instructions: [
        'Eres un reranker documental de alta precision.',
        'No respondas a la pregunta. Ordena fragmentos por utilidad probatoria para contestarla con citas.',
        'Da prioridad a contratos fuente, documentos aprobados, importes/fechas/clausulas exactas y coincidencias de entidades.',
        'Usa solo los fragmentos y metadatos dados.',
        'Llama obligatoriamente a rank_chunks con los ids ordenados. La razon debe ser breve.',
      ].join('\n'),
      tools: [{
        type: 'function',
        name: 'rank_chunks',
        description: 'Return the document chunks ordered by evidentiary usefulness for the query.',
        parameters: {
          type: 'object',
          additionalProperties: false,
          properties: {
            results: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  id: { type: 'string' },
                  score: { type: 'number' },
                  reason: { type: 'string' },
                },
                required: ['id', 'score', 'reason'],
              },
            },
          },
          required: ['results'],
        },
        strict: false,
      }],
      tool_choice: { type: 'function', name: 'rank_chunks' },
      input: JSON.stringify({
        query,
        candidates: candidates.map((chunk) => ({
          id: chunk.id,
          document_id: chunk.document_id,
          score: chunk.relevanceScore,
          metadata: {
            title: chunk.metadata?.title ?? chunk.metadata?.source_file,
            project_id: chunk.metadata?.project_id,
            doc_type: chunk.metadata?.doc_type,
            review_status: chunk.metadata?.review_status,
            authority_score: chunk.metadata?.authority_score,
            graph_entities: chunk.metadata?.graph_entities,
          },
          text: chunk.content.slice(0, 1100),
        })),
      }),
    })

    const toolRows = parseToolRows(response.output)
    const rows = toolRows.length ? toolRows : parseRows(response.output_text ?? '')
    if (rows.length === 0) return { chunks, used: false, model: null }

    const byId = new Map(candidates.map((chunk) => [chunk.id, chunk]))
    const seen = new Set<string>()
    const ranked: RankedRetrievedChunk[] = []
    for (const row of rows) {
      const chunk = byId.get(row.id)
      if (!chunk || seen.has(row.id)) continue
      seen.add(row.id)
      ranked.push({
        ...chunk,
        relevanceScore: row.score != null ? clamp(row.score) : chunk.relevanceScore,
        metadata: {
          ...chunk.metadata,
          reranked_by: 'openai',
          rerank_model: OPENAI_RAG_RERANK_MODEL,
          rerank_reason: row.reason,
        },
      })
    }
    for (const chunk of candidates) if (!seen.has(chunk.id)) ranked.push(chunk)
    return { chunks: [...ranked, ...rest], used: true, model: OPENAI_RAG_RERANK_MODEL }
  } catch (err) {
    console.warn('[rag/openai-rerank] model rerank failed, using hybrid ranking:', openAIErrorSummary(err))
    return { chunks, used: false, model: null }
  }
}
