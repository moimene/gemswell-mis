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
  /** Distinct chunks in the merged pool after dedup + excluded-source removal (what gets reranked). */
  poolCount: number
  /** Chunks present in BOTH vector and keyword result sets (retrieval agreement signal). */
  overlapCount: number
  /** Cohere rerank fell back to raw-similarity ordering (relevanceScore is approximate). */
  degraded: boolean
  /** Vector lane (match_chunks) threw — e.g. Gemini 429 / RPC timeout. Distinguishes outage from "no matches". */
  vectorFailed: boolean
  /** Keyword lane (keyword_search_chunks) threw — e.g. statement timeout. Distinguishes outage from "no matches". */
  keywordFailed: boolean
  /** Count of FINAL ranked chunks whose parent is needs_review/pending (the chat leaned on ungoverned evidence). */
  unreviewedUsed: number
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
 * The full set of governance/lifecycle states that must NEVER reach chat context (audit 2026-06-07):
 * rejected/agent_rejected (rejected sources) PLUS lifecycle='superseded' (a replaced revision that
 * must not be cited next to its replacement). `needs_review`/`pending` are deliberately NOT excluded —
 * the chat keeps them as a fallback (ranked strictly below approved by rankBySourceTrust) and discloses
 * the reliance, rather than blinding the bot to 41% of the corpus. This is the app-layer defense-in-depth
 * mirror of the SQL filter in match_chunks / keyword_search_chunks (sql/019).
 */
export function isExcludedFromRetrieval(metadata: Record<string, unknown> | undefined): boolean {
  return isRejectedSource(metadata) || metadataString(metadata, 'lifecycle') === 'superseded'
}

/** True when a chunk's parent document is ungoverned (not yet human-reviewed). */
function isUnreviewedSource(metadata: Record<string, unknown> | undefined): boolean {
  const rs = metadataString(metadata, 'review_status')
  return rs === 'needs_review' || rs === 'pending'
}

/**
 * Tool-result text when retrieval yields nothing. Critically distinguishes a retrieval OUTAGE
 * (a lane threw — Gemini 429 / RPC timeout) from a genuine no-match, and never blames governance
 * for an infrastructure failure (the old message wrongly claimed "excluded because rejected").
 */
export function emptyResultMessage(diagnostics: Pick<RetrievalDiagnostics, 'vectorFailed' | 'keywordFailed'>): string {
  if (diagnostics.vectorFailed || diagnostics.keywordFailed) {
    const which = diagnostics.vectorFailed && diagnostics.keywordFailed
      ? 'Both the semantic and keyword retrieval lanes'
      : diagnostics.vectorFailed
        ? 'The semantic (vector) retrieval lane'
        : 'The keyword retrieval lane'
    return `Document retrieval is temporarily degraded: ${which} did not respond, so no documentary evidence could be retrieved for this query. This is a transient retrieval failure, NOT an absence of relevant documents — do not conclude the corpus lacks an answer. Say the documentary search was unavailable and suggest retrying.`
  }
  return 'No relevant documents were found in the indexed corpus for this query.'
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

  // Parallel: vector search + keyword search. Each lane reports whether it THREW (outage) vs returned
  // empty (no matches) — a distinction the old `catch { return [] }` erased, hiding the exact silent
  // single-lane degradation that has already bitten this corpus twice (HNSW + stopword timeouts).
  const [vector, keyword] = await Promise.all([
    (async (): Promise<{ rows: RetrievedChunk[]; failed: boolean }> => {
      try {
        const embedding = await embedText(query, { lane: 'interactive' })
        const { data, error } = await supabase.rpc('match_chunks', {
          query_embedding: embedding,
          match_count: RAG_VECTOR_MATCH_COUNT,
          filter_project: projectFilter,
          filter_doc_type: docTypeFilter,
          match_threshold: RAG_MATCH_THRESHOLD,
        })
        // supabase-js does NOT throw on a PostgREST error (e.g. statement timeout — the silent-death mode
        // that killed retrieval twice); it returns it in `error`. Treat that as a lane FAILURE (outage),
        // not a clean empty result, so the chat surfaces degradation instead of "no documents". (adversarial review)
        if (error) return { rows: [], failed: true }
        return {
          rows: ((data || []) as RetrievedChunk[]).map((r) => ({
            id: r.id,
            document_id: r.document_id,
            content: r.content,
            metadata: r.metadata || {},
            similarity: r.similarity,
          })),
          failed: false,
        }
      } catch {
        return { rows: [], failed: true }
      }
    })(),
    (async (): Promise<{ rows: RetrievedChunk[]; failed: boolean }> => {
      try {
        const { data, error } = await supabase.rpc('keyword_search_chunks', {
          query_text: query,
          filter_project: projectFilter,
          match_count: RAG_KEYWORD_MATCH_COUNT,
          filter_doc_type: docTypeFilter,
        })
        // PostgREST errors come back in `error` (no throw) — treat as a lane failure, not a clean miss.
        if (error) return { rows: [], failed: true }
        return {
          rows: ((data || []) as Array<RetrievedChunk & { rank?: number }>)
            // RPC already applies doc_type; keep this as a defensive belt-and-suspenders
            .filter((r) => !docTypeFilter || r.metadata?.doc_type === docTypeFilter)
            .map((r) => ({
              id: r.id,
              document_id: r.document_id,
              content: r.content,
              metadata: r.metadata || {},
              similarity: r.rank,
            })),
          failed: false,
        }
      } catch {
        return { rows: [], failed: true }
      }
    })(),
  ])

  const vectorResults = vector.rows
  const keywordResults = keyword.rows

  // Merge + dedup by id (vector results take precedence for similarity score)
  const vectorIds = new Set(vectorResults.map((r) => r.id))
  const keywordIds = new Set(keywordResults.map((r) => r.id))
  let overlapCount = 0
  for (const id of vectorIds) if (keywordIds.has(id)) overlapCount++

  const merged = new Map<string, RetrievedChunk>()
  for (const r of [...vectorResults, ...keywordResults]) {
    if (isExcludedFromRetrieval(r.metadata)) continue
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
        vectorFailed: vector.failed,
        keywordFailed: keyword.failed,
        unreviewedUsed: 0,
      },
    }
  }

  // Cohere-rerank the FULL pool (not just top-K) so trust-tier ordering can promote a high-trust chunk
  // Cohere scored modestly — otherwise Cohere's relevance cut would drop it before trust is considered.
  const { chunks: rerankedRaw, degraded } = await rerankChunks(query, pool, pool.length)
  const reranked = rerankedRaw.filter((c) => !isExcludedFromRetrieval(c.metadata))
  const ranked = rankBySourceTrust(reranked).slice(0, RAG_FINAL_TOP_K) as RankedRetrievedChunk[]
  const unreviewedUsed = ranked.filter((c) => isUnreviewedSource(c.metadata)).length

  return {
    ranked,
    diagnostics: {
      vectorCount: vectorResults.length,
      keywordCount: keywordResults.length,
      poolCount: pool.length,
      overlapCount,
      degraded,
      vectorFailed: vector.failed,
      keywordFailed: keyword.failed,
      unreviewedUsed,
    },
  }
}
