/**
 * Fase 4 / WS3-T10 — endorse the head of authority≥90 ∧ approved documents as `source_of_record`
 * (audit C2). Reversible data op. Uses the SAME transactional, optimistic-locked, audit-evented RPC
 * (`apply_document_governance`) the UI "Endorsar como fuente oficial" button uses — one call per doc, so
 * every endorse is logged as a `rag_document_events` row (old classification_source → agent_reviewed),
 * which is also what makes --revert exact.
 *
 * Eligibility (mirrors the SSOT + verificationFromGovernance): status='indexed' ∧ authority_score≥90 ∧
 * review_status='approved' ∧ classification_source NOT already human-validated ∧ NOT 'agent_rejected'.
 *
 * Modes:
 *   node scripts/endorse-source-of-record.mjs            # DRY-RUN: count eligible + show before metrics
 *   node scripts/endorse-source-of-record.mjs --apply [--limit N]   # endorse (optionally only the top N by authority)
 *   node scripts/endorse-source-of-record.mjs --revert [--limit N]  # undo: agent_reviewed→prior, from the endorse events
 *
 * Always asserts the source_of_record distribution BEFORE and AFTER and prints the delta.
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) { console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY'); process.exit(2) }
const sb = createClient(url, key, { auth: { persistSession: false } })

const argv = process.argv.slice(2)
const APPLY = argv.includes('--apply')
const REVERT = argv.includes('--revert')
const limIdx = argv.indexOf('--limit')
const LIMIT = limIdx >= 0 ? parseInt(argv[limIdx + 1], 10) : null
const HUMAN_VALIDATED = ['human', 'agent_reviewed', 'agent_corrected']
const REASON = 'bulk endorse source_of_record head (Fase 4 WS3-T10)'

async function sorMetrics() {
  const { data } = await sb.rpc('knowledge_corpus_health')
  return data?.docs ?? {}
}

async function eligibleDocs() {
  // not-already-official (classification_source not human-validated) + not agent_rejected
  let q = sb.from('rag_documents')
    .select('id, current_version, classification_source, authority_score')
    .eq('status', 'indexed').gte('authority_score', 90).eq('review_status', 'approved')
    .not('classification_source', 'in', `(${[...HUMAN_VALIDATED, 'agent_rejected'].join(',')})`)
    .order('authority_score', { ascending: false }).order('id', { ascending: true })
  if (LIMIT) q = q.limit(LIMIT)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return data ?? []
}

async function main() {
  const before = await sorMetrics()
  console.log(`BEFORE: source_of_record=${before.source_of_record} / eligible=${before.source_of_record_eligible} (pct=${before.source_of_record_pct})`)

  if (REVERT) {
    // pull the latest endorse event per doc to restore the prior classification_source exactly
    const { data: evs, error } = await sb.from('rag_document_events')
      .select('document_id, old_value, created_at').eq('action', 'endorse').eq('reason', REASON)
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    const priorById = new Map()
    for (const e of evs ?? []) if (!priorById.has(e.document_id)) priorById.set(e.document_id, e.old_value)
    const entries = LIMIT ? [...priorById].slice(0, LIMIT) : [...priorById]
    console.log(`REVERT: ${entries.length} docs → restoring prior classification_source`)
    let done = 0
    for (const [id, prior] of entries) {
      const { data: cur } = await sb.from('rag_documents').select('current_version, classification_source').eq('id', id).maybeSingle()
      if (!cur || cur.classification_source !== 'agent_reviewed') continue // only revert ones still agent_reviewed
      const { error: e2 } = await sb.rpc('apply_document_governance', {
        p_doc_id: id, p_patch: { classification_source: prior }, p_expected_version: cur.current_version,
        p_events: [{ document_id: id, action: 'endorse_revert', field: 'classification_source', old_value: 'agent_reviewed', new_value: prior, actor: 'admin:console', reason: 'revert ' + REASON }],
      })
      if (e2) { console.error(`  revert ${id} failed: ${e2.message}`); continue }
      if (++done % 100 === 0) console.log(`  reverted ${done}…`)
    }
    console.log(`reverted ${done}`)
  } else {
    const docs = await eligibleDocs()
    console.log(`ELIGIBLE${LIMIT ? ` (limited ${LIMIT})` : ''}: ${docs.length} docs`)
    if (!APPLY) { console.log('DRY-RUN — pass --apply to endorse.'); console.log(`AFTER (unchanged): source_of_record=${before.source_of_record}`); return }
    let done = 0
    for (const d of docs) {
      const { error } = await sb.rpc('apply_document_governance', {
        p_doc_id: d.id, p_patch: { review_status: 'approved', classification_source: 'agent_reviewed' },
        p_expected_version: d.current_version,
        p_events: [{ document_id: d.id, action: 'endorse', field: 'classification_source', old_value: d.classification_source, new_value: 'agent_reviewed', actor: 'admin:console', reason: REASON }],
      })
      if (error) { console.error(`  endorse ${d.id} failed: ${error.message}`); continue }
      if (++done % 100 === 0) console.log(`  endorsed ${done}/${docs.length}…`)
    }
    console.log(`endorsed ${done}`)
  }

  const after = await sorMetrics()
  console.log(`AFTER:  source_of_record=${after.source_of_record} / eligible=${after.source_of_record_eligible} (pct=${after.source_of_record_pct})`)
  console.log(`DELTA source_of_record: ${(after.source_of_record ?? 0) - (before.source_of_record ?? 0)}`)
}
main().catch((e) => { console.error(e); process.exit(1) })
