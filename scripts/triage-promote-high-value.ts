// AGGRESSIVE triage (operator-chosen policy) — promote high-quality FINAL documents to HIGH AUTHORITY
// automatically (→ source_of_record / "fuente oficial"). A signed contract, escritura pública, audited
// accounts, a final financial model, signed board minutes, … that is NOT a draft becomes executed (90) or
// audited (100), approved + agent_reviewed. Drafts / low-value / low-confidence fall back to the
// conservative rule (never auto-promoted). Uses a stronger analysis model (Sonnet 4.6 default, --opus for
// Opus) with a due-diligence prompt focused on draft-vs-final.
//
// Every change goes through the transactional, optimistic-locked apply_document_governance RPC; the audit
// event 'triage_promote' stores the FULL prior governance state as JSON so --revert is exact.
//
// Usage:
//   npx tsx scripts/triage-promote-high-value.ts [--scope needs_review|low-authority] [--limit N] [--opus]
//   npx tsx scripts/triage-promote-high-value.ts --apply [--scope ...] [--limit N] [--opus]
//   npx tsx scripts/triage-promote-high-value.ts --revert [--limit N]
import { config } from 'dotenv'
config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { classifyForTriage, TRIAGE_DEFAULT_MODEL } from '../src/lib/knowledge/classify'
import { triageAggressive } from '../src/lib/knowledge/triage'
import type { AuthorityTier } from '../src/lib/knowledge/contracts'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

const argv = process.argv.slice(2)
const APPLY = argv.includes('--apply')
const REVERT = argv.includes('--revert')
const MODEL = argv.includes('--opus') ? 'claude-opus-4-8' : TRIAGE_DEFAULT_MODEL
const li = argv.indexOf('--limit'); const LIMIT = li >= 0 ? parseInt(argv[li + 1], 10) : null
const si = argv.indexOf('--scope'); const SCOPE = si >= 0 ? argv[si + 1] : 'needs_review'
const REASON = 'aggressive high-value promotion (Fase 4 WS3)'

async function sor() {
  const { data } = await sb.rpc('knowledge_corpus_health')
  const d = data?.docs ?? {}
  return { needs_review: d.needs_review, approved: d.approved, source_of_record: d.source_of_record }
}

async function contentSample(docId: string): Promise<string> {
  const { data } = await sb.from('rag_chunks').select('content').eq('document_id', docId).order('chunk_index', { ascending: true }).limit(8)
  return (data ?? []).map((c) => c.content as string).join('\n').slice(0, 6000)
}

async function main() {
  console.log(`MODEL: ${MODEL} · SCOPE: ${SCOPE}${LIMIT ? ` · LIMIT ${LIMIT}` : ''}`)
  console.log('BEFORE:', JSON.stringify(await sor()))

  if (REVERT) {
    // OLDEST event per doc = the TRUE pre-promotion baseline (a doc promoted twice would otherwise restore
    // to its intermediate promoted state). Order ascending + keep-first (Ronda 1 finding 3a).
    const { data: evs } = await sb.from('rag_document_events').select('document_id, old_value, created_at')
      .eq('action', 'triage_promote').eq('reason', REASON).order('created_at', { ascending: true })
    const priorById = new Map<string, string>()
    for (const e of evs ?? []) if (!priorById.has(e.document_id as string)) priorById.set(e.document_id as string, e.old_value as string)
    const entries = LIMIT ? [...priorById].slice(0, LIMIT) : [...priorById]
    console.log(`REVERT: ${entries.length} promoted docs → restoring prior governance state`)
    let n = 0
    for (const [id, priorJson] of entries) {
      let prior: Record<string, unknown>
      try { prior = JSON.parse(priorJson) } catch { continue }
      const { data: cur } = await sb.from('rag_documents').select('current_version').eq('id', id).maybeSingle()
      if (!cur) continue
      const { error } = await sb.rpc('apply_document_governance', {
        p_doc_id: id, p_expected_version: cur.current_version,
        p_patch: { review_status: prior.review_status, classification_source: prior.classification_source, authority_tier: prior.authority_tier, authority_score: prior.authority_score },
        p_events: [{ document_id: id, action: 'triage_promote_revert', field: 'governance', old_value: 'promoted', new_value: priorJson, actor: 'admin:console', reason: 'revert ' + REASON }],
      })
      if (!error) { n++; if (n % 100 === 0) console.log(`  reverted ${n}…`) }
    }
    console.log(`reverted ${n}`)
    console.log('AFTER:', JSON.stringify(await sor()))
    return
  }

  // scope → candidate set (paginated by id cursor; PostgREST caps at 1000)
  const tally = { promote: 0, approve: 0, keep: 0, classify_failed: 0 }
  let applied = 0, processed = 0
  let lastId = '00000000-0000-0000-0000-000000000000'
  while (!(LIMIT && processed >= LIMIT)) {
    const pageSize = LIMIT ? Math.min(500, LIMIT - processed) : 500
    let q = sb.from('rag_documents')
      .select('id, title, review_status, authority_tier, authority_score, classification_source, current_version')
      .gt('id', lastId).order('id', { ascending: true }).limit(pageSize)
    if (SCOPE === 'low-authority') {
      // any live, non-rejected doc that is NOT already high authority (<90 or null) → promotion candidate
      q = q.neq('review_status', 'rejected').eq('status', 'indexed').or('authority_score.lt.90,authority_score.is.null')
    } else {
      q = q.eq('review_status', 'needs_review')
    }
    const { data: docs, error } = await q
    if (error) throw new Error(error.message)
    if (!docs || docs.length === 0) break
    for (const doc of docs) {
      lastId = doc.id as string
      processed++
      let decision: ReturnType<typeof triageAggressive> | null = null
      try {
        const sample = await contentSample(doc.id as string)
        const cls = await classifyForTriage({ title: (doc.title as string) ?? '', sample }, anthropic, MODEL)
        if (!cls) { tally.classify_failed++; if (tally.classify_failed <= 3) console.error(`  [parse-miss] ${doc.id}`); continue }
        decision = triageAggressive(
          { doc_type: cls.result.doc_type, authority_tier: cls.result.authority_tier, confidence: cls.result.confidence, lifecycle: cls.result.lifecycle },
          { authority_tier: doc.authority_tier as AuthorityTier },
        )
      } catch (e) { tally.classify_failed++; if (tally.classify_failed <= 3) console.error(`  [threw] ${(e as Error)?.message?.slice(0, 200)}`); continue }
      const isPromotion = decision.authority_score != null
      if (isPromotion) tally.promote++
      else if (decision.action === 'approve') tally.approve++
      else { tally.keep++; continue }

      if (!APPLY) continue
      const prior = JSON.stringify({
        review_status: doc.review_status, classification_source: doc.classification_source,
        authority_tier: doc.authority_tier, authority_score: doc.authority_score,
      })
      const patch: Record<string, unknown> = isPromotion
        ? { review_status: 'approved', classification_source: 'agent_reviewed', authority_tier: decision.authority_tier, authority_score: decision.authority_score }
        : { review_status: 'approved' }
      const action = isPromotion ? 'triage_promote' : 'triage_approve_aggressive'
      const { error: e2 } = await sb.rpc('apply_document_governance', {
        p_doc_id: doc.id, p_patch: patch, p_expected_version: doc.current_version,
        p_events: [{ document_id: doc.id, action, field: 'governance', old_value: prior, new_value: JSON.stringify(patch), actor: 'admin:console', reason: REASON }],
      })
      if (!e2) { applied++; if (applied % 50 === 0) console.log(`  applied ${applied} (promote=${tally.promote})…`) }
      else console.error(`  apply ${doc.id} failed: ${e2.message}`)
    }
  }
  console.log(`DECISIONS over ${processed}: promote=${tally.promote} approve=${tally.approve} keep=${tally.keep} classify_failed=${tally.classify_failed}`)
  if (!APPLY) console.log('DRY-RUN — pass --apply to promote/approve.')
  else console.log(`applied ${applied}`)
  console.log('AFTER:', JSON.stringify(await sor()))
}
main().catch((e) => { console.error(e); process.exit(1) })
