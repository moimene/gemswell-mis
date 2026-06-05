import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'
import { computeGovernanceAction } from '../src/lib/knowledge/governance-actions'
import type { DocGovernanceState } from '../src/lib/knowledge/contracts'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
if (!url || !key) { console.error('Missing NEXT_PUBLIC_SUPABASE_URL / key env'); process.exit(1) }
const sb = createClient(url, key)
const assert = (c: boolean, m: string) => { if (!c) throw new Error('FAIL: ' + m); console.log('  ok:', m) }

const GOV_COLS = 'review_status, classification_source, status, authority_score, authority_tier, current_version, supersedes_document_id'

async function applyAction(id: string, current: DocGovernanceState, action: Parameters<typeof computeGovernanceAction>[0]['action'], extra: Record<string, unknown> = {}) {
  const r = computeGovernanceAction({ action, documentId: id, current, actor: 'verify:script', ...extra })
  if (Object.keys(r.patch).length) await sb.from('rag_documents').update(r.patch).eq('id', id)
  if (r.related) await sb.from('rag_documents').update(r.related.patch).eq('id', r.related.id)
  if (r.events.length) await sb.from('rag_document_events').insert(r.events)
  return r
}

async function main() {
  const beforeCount = (await sb.from('rag_documents').select('id', { count: 'exact', head: true })).count ?? -1
  console.log('corpus before:', beforeCount)

  const ins = await sb.from('rag_documents').insert({
    title: 'ZZZ verify-gestor-b TESTDOC', status: 'indexed', review_status: 'needs_review',
    classification_source: 'agent_auto', authority_score: 95, authority_tier: 'audited',
    doc_type: 'monitoring', project_id: 'MAD', current_version: 1, chunk_count: 1,
  }).select('id').single()
  if (ins.error) throw new Error('insert TESTDOC failed: ' + ins.error.message)
  const id = ins.data!.id
  const oldIns = await sb.from('rag_documents').insert({
    title: 'ZZZ verify OLD', status: 'indexed', review_status: 'approved', classification_source: 'rule',
    authority_score: 80, authority_tier: 'controller', current_version: 1,
  }).select('id').single()
  if (oldIns.error) throw new Error('insert OLD failed: ' + oldIns.error.message)
  const oldId = oldIns.data!.id
  await sb.from('rag_chunks').insert({ document_id: id, chunk_index: 1, content: 'second part' })
  await sb.from('rag_chunks').insert({ document_id: id, chunk_index: 0, content: 'first part' })

  const cur = async (): Promise<DocGovernanceState> => {
    const r = await sb.from('rag_documents').select(GOV_COLS).eq('id', id).single()
    return r.data as unknown as DocGovernanceState
  }

  try {
    // 1. approve → agent_reviewed (source_of_record eligible for authority>=90)
    await applyAction(id, await cur(), 'approve')
    let s = await cur()
    assert(s.review_status === 'approved' && s.classification_source === 'agent_reviewed',
      'approve sets approved + agent_reviewed (source_of_record eligible)')

    // 4. reclassify doc_type → agent_corrected, parent-level (no chunk writes)
    await applyAction(id, await cur(), 'reclassify', { fields: { doc_type: 'legal' } })
    s = await cur()
    const dt = (await sb.from('rag_documents').select('doc_type').eq('id', id).single()).data!.doc_type
    assert(dt === 'legal' && s.classification_source === 'agent_corrected', 'reclassify doc_type → legal + agent_corrected')

    // 3. retire then restore
    await applyAction(id, await cur(), 'retire'); assert((await cur()).status === 'retired', 'retire → status retired')
    await applyAction(id, await cur(), 'restore'); assert((await cur()).status === 'indexed', 'restore → status indexed')

    // 5. supersede the OLD doc
    const oldState = (await sb.from('rag_documents').select(GOV_COLS).eq('id', oldId).single()).data as unknown as DocGovernanceState
    await applyAction(id, await cur(), 'supersede', { supersede: { oldId, oldDoc: oldState } })
    assert((await sb.from('rag_documents').select('status').eq('id', oldId).single()).data!.status === 'retired', 'supersede retires OLD doc')
    assert((await cur()).supersedes_document_id === oldId, 'supersede links new → old')

    // 2. reject → rejected
    await applyAction(id, await cur(), 'reject', { reason: 'cleanup' })
    assert((await cur()).review_status === 'rejected', 'reject → rejected')

    const evCount = (await sb.from('rag_document_events').select('id', { count: 'exact', head: true }).eq('document_id', id)).count ?? 0
    assert(evCount >= 5, `audit events recorded on TESTDOC (${evCount})`)

    console.log('\nALL VERIFY CHECKS PASSED')
  } finally {
    await sb.from('rag_document_events').delete().in('document_id', [id, oldId])
    await sb.from('rag_chunks').delete().eq('document_id', id)
    await sb.from('rag_documents').delete().in('id', [id, oldId])
    const afterCount = (await sb.from('rag_documents').select('id', { count: 'exact', head: true })).count ?? -1
    console.log('cleaned up test rows; corpus after:', afterCount)
    if (afterCount !== beforeCount) console.error(`WARNING: corpus count changed ${beforeCount} → ${afterCount}`)
  }
}
main().catch(e => { console.error(e); process.exit(1) })
