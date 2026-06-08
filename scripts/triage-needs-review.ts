// Fase 4 / WS3-T5 (automated) — triage the needs_review backlog WITHOUT human hours. Re-classifies each
// needs_review document from its actual content (Haiku, the same classifier the ingest uses) and applies
// the SAME governance rule (decideReviewStatus, via the pure triageNeedsReview SSOT). Conservative:
//  - auto-APPROVE only confident, real-doc-type, non-unverified, non-high-authority re-classifications;
//  - high-authority claims (audited/executed/controller) and still-uncertain docs STAY needs_review;
//  - never auto-rejects. Approve sets ONLY review_status='approved' (classification_source stays as-is —
//    honest: this is an agent triage, not human validation; low-authority docs remain 'context' tier).
// Every change goes through the transactional, optimistic-locked, audit-evented apply_document_governance
// RPC (event action 'triage_approve' carries old review_status), so --revert is exact.
//
// Usage:
//   npx tsx scripts/triage-needs-review.ts [--limit N]            # DRY-RUN: classify + tally decisions
//   npx tsx scripts/triage-needs-review.ts --apply [--limit N]    # apply approvals
//   npx tsx scripts/triage-needs-review.ts --revert [--limit N]   # undo: triage-approved → needs_review
import { config } from 'dotenv'
config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { classifyDocument } from '../src/lib/knowledge/classify'
import { triageNeedsReview } from '../src/lib/knowledge/triage'
import type { AuthorityTier } from '../src/lib/knowledge/contracts'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

const argv = process.argv.slice(2)
const APPLY = argv.includes('--apply')
const REVERT = argv.includes('--revert')
const li = argv.indexOf('--limit')
const LIMIT = li >= 0 ? parseInt(argv[li + 1], 10) : null
const REASON = 'automated needs_review triage (Fase 4 WS3-T5)'

async function counts() {
  const nr = await sb.from('rag_documents').select('*', { count: 'exact', head: true }).eq('review_status', 'needs_review')
  const ap = await sb.from('rag_documents').select('*', { count: 'exact', head: true }).eq('review_status', 'approved')
  return { needs_review: nr.count ?? 0, approved: ap.count ?? 0 }
}

async function contentSample(docId: string): Promise<string> {
  const { data } = await sb.from('rag_chunks').select('content').eq('document_id', docId).order('chunk_index', { ascending: true }).limit(6)
  return (data ?? []).map((c) => c.content as string).join('\n').slice(0, 4000)
}

async function main() {
  const before = await counts()
  console.log(`BEFORE: needs_review=${before.needs_review} approved=${before.approved}`)

  if (REVERT) {
    const { data: evs } = await sb.from('rag_document_events').select('document_id').eq('action', 'triage_approve').eq('reason', REASON)
    const ids = [...new Set((evs ?? []).map((e) => e.document_id as string))]
    const todo = LIMIT ? ids.slice(0, LIMIT) : ids
    console.log(`REVERT: ${todo.length} triage-approved docs → needs_review`)
    let n = 0
    for (const id of todo) {
      const { data: cur } = await sb.from('rag_documents').select('current_version, review_status').eq('id', id).maybeSingle()
      if (!cur || cur.review_status !== 'approved') continue
      const { error } = await sb.rpc('apply_document_governance', {
        p_doc_id: id, p_patch: { review_status: 'needs_review' }, p_expected_version: cur.current_version,
        p_events: [{ document_id: id, action: 'triage_revert', field: 'review_status', old_value: 'approved', new_value: 'needs_review', actor: 'admin:console', reason: 'revert ' + REASON }],
      })
      if (!error && ++n % 100 === 0) console.log(`  reverted ${n}…`)
    }
    console.log(`reverted ${n}`)
    const after = await counts(); console.log(`AFTER: needs_review=${after.needs_review} approved=${after.approved}`)
    return
  }

  // Cursor-paginate by id over ALL needs_review docs (PostgREST caps a select at 1000 rows). Ordering by
  // id and advancing the cursor means each doc is processed exactly once even though approving removes it
  // from the needs_review set mid-pass.
  const tally = { approve: 0, keep: 0, classify_failed: 0 }
  let applied = 0
  let processed = 0
  let lastId = '00000000-0000-0000-0000-000000000000' // min uuid (id is a uuid column; '' is not a valid cursor)
  while (!(LIMIT && processed >= LIMIT)) {
    const pageSize = LIMIT ? Math.min(1000, LIMIT - processed) : 1000
    const { data: docs, error } = await sb.from('rag_documents')
      .select('id, title, authority_tier, current_version')
      .eq('review_status', 'needs_review').gt('id', lastId)
      .order('id', { ascending: true }).limit(pageSize)
    if (error) throw new Error(error.message)
    if (!docs || docs.length === 0) break
    for (const doc of docs) {
      lastId = doc.id as string
      processed++
      const sample = await contentSample(doc.id as string)
      let decisionApprove = false
      try {
        const cls = await classifyDocument({ title: (doc.title as string) ?? '', sample, dmsFolder: null }, anthropic)
        if (!cls) { tally.classify_failed++; continue }
        const d = triageNeedsReview(
          { doc_type: cls.result.doc_type, authority_tier: cls.result.authority_tier, confidence: cls.result.confidence },
          { authority_tier: doc.authority_tier as AuthorityTier },
        )
        decisionApprove = d.action === 'approve'
        tally[decisionApprove ? 'approve' : 'keep']++
      } catch {
        tally.classify_failed++
        continue
      }
      if (decisionApprove && APPLY) {
        const { error: e2 } = await sb.rpc('apply_document_governance', {
          p_doc_id: doc.id, p_patch: { review_status: 'approved' }, p_expected_version: doc.current_version,
          p_events: [{ document_id: doc.id, action: 'triage_approve', field: 'review_status', old_value: 'needs_review', new_value: 'approved', actor: 'admin:console', reason: REASON }],
        })
        if (!e2) { applied++; if (applied % 50 === 0) console.log(`  approved ${applied}…`) }
        else console.error(`  apply ${doc.id} failed: ${e2.message}`)
      }
    }
  }
  console.log(`DECISIONS over ${processed} docs: approve=${tally.approve} keep=${tally.keep} classify_failed=${tally.classify_failed}`)
  if (!APPLY) console.log('DRY-RUN — pass --apply to approve the auto-approvable ones.')
  else console.log(`applied ${applied} approvals`)
  const after = await counts(); console.log(`AFTER: needs_review=${after.needs_review} approved=${after.approved}`)
}
main().catch((e) => { console.error(e); process.exit(1) })
