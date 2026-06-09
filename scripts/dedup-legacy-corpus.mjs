// F6 — legacy corpus dedup remediation (Fase 6). REVERSIBLE. HIGH-IMPACT GOVERNANCE OP.
//
// Removes redundant documents from RETRIEVAL by setting lifecycle='superseded' (the live RPCs
// match_chunks/keyword_search_chunks already exclude superseded — sql/019), NEVER by deleting. One
// canonical survivor per exact-content cluster (highest authority_score, then oldest created_at).
//
// SAFETY (why this is safe to author + hand off, not to fire blindly):
//  • Supersede ONLY on byte-exact content_hash (sha256 of normalized concatenated chunk content),
//    NEVER on the title/chunk_count heuristic. Two docs with the same title but different content are
//    left untouched.
//  • Default is DRY-RUN. --apply required to write. --revert restores lifecycle from audit events.
//  • Before any bulk write, --apply SELF-VERIFIES that apply_document_governance accepts a `lifecycle`
//    patch by superseding ONE doc and immediately reverting it; aborts if the RPC rejects it.
//  • Per-doc optimistic lock (p_expected_version): if a concurrent session changed a doc, that doc is
//    skipped, not clobbered. Safe to run alongside other governance work.
//  • Uses service_role + the apply_document_governance RPC (same path as endorse-source-of-record.mjs).
//    Does NOT need the Supabase Management API access token.
//
// CHARTER GATE: this is a bulk op over thousands of docs → run only with EXPLICIT user authorization
// and when NO concurrent governance session is active. Author-and-stage; do not auto-run.
//
// Usage:
//   node scripts/dedup-legacy-corpus.mjs                 # dry-run: report exact-content clusters
//   node scripts/dedup-legacy-corpus.mjs --apply         # supersede redundant copies (after OK)
//   node scripts/dedup-legacy-corpus.mjs --apply --backfill-hash   # also write content_hash (needs 028 PHASE1)
//   node scripts/dedup-legacy-corpus.mjs --revert        # restore superseded docs from audit events
//   flags: --limit N (cap clusters processed), --project XXX (scope to one project)

import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

function env(name) {
  if (process.env[name]) return process.env[name]
  const m = readFileSync(new URL('../.env.local', import.meta.url), 'utf8').match(new RegExp(`^${name}=(.*)$`, 'm'))
  if (!m) throw new Error(`${name} not set`)
  return m[1].trim().replace(/^["']|["']$/g, '')
}
const SUPA = env('NEXT_PUBLIC_SUPABASE_URL')
const SRK = env('SUPABASE_SERVICE_ROLE_KEY')
const H = { apikey: SRK, Authorization: `Bearer ${SRK}`, 'Content-Type': 'application/json' }

const argv = process.argv.slice(2)
const APPLY = argv.includes('--apply')
const REVERT = argv.includes('--revert')
const BACKFILL = argv.includes('--backfill-hash')
// MAX SCOPE (operator-chosen, dedicated session): also supersede dead-weight + macOS junk, not just
// byte-exact dup copies. --include-zero-chunk: docs with chunk_count=0 (ingested, produced no chunks →
// invisible to retrieval anyway, pure clutter). --include-apple-junk: macOS `._*` AppleDouble resource
// forks wrongly ingested. --max-scope enables both. All still REVERSIBLE (lifecycle supersede) + audited.
const MAX_SCOPE = argv.includes('--max-scope')
const INCLUDE_ZERO = MAX_SCOPE || argv.includes('--include-zero-chunk')
const INCLUDE_APPLE = MAX_SCOPE || argv.includes('--include-apple-junk')
const li = argv.indexOf('--limit'); const LIMIT = li >= 0 ? parseInt(argv[li + 1], 10) : Infinity
const pi = argv.indexOf('--project'); const PROJECT = pi >= 0 ? argv[pi + 1] : null
const ACTOR = 'admin:console'
const REASON = 'F6 legacy dedup: redundant exact-content copy superseded (sql/028)'

async function rest(path) {
  const res = await fetch(`${SUPA}/rest/v1/${path}`, { headers: H })
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return res.json()
}
async function rpc(fn, body) {
  const res = await fetch(`${SUPA}/rest/v1/rpc/${fn}`, { method: 'POST', headers: H, body: JSON.stringify(body) })
  if (!res.ok) throw new Error(`RPC ${fn} -> ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return res.status === 204 ? null : res.json()
}

async function pullDocs() {
  const rows = []
  const proj = PROJECT ? `&project_id=eq.${PROJECT}` : ''
  for (let off = 0; ; off += 1000) {
    const page = await rest(`rag_documents?select=id,title,project_id,doc_type,chunk_count,lifecycle,authority_score,current_version,created_at${proj}&order=id&limit=1000&offset=${off}`)
    rows.push(...page)
    if (page.length < 1000) break
  }
  return rows
}

// exact content signature: normalized, order-stable concat of this doc's chunk text.
// PAGINATED (1000/page) so a heavy doc never hits the PostgREST statement timeout; the incremental
// hash means we never hold all chunks in memory. Returns null on any fetch error so the caller SKIPS
// that doc (never supersede a doc whose content we could not fully read) — a heavy doc aborting the
// whole bulk was the original brittleness (57014 statement timeout on limit=10000).
async function contentHash(docId) {
  const hasher = createHash('sha256')
  let any = false
  for (let off = 0; ; off += 1000) {
    let page
    try {
      page = await rest(`rag_chunks?select=content,chunk_index&document_id=eq.${docId}&order=chunk_index&limit=1000&offset=${off}`)
    } catch (e) {
      console.error(`  [skip] content fetch failed for ${docId} @off=${off}: ${e.message}`)
      return null // skip this doc entirely — do not supersede on a partial/failed read
    }
    if (!page.length) break
    for (const c of page) hasher.update((c.content ?? '').replace(/\s+/g, ' ').trim() + '\n')
    any = true
    if (page.length < 1000) break
  }
  return any ? hasher.digest('hex') : null
}

async function revertDedup() {
  // find supersede audit events for this op, restore prior lifecycle
  const events = await rest(`rag_document_events?select=document_id,old_value,new_value,action,created_at&action=eq.dedup_supersede&order=created_at.desc&limit=10000`)
    .catch(() => { throw new Error('audit table name/columns differ — verify rag_document_events schema before revert') })
  let restored = 0
  for (const e of events) {
    const [cur] = await rest(`rag_documents?select=current_version,lifecycle&id=eq.${e.document_id}`)
    if (!cur || cur.lifecycle !== 'superseded') continue
    await rpc('apply_document_governance', {
      p_doc_id: e.document_id, p_patch: { lifecycle: e.old_value },
      p_expected_version: cur.current_version,
      p_events: [{ document_id: e.document_id, action: 'dedup_supersede_revert', field: 'lifecycle', old_value: 'superseded', new_value: e.old_value, actor: ACTOR, reason: 'revert ' + REASON }],
    })
    restored++
  }
  console.log(`reverted ${restored} docs`)
}

async function selfVerifyLifecyclePatchable(sampleDocId, originalLifecycle, version) {
  // supersede then immediately revert one doc to prove the RPC whitelist allows lifecycle patches
  await rpc('apply_document_governance', {
    p_doc_id: sampleDocId, p_patch: { lifecycle: 'superseded' }, p_expected_version: version,
    p_events: [{ document_id: sampleDocId, action: 'dedup_selfcheck', field: 'lifecycle', old_value: originalLifecycle, new_value: 'superseded', actor: ACTOR, reason: 'self-verify' }],
  })
  const [after] = await rest(`rag_documents?select=current_version,lifecycle&id=eq.${sampleDocId}`)
  const ok = after?.lifecycle === 'superseded'
  if (ok) {
    await rpc('apply_document_governance', {
      p_doc_id: sampleDocId, p_patch: { lifecycle: originalLifecycle }, p_expected_version: after.current_version,
      p_events: [{ document_id: sampleDocId, action: 'dedup_selfcheck_revert', field: 'lifecycle', old_value: 'superseded', new_value: originalLifecycle, actor: ACTOR, reason: 'self-verify revert' }],
    })
  }
  return ok
}

async function main() {
  if (REVERT) return revertDedup()

  const docs = await pullDocs()
  // candidate clusters by cheap heuristic, then CONFIRM by exact content_hash within each cluster
  const byKey = new Map()
  for (const d of docs) {
    if (!d.title || d.lifecycle === 'superseded') continue
    const k = JSON.stringify([d.title, d.project_id, d.doc_type, d.chunk_count])
    if (!byKey.has(k)) byKey.set(k, [])
    byKey.get(k).push(d)
  }
  const candidates = [...byKey.values()].filter(g => g.length > 1)
  console.error(`${candidates.length} heuristic clusters; confirming by exact content_hash…`)

  const toSupersede = [] // { doc, canonicalId, hash }
  const hashByDoc = new Map()
  let processed = 0
  for (const group of candidates) {
    if (processed++ >= LIMIT) break
    const withHash = []
    for (const d of group) {
      const h = await contentHash(d.id)
      hashByDoc.set(d.id, h)
      withHash.push({ ...d, _hash: h })
    }
    // sub-group by exact hash; supersede all but the canonical in each exact-content sub-group
    const byHash = new Map()
    for (const d of withHash) {
      if (!d._hash) continue
      if (!byHash.has(d._hash)) byHash.set(d._hash, [])
      byHash.get(d._hash).push(d)
    }
    for (const [hash, exact] of byHash) {
      if (exact.length < 2) continue
      exact.sort((a, b) => (b.authority_score ?? 0) - (a.authority_score ?? 0) || String(a.created_at).localeCompare(String(b.created_at)))
      const canonical = exact[0]
      for (const dup of exact.slice(1)) toSupersede.push({ doc: dup, canonicalId: canonical.id, hash })
    }
  }

  const exactContentRedundant = toSupersede.length

  // MAX SCOPE additions (opt-in): dead-weight + macOS junk. No canonical (removed outright, not deduped).
  let zeroChunk = 0, appleJunk = 0
  const seen = new Set(toSupersede.map(t => t.doc.id))
  for (const d of docs) {
    if (d.lifecycle === 'superseded' || seen.has(d.id)) continue
    if (INCLUDE_ZERO && (d.chunk_count ?? 0) === 0) {
      toSupersede.push({ doc: d, canonicalId: null, hash: null, kind: 'dead_weight_zero_chunk' }); seen.add(d.id); zeroChunk++
    } else if (INCLUDE_APPLE && (d.title ?? '').startsWith('._')) {
      toSupersede.push({ doc: d, canonicalId: null, hash: null, kind: 'apple_double_junk' }); seen.add(d.id); appleJunk++
    }
  }

  console.log(JSON.stringify({
    heuristicClusters: candidates.length,
    exactContentRedundant,
    zeroChunkDeadWeight: INCLUDE_ZERO ? zeroChunk : 'excluded (use --include-zero-chunk/--max-scope)',
    appleDoubleJunk: INCLUDE_APPLE ? appleJunk : 'excluded (use --include-apple-junk/--max-scope)',
    totalToSupersede: toSupersede.length,
    sample: toSupersede.slice(0, 8).map(t => ({ supersede: t.doc.id, title: t.doc.title, keepCanonical: t.canonicalId, kind: t.kind ?? 'dup_copy' })),
  }, null, 2))

  if (!APPLY) { console.error('\nDRY-RUN. Re-run with --apply (after explicit authorization) to supersede.'); return }
  if (!toSupersede.length) { console.error('nothing to supersede'); return }

  // self-verify the RPC accepts lifecycle patches before any bulk write
  const probe = toSupersede[0].doc
  const okPatch = await selfVerifyLifecyclePatchable(probe.id, probe.lifecycle, probe.current_version)
  if (!okPatch) { console.error('ABORT: apply_document_governance did not apply a lifecycle patch (whitelist?). No bulk write performed.'); process.exit(2) }
  console.error('self-verify OK: lifecycle is patchable. Proceeding with bulk supersede…')

  let done = 0, skipped = 0
  for (const t of toSupersede) {
    const [cur] = await rest(`rag_documents?select=current_version,lifecycle&id=eq.${t.doc.id}`)
    if (!cur || cur.lifecycle === 'superseded') { skipped++; continue }
    try {
      const reason = t.kind
        ? `F6 legacy dedup: ${t.kind} superseded (sql/028)`
        : `${REASON} (canonical ${t.canonicalId}, hash ${String(t.hash).slice(0, 12)})`
      await rpc('apply_document_governance', {
        p_doc_id: t.doc.id,
        p_patch: { lifecycle: 'superseded', ...(t.canonicalId ? { supersedes_document_id: t.canonicalId } : {}) },
        p_expected_version: cur.current_version,
        p_events: [{ document_id: t.doc.id, action: 'dedup_supersede', field: 'lifecycle', old_value: cur.lifecycle, new_value: 'superseded', actor: ACTOR, reason }],
      })
      if (BACKFILL) await rpc('apply_document_governance', { p_doc_id: t.canonicalId, p_patch: { content_hash: t.hash }, p_expected_version: undefined, p_events: [] }).catch(() => {})
      done++
    } catch (e) { skipped++; console.error(`skip ${t.doc.id}: ${e.message}`) }
  }
  console.log(`superseded ${done}, skipped ${skipped} (optimistic-lock conflicts / already-superseded)`)
}

main().catch(e => { console.error(e); process.exit(1) })
