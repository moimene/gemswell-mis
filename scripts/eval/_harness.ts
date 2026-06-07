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

export const hitAtK = (rank: number, k: number): boolean => rank > 0 && rank <= k
export const mean = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
export const pct = (n: number, d: number): string => (d === 0 ? ' n/a' : `${((n / d) * 100).toFixed(0)}%`)
export const pad = (s: string | number, n: number): string => String(s).padEnd(n)
export const padL = (s: string | number, n: number): string => String(s).padStart(n)
