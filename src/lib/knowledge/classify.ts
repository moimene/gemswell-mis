import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { scoreToTier, tierToScore } from '@/lib/knowledge/authority'
import type { AuthorityTier, ReviewStatus } from '@/lib/knowledge/contracts'
import { DOC_TYPES } from '@/lib/knowledge/contracts'

export type ChunkMetaLite = {
  authority?: number | string | null
  doc_type?: string | null
  project_id?: string | null
  period?: string | null
  dms_folder?: string | null
}

export type LiftedLabels = {
  authority_score: number | null
  authority_tier: AuthorityTier
  doc_type: string | null
  project_id: string | null
  period: string | null
  dms_folder: string | null
  confidence: number
}

function mode(values: (string | null | undefined)[]): { value: string | null; share: number } {
  const counts = new Map<string, number>()
  let total = 0
  for (const v of values) {
    if (!v) continue
    counts.set(v, (counts.get(v) ?? 0) + 1)
    total++
  }
  if (total === 0) return { value: null, share: 0 }
  let best: string | null = null
  let bestN = 0
  for (const [v, n] of counts) if (n > bestN) { best = v; bestN = n }
  return { value: best, share: bestN / total }
}

export function liftUpFromChunks(metas: ChunkMetaLite[]): LiftedLabels {
  const authorities = metas
    .map(m => (m.authority == null ? NaN : Number(m.authority)))
    .filter(n => Number.isFinite(n)) as number[]
  const authority_score = authorities.length ? Math.max(...authorities) : null
  const docTypeMode = mode(metas.map(m => m.doc_type))
  const projectMode = mode(metas.map(m => m.project_id))
  const periodMode = mode(metas.map(m => m.period))
  const folderMode = mode(metas.map(m => m.dms_folder))
  return {
    authority_score,
    authority_tier: authority_score == null ? 'unverified' : scoreToTier(authority_score),
    doc_type: docTypeMode.value,
    project_id: projectMode.value,
    period: periodMode.value,
    dms_folder: folderMode.value,
    confidence: docTypeMode.share,
  }
}

export function decideReviewStatus(labels: {
  doc_type: string | null
  authority_tier: AuthorityTier
  confidence: number
}): ReviewStatus {
  const classified =
    labels.confidence >= 0.5 &&
    !!labels.doc_type &&
    labels.doc_type !== 'other' &&
    labels.authority_tier !== 'unverified'
  return classified ? 'approved' : 'needs_review'
}

// ─── Haiku document classifier ───────────────────────────────────────────────

const TIERS = ['audited','executed','controller','board_pack','dd_memo','internal','narrative','unverified'] as const
const LIFECYCLES = ['draft','signed','executed','filed','audited','working_paper','superseded','unknown'] as const

export const classifyResultSchema = z.object({
  doc_type: z.enum(DOC_TYPES),
  authority_tier: z.enum(TIERS),
  lifecycle: z.enum(LIFECYCLES).default('unknown'),
  period: z.string().nullable().default(null),
  currency: z.enum(['EUR','GBP','USD']).nullable().default(null),
  topics: z.array(z.string()).default([]),
  summary: z.string().default(''),
  confidence: z.number().min(0).max(1),
})
export type ClassifyResult = z.infer<typeof classifyResultSchema>

export function buildClassifyPrompt(doc: { title: string; sample: string; dmsFolder?: string | null }): string {
  return [
    'Clasifica este documento financiero/legal de un grupo de parques de olas (Gemswell).',
    `Título: ${doc.title}`,
    doc.dmsFolder ? `Carpeta DMS: ${doc.dmsFolder}` : '',
    `Extracto:\n${doc.sample.slice(0, 4000)}`,
    '',
    'Responde SOLO con un objeto JSON con estas claves:',
    `doc_type (${DOC_TYPES.join('|')}), authority_tier (${TIERS.join('|')}), lifecycle (${LIFECYCLES.join('|')}), period (string|null), currency (EUR|GBP|USD|null), topics (string[]), summary (1 frase), confidence (0..1).`,
  ].filter(Boolean).join('\n')
}

export function parseClassifyResponse(text: string): ClassifyResult | null {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return null
  try {
    const parsed = classifyResultSchema.safeParse(JSON.parse(match[0]))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

const HAIKU_MODEL = 'claude-haiku-4-5-20251001'

export async function classifyDocument(
  doc: { title: string; sample: string; dmsFolder?: string | null },
  anthropic: Anthropic
): Promise<{ result: ClassifyResult; authority_score: number } | null> {
  const resp = await anthropic.messages.create({
    model: HAIKU_MODEL,
    max_tokens: 512,
    temperature: 0,
    messages: [{ role: 'user', content: buildClassifyPrompt(doc) }],
  })
  const text = resp.content.find(b => b.type === 'text')?.text ?? ''
  const result = parseClassifyResponse(text)
  if (!result) return null
  return { result, authority_score: tierToScore(result.authority_tier) }
}
