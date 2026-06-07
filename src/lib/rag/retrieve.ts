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

// Fase 2 (WS1) — hybrid fusion + precision floor. Defaults reproduce the CURRENT behavior
// (vector_first dedup, no floor), so landing this is a no-op until the env flags are flipped — the
// flag-flip is A/B-gated against the ws1-base baseline and adversarially reviewed before going live.
export const RAG_FUSION_MODE: 'rrf' | 'vector_first' = process.env.RAG_FUSION_MODE === 'rrf' ? 'rrf' : 'vector_first'
export const RAG_RRF_K = Number(process.env.RAG_RRF_K || '60')
export const RAG_RRF_W_VECTOR = Number(process.env.RAG_RRF_W_VECTOR || '1')
export const RAG_RRF_W_KEYWORD = Number(process.env.RAG_RRF_W_KEYWORD || '1')
export const RAG_RELEVANCE_FLOOR = Number(process.env.RAG_RELEVANCE_FLOOR || '0')

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

export type FusionConfig = { mode: 'rrf' | 'vector_first'; k: number; wVector: number; wKeyword: number }
export type FusedChunk = RetrievedChunk & { fusedScore?: number }

/**
 * Merge the vector + keyword lanes into a deduped pool (excluded sources removed). In 'rrf' mode each
 * chunk carries a Reciprocal Rank Fusion score — a chunk found by BOTH lanes gets the additive agreement
 * boost (the precision signal the old vector-first dedup threw away, audit A3) and the pool is ordered by
 * it; 'vector_first' preserves the legacy order. The pool is still Cohere-reranked downstream, so RRF most
 * affects pool inclusion + the DEGRADED (Cohere-down) ordering, which now uses fusedScore (scale-free).
 */
export function fusePool(
  vectorResults: RetrievedChunk[],
  keywordResults: RetrievedChunk[],
  config: FusionConfig,
): { pool: FusedChunk[]; overlapCount: number } {
  const vRank = new Map<string, number>()
  vectorResults.forEach((r, i) => { if (!vRank.has(r.id)) vRank.set(r.id, i + 1) })
  const kRank = new Map<string, number>()
  keywordResults.forEach((r, i) => { if (!kRank.has(r.id)) kRank.set(r.id, i + 1) })
  let overlapCount = 0
  for (const id of vRank.keys()) if (kRank.has(id)) overlapCount++

  const merged = new Map<string, FusedChunk>()
  for (const r of [...vectorResults, ...keywordResults]) {
    if (isExcludedFromRetrieval(r.metadata)) continue
    if (merged.has(r.id)) continue
    const vr = vRank.get(r.id)
    const kr = kRank.get(r.id)
    const fusedScore = (vr ? config.wVector / (config.k + vr) : 0) + (kr ? config.wKeyword / (config.k + kr) : 0)
    merged.set(r.id, { ...r, fusedScore })
  }
  const pool = Array.from(merged.values())
  if (config.mode === 'rrf') pool.sort((a, b) => (b.fusedScore ?? 0) - (a.fusedScore ?? 0))
  return { pool, overlapCount }
}

/**
 * Drop chunks whose Cohere relevance is below `floor` (precision gate, WS1-T3). NEVER empties a non-empty
 * set — if everything is below the floor it keeps the single most-relevant chunk so the chat still has its
 * best evidence. `floor <= 0` is a no-op (recall-first default).
 */
export function applyRelevanceFloor<T extends { relevanceScore?: number }>(chunks: T[], floor: number): T[] {
  if (!(floor > 0)) return chunks
  const above = chunks.filter((c) => (c.relevanceScore ?? 0) >= floor)
  if (above.length > 0) return above
  const best = chunks.slice().sort((a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0))[0]
  return best ? [best] : []
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

  // Merge the two lanes into a deduped, excluded-filtered pool (RRF or legacy vector-first, env-gated).
  const { pool, overlapCount } = fusePool(vectorResults, keywordResults, {
    mode: RAG_FUSION_MODE,
    k: RAG_RRF_K,
    wVector: RAG_RRF_W_VECTOR,
    wKeyword: RAG_RRF_W_KEYWORD,
  })
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
  // Precision floor on the Cohere relevance (WS1-T3) — only on the trustworthy (non-degraded) path,
  // since degraded scores are normalised approximations, not Cohere relevance.
  const floored = degraded ? reranked : applyRelevanceFloor(reranked, RAG_RELEVANCE_FLOOR)
  const ranked = rankBySourceTrust(floored).slice(0, RAG_FINAL_TOP_K) as RankedRetrievedChunk[]
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
