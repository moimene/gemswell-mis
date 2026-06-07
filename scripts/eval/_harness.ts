// Shared helpers for the chat-quality evaluation harness.
// Loads .env.local (so the real Gemini/Cohere/Supabase keys are present) BEFORE anything that reads
// env. Provides a service-role Supabase client that mirrors the production createApiClient() path.
import { config } from 'dotenv'
import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
config({ path: resolve(process.cwd(), '.env.local') })

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export function getSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Missing SUPABASE env (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export type GroundTruth = {
  titles?: string[]
  /** Canonical rag_documents.id UUIDs, HUMAN-pinned via resolve-ids.ts (never auto-pinned — avoids
   *  enshrining a superseded/duplicate doc as ground truth). When present, retrieval is scored by id
   *  (honest precision AND recall) instead of the optimistic title-substring match. */
  expected_doc_ids?: string[]
  project_id?: string | null
  doc_type?: string | null
  must_contain?: string[]
  tool?: string
}
export type Golden = {
  id: string
  question: string
  lang: 'es' | 'en'
  category: string
  expected_kind: 'documentary' | 'structured' | 'abstain' | 'ambiguous'
  ground_truth?: GroundTruth
  scoped_filter?: { project_id?: string | null; doc_type?: string | null }
  notes?: string
}

export function loadGolden(path = resolve(process.cwd(), 'scripts/eval/golden.json')): Golden[] {
  return JSON.parse(readFileSync(path, 'utf8')) as Golden[]
}

export type DocMeta = {
  id: string
  title: string | null
  project_id: string | null
  doc_type: string | null
  authority_score: number | null
  review_status: string | null
}

/** Batch-resolve document metadata for retrieved ids, memoised across the run. */
export async function resolveDocMeta(sb: SupabaseClient, ids: string[], cache: Map<string, DocMeta>): Promise<void> {
  const missing = [...new Set(ids)].filter((id) => id && !cache.has(id))
  for (let i = 0; i < missing.length; i += 200) {
    const slice = missing.slice(i, i + 200)
    const { data, error } = await sb
      .from('rag_documents')
      .select('id, title, project_id, doc_type, authority_score, review_status')
      .in('id', slice)
    if (error) throw new Error('resolveDocMeta: ' + error.message)
    for (const d of data || []) cache.set(d.id as string, d as DocMeta)
  }
}

export function titleMatches(retrievedTitle: string | null | undefined, expected: string[] | undefined): boolean {
  if (!retrievedTitle || !expected?.length) return false
  const t = retrievedTitle.toLowerCase()
  return expected.some((e) => t.includes(e.toLowerCase()))
}

/** 1-based rank of the first retrieved doc whose title matches an expected substring; 0 if none. */
export function firstMatchRank(rankedTitles: (string | null | undefined)[], expected: string[] | undefined): number {
  for (let i = 0; i < rankedTitles.length; i++) {
    if (titleMatches(rankedTitles[i], expected)) return i + 1
  }
  return 0
}

/** 1-based rank of the first retrieved doc whose id is in the pinned expected set; 0 if none/unpinned. */
export function firstMatchRankById(rankedDocIds: (string | null | undefined)[], expectedIds: string[] | undefined): number {
  if (!expectedIds?.length) return 0
  const want = new Set(expectedIds)
  for (let i = 0; i < rankedDocIds.length; i++) {
    const id = rankedDocIds[i]
    if (id && want.has(id)) return i + 1
  }
  return 0
}

/** precision@k = fraction of the top-k retrieved docs that are in the pinned expected set. Null if unpinned. */
export function precisionAtK(rankedDocIds: (string | null | undefined)[], expectedIds: string[] | undefined, k: number): number | null {
  if (!expectedIds?.length) return null
  const want = new Set(expectedIds)
  // Standard precision@k: relevant-in-top-k / k. Dividing by |retrieved| would inflate precision on a
  // sparse pool and read a pool-shrinking tuning change as a precision GAIN. (adversarial review)
  const hits = rankedDocIds.slice(0, k).filter((id) => id && want.has(id)).length
  return hits / k
}

/** How a documentary question's ground truth is scored — id (pinned, honest) > title (substring, optimistic). */
export function matchedBy(g: { ground_truth?: GroundTruth }): 'id' | 'title' | 'none' {
  if (g.ground_truth?.expected_doc_ids?.length) return 'id'
  if (g.ground_truth?.titles?.length) return 'title'
  return 'none'
}

/**
 * Score a documentary question's first-hit rank. A PINNED case (expected_doc_ids) is scored by id ONLY —
 * it MUST NOT fall back to title, because a same-title sibling would report a false hit and silently
 * inflate recall on exactly the cases pinning exists to make honest (e.g. 10 docs share "sh01"). Only an
 * UNPINNED case uses the optimistic title substring. Keeps `rank` and `scoredBy` consistent. (adversarial review)
 */
export function scoreDocumentaryRank(
  g: { ground_truth?: GroundTruth },
  rankedDocIds: (string | null | undefined)[],
  rankedTitles: (string | null | undefined)[],
): { rank: number; scoredBy: 'id' | 'title' | 'none' } {
  const ids = g.ground_truth?.expected_doc_ids
  if (ids?.length) return { rank: firstMatchRankById(rankedDocIds, ids), scoredBy: 'id' }
  if (g.ground_truth?.titles?.length) return { rank: firstMatchRank(rankedTitles, g.ground_truth.titles), scoredBy: 'title' }
  return { rank: 0, scoredBy: 'none' }
}

export const hitAtK = (rank: number, k: number): boolean => rank > 0 && rank <= k
export const mean = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
export const pct = (n: number, d: number): string => (d === 0 ? ' n/a' : `${((n / d) * 100).toFixed(0)}%`)
export const pad = (s: string | number, n: number): string => String(s).padEnd(n)
export const padL = (s: string | number, n: number): string => String(s).padStart(n)
