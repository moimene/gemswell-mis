// Analyze the ACTIVE needs_review backlog with a STRONG model (Opus by default) and show, per doc, the
// proposed classification (doc_type / authority_tier / lifecycle / confidence) and what the conservative
// SSOT triage rule (triageNeedsReview) would decide — vs the Haiku pass. DRY by default (no writes).
//
// Scope: review_status='needs_review' AND lifecycle<>'superseded' (legacy dedup residue is out of chat
// and never needs triage). After the F6 dedup the effective backlog is ~191 docs (not the 1,476 the
// lifecycle-blind corpus-health metric reports).
//
// Usage:
//   npx tsx scripts/reclassify-needs-review-opus.ts                 # DRY analysis (default model Opus)
//   npx tsx scripts/reclassify-needs-review-opus.ts --model claude-sonnet-4-6
//   npx tsx scripts/reclassify-needs-review-opus.ts --json out.json # also dump per-doc detail
import { config } from 'dotenv'
config({ path: '.env.local' })
import { writeFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { classifyForTriage } from '../src/lib/knowledge/classify'
import { triageNeedsReview } from '../src/lib/knowledge/triage'
import type { AuthorityTier } from '../src/lib/knowledge/contracts'

type NeedReviewDoc = {
  id: string
  title: string | null
  project_id: string | null
  doc_type: string | null
  authority_tier: AuthorityTier | null
  authority_score: number | null
  current_version: number | null
}

type AnalysisRow = {
  id: string
  title: string | null
  project: string | null
  was: { doc_type: string | null; tier: AuthorityTier | null; score: number | null }
  now: { doc_type: string; tier: AuthorityTier; score: number; lifecycle: string; confidence: number }
  decision: string
}

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
const argv = process.argv.slice(2)
const mi = argv.indexOf('--model'); const MODEL = mi >= 0 ? argv[mi + 1] : 'claude-opus-4-8'
const ji = argv.indexOf('--json'); const JSON_OUT = ji >= 0 ? argv[ji + 1] : null
const li = argv.indexOf('--limit'); const LIMIT = li >= 0 ? parseInt(argv[li + 1], 10) : null

async function contentSample(docId: string): Promise<string> {
  const { data } = await sb.from('rag_chunks').select('content').eq('document_id', docId).order('chunk_index', { ascending: true }).limit(6)
  return ((data ?? []) as { content: string | null }[]).map(r => r.content ?? '').join('\n').slice(0, 6000)
}
async function pull(): Promise<NeedReviewDoc[]> {
  const rows: NeedReviewDoc[] = []
  let lastId = '00000000-0000-0000-0000-000000000000'
  for (;;) {
    const { data, error } = await sb.from('rag_documents')
      .select('id, title, project_id, doc_type, authority_tier, authority_score, current_version')
      .eq('review_status', 'needs_review').neq('lifecycle', 'superseded').gt('id', lastId)
      .order('id', { ascending: true }).limit(1000)
    if (error) throw new Error(error.message)
    if (!data || !data.length) break
    const batch = data as NeedReviewDoc[]
    rows.push(...batch); lastId = batch[batch.length - 1].id
    if (data.length < 1000) break
  }
  return LIMIT ? rows.slice(0, LIMIT) : rows
}
const tallyOf = <T,>(arr: T[], f: (x: T) => string | null | undefined) => {
  const m: Record<string, number> = {}
  for (const x of arr) { const k = f(x) ?? '(null)'; m[k] = (m[k] || 0) + 1 }
  return Object.fromEntries(Object.entries(m).sort((a, b) => b[1] - a[1]))
}

async function main() {
  const docs = await pull()
  console.error(`classifying ${docs.length} active needs_review docs with ${MODEL}…`)
  const out: AnalysisRow[] = []
  let approve = 0, keep = 0, failed = 0, typeChanged = 0, otherResolved = 0
  let n = 0
  for (const doc of docs) {
    if (++n % 25 === 0) console.error(`  ${n}/${docs.length}`)
    const sample = await contentSample(doc.id)
    let cls: Awaited<ReturnType<typeof classifyForTriage>>
    try { cls = await classifyForTriage({ title: doc.title ?? '', sample }, anthropic, MODEL) } catch { failed++; continue }
    if (!cls) { failed++; continue }
    const d = triageNeedsReview(
      { doc_type: cls.result.doc_type, authority_tier: cls.result.authority_tier, confidence: cls.result.confidence },
      { authority_tier: doc.authority_tier ?? 'unverified' },
    )
    const isApprove = d.action === 'approve'
    if (isApprove) approve++
    else keep++
    if (cls.result.doc_type !== doc.doc_type) typeChanged++
    if (doc.doc_type === 'other' && cls.result.doc_type !== 'other') otherResolved++
    out.push({ id: doc.id, title: doc.title, project: doc.project_id,
      was: { doc_type: doc.doc_type, tier: doc.authority_tier, score: doc.authority_score },
      now: { doc_type: cls.result.doc_type, tier: cls.result.authority_tier, score: cls.authority_score, lifecycle: cls.result.lifecycle, confidence: cls.result.confidence },
      decision: d.action })
  }
  console.log(JSON.stringify({
    model: MODEL, analyzed: docs.length, classify_failed: failed,
    SSOT_decision: { approve, keep_needs_review: keep },
    doc_type_changed: typeChanged, other_resolved_to_real_type: otherResolved,
    proposed_docType_dist: tallyOf(out, x => x.now.doc_type),
    proposed_tier_dist: tallyOf(out, x => x.now.tier),
    sample_other_resolved: out.filter(x => x.was.doc_type === 'other' && x.now.doc_type !== 'other').slice(0, 12)
      .map(x => ({ title: x.title, project: x.project, now: x.now.doc_type, tier: x.now.tier, conf: x.now.confidence, decision: x.decision })),
  }, null, 2))
  if (JSON_OUT) { writeFileSync(JSON_OUT, JSON.stringify(out, null, 2)); console.error(`wrote ${out.length} rows -> ${JSON_OUT}`) }
}
main().catch((e) => { console.error(e); process.exit(1) })
