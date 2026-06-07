import type { SupabaseClient } from '@supabase/supabase-js'
import { embedText } from '@/lib/rag/embeddings'
import { rerankChunks } from '@/lib/rag/rerank'
import { rankBySourceTrust } from '@/lib/rag/rank'

// ─── Shared retrieval core ───────────────────────────────────────────
// Single source of truth for the documentary retrieval pipeline used by /api/chat's
// search_documents tool AND the evaluation harness (scripts/eval). Keeping ONE implementation means
// the harness measures the exact production path (real Gemini embed → match_chunks + keyword_search_
// chunks via supabase-js/PostgREST → merge/dedup → Cohere rerank of the full pool → trust-tier sort).
//
// ⚠ Do not "optimise" match_chunks call shape here without re-reading the pgvector/PostgREST HNSW
// gotcha: the RPC must keep its sql/015 signature so it stays index-served via PostgREST.

export type RetrievedChunk = {
  id: string
  document_id: string
  content: string
  metadata: Record<string, unknown>
  similarity?: number
}

export type RankedRetrievedChunk = RetrievedChunk & { relevanceScore: number }

export type RetrievalDiagnostics = {
  /** Rows returned by the vector RPC (match_chunks). */
  vectorCount: number
  /** Rows returned by the keyword RPC (keyword_search_chunks). */
  keywordCount: number
  /** Distinct chunks in the merged pool after dedup + rejected-source removal (what gets reranked). */
  poolCount: number
  /** Chunks present in BOTH vector and keyword result sets (retrieval agreement signal). */
  overlapCount: number
  /** Cohere rerank fell back to raw-similarity ordering (relevanceScore is approximate). */
  degraded: boolean
}

export type RetrievalResult = {
  /** Final top-K chunks after rerank + trust-tier ordering — exactly what the chat cites. */
  ranked: RankedRetrievedChunk[]
  diagnostics: RetrievalDiagnostics
}

export type RetrieveOptions = {
  projectFilter?: string | null
  docTypeFilter?: string | null
}

// Defaults preserved verbatim from the original route.ts so extraction is behavior-preserving.
// Deliberately permissive vector floor (recall-first): precision is handled downstream by the Cohere
// reranker + trust-tier ordering. Tighten only with a live service-role probe (see HNSW gotcha memo).
export const RAG_MATCH_THRESHOLD = Number(process.env.RAG_MATCH_THRESHOLD || '0.18')
export const RAG_VECTOR_MATCH_COUNT = Number(process.env.RAG_VECTOR_MATCH_COUNT || '25')
export const RAG_KEYWORD_MATCH_COUNT = Number(process.env.RAG_KEYWORD_MATCH_COUNT || '15')
export const RAG_FINAL_TOP_K = Number(process.env.RAG_FINAL_TOP_K || '10')

function metadataString(metadata: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = metadata?.[key]
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

/** A chunk whose parent document is governance-rejected — never surfaced as evidence. */
export function isRejectedSource(metadata: Record<string, unknown> | undefined): boolean {
  return metadataString(metadata, 'review_status') === 'rejected' ||
    metadataString(metadata, 'classification_source') === 'agent_rejected'
}

/**
 * Hybrid documentary retrieval: vector + keyword in parallel, merged, reranked over the FULL pool
 * (so trust-tier ordering can promote a high-trust chunk Cohere scored modestly), then ordered by
 * trust tier and truncated to the final top-K.
 */
export async function retrieveDocuments(
  supabase: SupabaseClient,
  query: string,
  opts: RetrieveOptions = {}
): Promise<RetrievalResult> {
  const projectFilter = opts.projectFilter ?? null
  const docTypeFilter = opts.docTypeFilter ?? null

  // Parallel: vector search + keyword search
  const [vectorResults, keywordResults] = await Promise.all([
    (async () => {
      try {
        const embedding = await embedText(query, { lane: 'interactive' })
        const { data } = await supabase.rpc('match_chunks', {
          query_embedding: embedding,
          match_count: RAG_VECTOR_MATCH_COUNT,
          filter_project: projectFilter,
          filter_doc_type: docTypeFilter,
          match_threshold: RAG_MATCH_THRESHOLD,
        })
        return ((data || []) as RetrievedChunk[]).map((r) => ({
          id: r.id,
          document_id: r.document_id,
          content: r.content,
          metadata: r.metadata || {},
          similarity: r.similarity,
        }))
      } catch {
        return []
      }
    })(),
    (async () => {
      try {
        const { data } = await supabase.rpc('keyword_search_chunks', {
          query_text: query,
          filter_project: projectFilter,
          match_count: RAG_KEYWORD_MATCH_COUNT,
          filter_doc_type: docTypeFilter,
        })
        return ((data || []) as Array<RetrievedChunk & { rank?: number }>)
          // RPC already applies doc_type; keep this as a defensive belt-and-suspenders
          .filter((r) => !docTypeFilter || r.metadata?.doc_type === docTypeFilter)
          .map((r) => ({
            id: r.id,
            document_id: r.document_id,
            content: r.content,
            metadata: r.metadata || {},
            similarity: r.rank,
          }))
      } catch {
        return []
      }
    })(),
  ])

  // Merge + dedup by id (vector results take precedence for similarity score)
  const vectorIds = new Set(vectorResults.map((r) => r.id))
  const keywordIds = new Set(keywordResults.map((r) => r.id))
  let overlapCount = 0
  for (const id of vectorIds) if (keywordIds.has(id)) overlapCount++

  const merged = new Map<string, RetrievedChunk>()
  for (const r of [...vectorResults, ...keywordResults]) {
    if (isRejectedSource(r.metadata)) continue
    if (!merged.has(r.id)) merged.set(r.id, r)
  }

  const pool = Array.from(merged.values())
  if (pool.length === 0) {
    return {
      ranked: [],
      diagnostics: {
        vectorCount: vectorResults.length,
        keywordCount: keywordResults.length,
        poolCount: 0,
        overlapCount,
        degraded: false,
      },
    }
  }

  // Cohere-rerank the FULL pool (not just top-K) so trust-tier ordering can promote a high-trust chunk
  // Cohere scored modestly — otherwise Cohere's relevance cut would drop it before trust is considered.
  const { chunks: rerankedRaw, degraded } = await rerankChunks(query, pool, pool.length)
  const reranked = rerankedRaw.filter((c) => !isRejectedSource(c.metadata))
  const ranked = rankBySourceTrust(reranked).slice(0, RAG_FINAL_TOP_K) as RankedRetrievedChunk[]

  return {
    ranked,
    diagnostics: {
      vectorCount: vectorResults.length,
      keywordCount: keywordResults.length,
      poolCount: pool.length,
      overlapCount,
      degraded,
    },
  }
}
