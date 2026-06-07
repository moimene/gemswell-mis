// scripts/eval/resolve-ids.ts — READ-ONLY resolver for doc-ID pinning (WS6-T2, honest precision+recall).
//
// For every documentary golden case that has title hints but is NOT yet pinned (ground_truth.expected_doc_ids),
// list the candidate rag_documents that match the title substrings so a HUMAN can pin the canonical id(s)
// into golden.json. It NEVER writes / auto-pins — a superseded or duplicate doc must not silently become
// ground truth. Superseded/rejected candidates are flagged ⛔ so they are excluded.
//
// Usage: npx tsx scripts/eval/resolve-ids.ts [--all]   (--all also re-lists already-pinned cases)
import { getSupabase, loadGolden } from './_harness'

async function main() {
  const showAll = process.argv.includes('--all')
  const sb = getSupabase()
  const golden = loadGolden()
  const docCases = golden.filter((g) => g.expected_kind === 'documentary' && g.ground_truth?.titles?.length)

  console.log(`\n=== DOC-ID RESOLVER — ${docCases.length} documentary cases ===`)
  console.log('Pin canonical id(s) into golden.json -> ground_truth.expected_doc_ids. EXCLUDE ⛔ rows.\n')

  let pinnedCount = 0
  for (const g of docCases) {
    const already = g.ground_truth?.expected_doc_ids?.length ?? 0
    if (already) pinnedCount++
    if (already && !showAll) { console.log(`✓ ${g.id} — already pinned (${already})`); continue }

    console.log(`\n── ${g.id}  [${g.lang}/${g.category}]  ${g.question.slice(0, 84)}`)
    const seen = new Set<string>()
    for (const term of g.ground_truth!.titles!) {
      const { data, error } = await sb
        .from('rag_documents')
        .select('id, title, project_id, doc_type, authority_score, review_status, lifecycle, classification_source')
        .ilike('title', `%${term}%`)
        .eq('status', 'indexed')
        .limit(12)
      if (error) { console.log(`   ! "${term}": ${error.message}`); continue }
      for (const d of data || []) {
        if (seen.has(d.id as string)) continue
        seen.add(d.id as string)
        // ⛔ = excluded from retrieval by sql/019 + isExcludedFromRetrieval — must NOT be pinned as ground truth.
        const flag = d.lifecycle === 'superseded' ? ' ⛔SUPERSEDED'
          : d.review_status === 'rejected' ? ' ⛔REJECTED'
          : d.classification_source === 'agent_rejected' ? ' ⛔AGENT-REJECTED'
          : ''
        console.log(`   ${d.id}  [${d.project_id}/${d.doc_type}/a${d.authority_score}/${d.review_status}]${flag}  ${String(d.title ?? '').slice(0, 68)}`)
      }
    }
    if (seen.size === 0) console.log('   (no title-substring candidates — refine the title hint or pin manually)')
  }
  console.log(`\n${pinnedCount}/${docCases.length} documentary cases pinned. Copy the right UUIDs into golden.json, then re-run run-retrieval.ts.\n`)
}

main().catch((e) => { console.error(e); process.exit(1) })
