// Backlog B4 — near-duplicate detection (version/format families A2's byte-exact dedup missed).
// trabajo de fondo 2026-06-13. DEFAULT = DRY-RUN. --apply supersedes. REVERSIBLE (audit events).
//
// ADVERSARIAL SAFETY (why this does NOT blindly dedup):
//  Most same-stem clusters are MEANINGFUL, not redundant:
//   • Financial models (bp_model/financial_statements/funding/monitoring/dd): versions carry DIFFERENT
//     numbers → NEVER auto-supersede. → REVIEW report only.
//   • Translations (cast/eng/esp/_es/_en/ing markers): different language = different doc → never merge.
//  Only AUTO-SUPERSEDE legal/board contract clusters where a member is near-identical text (Jaccard of
//  word-trigrams over the first chunks >= SIM_THRESHOLD) to a clear canonical (signed/executed > later >
//  higher-authority > more-chunks). Everything else is emitted to a REVIEW list for a human (the CFO).
//
// Canonical-survivor + supersede writes rag_document_events action='neardup_supersede' (targeted revert).
//
// Usage: node scripts/dedup-near-dups.mjs                                  # dry-run: print SUPERSEDE decisions + REVIEW clusters
//        node scripts/dedup-near-dups.mjs --apply                          # supersede the auto-safe set (after review)
//        node scripts/dedup-near-dups.mjs --review                         # print ONLY the human-review clusters (financial/ambiguous)
//        node scripts/dedup-near-dups.mjs --review --review-out docs/x.md  # write ALL human-review clusters

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
function env(name) {
  if (process.env[name]) return process.env[name]
  const m = readFileSync(new URL('../.env.local', import.meta.url), 'utf8').match(new RegExp(`^${name}=(.*)$`, 'm'))
  if (!m) throw new Error(`${name} not set`); return m[1].trim().replace(/^["']|["']$/g, '')
}
const SUPA = env('NEXT_PUBLIC_SUPABASE_URL'), SRK = env('SUPABASE_SERVICE_ROLE_KEY')
const H = { apikey: SRK, Authorization: `Bearer ${SRK}`, 'Content-Type': 'application/json' }
function argValue(name) {
  const eq = process.argv.find((a) => a.startsWith(`${name}=`))
  if (eq) return eq.slice(name.length + 1)
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : null
}

const APPLY = process.argv.includes('--apply'), REVIEW_ONLY = process.argv.includes('--review')
const REVERT = process.argv.includes('--revert')
const REVIEW_OUT = argValue('--review-out')
const REVIEW_CSV = argValue('--review-csv')

const SIM_THRESHOLD = 0.95
const FINANCIAL = new Set(['bp_model', 'financial_statements', 'funding', 'monitoring', 'dd', 'cash_flow', 'capex'])
const CONTRACT_TYPES = new Set(['legal', 'board'])
const LANG = /(_es\b|_en\b|\beng\b|\besp?\b|\bcast\b|\bing\b|ingl[eé]s|espa[nñ]ol|english|spanish)/i

async function rest(p) { const r = await fetch(`${SUPA}/rest/v1/${p}`, { headers: H }); if (!r.ok) throw new Error(`${p} ${r.status}`); return r.json() }
async function rpc(fn, body) {
  const r = await fetch(`${SUPA}/rest/v1/rpc/${fn}`, { method: 'POST', headers: H, body: JSON.stringify(body) })
  if (!r.ok) throw new Error(`rpc ${fn} ${r.status}: ${(await r.text()).slice(0, 160)}`)
  return r.status === 204 ? null : r.json()
}

// --revert: restore lifecycle from the audit trail AND clear supersedes_document_id (Codex HIGH #9:
// the event alone is not enough — the supersedes_document_id link also has to be undone).
async function revertNearDup() {
  const events = await rest(`rag_document_events?select=document_id,old_value&action=eq.neardup_supersede&order=created_at.desc&limit=10000`)
  let restored = 0
  for (const e of events) {
    const [cur] = await rest(`rag_documents?select=current_version,lifecycle&id=eq.${e.document_id}`)
    if (!cur || cur.lifecycle !== 'superseded') continue
    await rpc('apply_document_governance', {
      p_doc_id: e.document_id, p_patch: { lifecycle: e.old_value, supersedes_document_id: null }, p_expected_version: cur.current_version,
      p_events: [{ document_id: e.document_id, action: 'neardup_supersede_revert', field: 'lifecycle', old_value: 'superseded', new_value: e.old_value, actor: 'admin:console', reason: 'B4 near-dup revert' }],
    })
    restored++
  }
  console.log(`reverted ${restored} near-dup supersessions`)
}

function stem(title) {
  return title.toLowerCase()
    .replace(/\.(pdf|docx?|xlsx?|pptx?)$/g, '')
    .replace(/(signed|firmad[oa]|set de firma|_?rev ?[0-9]+|v[0-9]{6}|_[0-9]{6}|\([0-9]+\)|clean|vdef|\bvf\b|\bv[0-9]+\b|borrador|draft|duplicate|[0-9]{6,8}|[0-9]{1,2}[._][0-9]{1,2}[._][0-9]{2,4})/g, '')
    .replace(/[^a-z0-9]/g, '')
}
function langTag(title) { const m = title.match(LANG); return m ? m[0].toLowerCase().replace(/[^a-z]/g, '') : '' }
// tightKey strips ONLY format/copy/signing/status tokens + punctuation, but KEEPS digits (dates AND
// version numbers). So "20250725 Tablas MPS" and "20250801 Tablas MPS" (a weekly time-series) get
// DIFFERENT tightKeys and are NEVER merged, while "X SIGNED.pdf"/"X.pdf"/"X (002).pdf" collapse to one.
// This is the guard against superseding versioned data snapshots (CRITICAL: first-4-chunk similarity is
// 1.00 for same-header weekly snapshots whose DATA differs later — title-date is the real discriminator).
function tightKey(title) {
  return title.toLowerCase()
    .replace(/\.(pdf|docx?|xlsx?|pptx?)$/g, '')
    .replace(/\b(signed|firmad[oa]|set de firma|clean|duplicate|borrador|draft)\b/g, '')
    .replace(/\(\s*0*\d{1,3}\s*\)/g, '')  // strip 1-3 digit copy markers (002),(1) — NOT 4-digit years (2024) (Codex)
    .replace(/[^a-z0-9]/g, '')
}
function lcRank(lc) { return ({ signed: 5, executed: 4, filed: 4, working_paper: 3, draft: 2 })[lc] ?? 1 }
function mdCell(v) { return String(v ?? '').replace(/\r?\n/g, ' ').replace(/\|/g, '\\|') }
function csvCell(v) {
  const s = String(v ?? '')
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
function shortHash(v) { return v ? String(v).slice(0, 16) : '' }

const trigrams = (s) => {
  const w = s.toLowerCase().replace(/\s+/g, ' ').trim().split(' ')
  const g = new Set(); for (let i = 0; i + 2 < w.length; i++) g.add(w[i] + ' ' + w[i + 1] + ' ' + w[i + 2]); return g
}
function jaccard(a, b) { if (!a.size || !b.size) return 0; let inter = 0; for (const x of a) if (b.has(x)) inter++; return inter / (a.size + b.size - inter) }

// Fingerprint over the FULL document text (Codex CRITICAL #5: first-4-chunks misses different schedules/
// amendments/signature pages/economics in contracts with identical front matter). Cap at 2,000 chunks /
// 400k chars so a pathological doc can't OOM; format-dup pairs are small so this is exact in practice.
async function fingerprint(docId) {
  const parts = []
  for (let off = 0; off < 2000; off += 1000) {
    const ch = await rest(`rag_chunks?select=content&document_id=eq.${docId}&order=chunk_index&limit=1000&offset=${off}`)
    for (const c of ch) parts.push(c.content ?? '')
    if (ch.length < 1000) break
  }
  const joined = parts.join(' ')
  return { tg: trigrams(joined.slice(0, 400000)), chars: joined.length }
}

async function pullDocs() {
  const rows = []
  for (let off = 0; ; off += 1000) {
    const p = await rest(`rag_documents?select=id,title,project_id,doc_type,lifecycle,authority_score,chunk_count,created_at,content_hash&lifecycle=neq.superseded&status=eq.indexed&order=id&limit=1000&offset=${off}`)
    rows.push(...p); if (p.length < 1000) break
  }
  return rows
}

function writeReviewArtifacts(review, supersede) {
  const rows = [...review].sort((a, b) =>
    String(a.reason).localeCompare(String(b.reason)) ||
    String(a.k).localeCompare(String(b.k)) ||
    String(a.members[0]?.title ?? '').localeCompare(String(b.members[0]?.title ?? '')),
  )
  const byReason = {}
  for (const r of rows) byReason[r.reason] = (byReason[r.reason] ?? 0) + 1

  if (REVIEW_OUT) {
    mkdirSync(dirname(REVIEW_OUT), { recursive: true })
    const out = []
    out.push('# Near-Duplicate Human Review Report')
    out.push('')
    out.push(`Generated: ${new Date().toISOString()}`)
    out.push('Mode: read-only review report; no Supabase mutations are performed without --apply.')
    out.push('')
    out.push('## Summary')
    out.push('')
    out.push(`- Human-review clusters: ${rows.length}`)
    out.push(`- Auto-supersede candidates visible in this run: ${supersede.length}`)
    out.push(`- Similarity threshold for auto candidates: ${SIM_THRESHOLD}`)
    out.push('')
    out.push('| Reason | Clusters |')
    out.push('|---|---:|')
    for (const [reason, count] of Object.entries(byReason).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) {
      out.push(`| ${mdCell(reason)} | ${count} |`)
    }
    out.push('')
    out.push('## Review Guidance')
    out.push('')
    out.push('- Do not merge financial/versioned packs unless the CFO confirms the files are truly redundant.')
    out.push('- Treat translations as separate records unless the business wants a single bilingual canonical family.')
    out.push('- For low-similarity legal pairs, compare economics, parties, dates, schedules, signatures and amendments before superseding anything.')
    out.push('- This report is an input for human review; it is not an execution plan.')
    out.push('')
    out.push('## Clusters')

    rows.forEach((r, i) => {
      out.push('')
      out.push(`### ${String(i + 1).padStart(3, '0')} — ${mdCell(r.reason)}`)
      out.push('')
      out.push(`Key: \`${String(r.k).replace(/`/g, '\\`')}\``)
      out.push('')
      out.push('| # | Title | Project | Type | Lifecycle | Authority | Chunks | Hash | Created | Document ID |')
      out.push('|---:|---|---|---|---|---:|---:|---|---|---|')
      r.members.forEach((m, j) => {
        out.push(`| ${j + 1} | ${mdCell(m.title)} | ${mdCell(m.project_id)} | ${mdCell(m.doc_type)} | ${mdCell(m.lifecycle)} | ${m.authority_score ?? ''} | ${m.chunk_count ?? ''} | ${mdCell(shortHash(m.content_hash))} | ${mdCell(m.created_at)} | \`${m.id}\` |`)
      })
    })

    writeFileSync(REVIEW_OUT, `${out.join('\n')}\n`)
    console.log(`\nWrote full human-review report: ${REVIEW_OUT}`)
  }

  if (REVIEW_CSV) {
    mkdirSync(dirname(REVIEW_CSV), { recursive: true })
    const lines = ['cluster,reason,key,member_count,member_index,document_id,title,project_id,doc_type,lifecycle,authority_score,chunk_count,content_hash,created_at']
    rows.forEach((r, i) => {
      r.members.forEach((m, j) => {
        lines.push([
          i + 1, r.reason, r.k, r.members.length, j + 1, m.id, m.title, m.project_id, m.doc_type,
          m.lifecycle, m.authority_score, m.chunk_count, m.content_hash, m.created_at,
        ].map(csvCell).join(','))
      })
    })
    writeFileSync(REVIEW_CSV, `${lines.join('\n')}\n`)
    console.log(`Wrote full human-review CSV: ${REVIEW_CSV}`)
  }
}

async function main() {
  if (REVERT) return revertNearDup()
  const docs = await pullDocs()
  const clusters = new Map()
  for (const d of docs) {
    if (!d.title) continue
    const k = stem(d.title) + '|' + (d.project_id ?? '')
    if (stem(d.title).length < 8) continue
    if (!clusters.has(k)) clusters.set(k, []); clusters.get(k).push(d)
  }
  const supersede = [], review = []
  for (const [k, members] of clusters) {
    if (members.length < 2) continue
    if (new Set(members.map(m => m.content_hash)).size < 2) continue // byte-exact handled by A2
    const types = new Set(members.map(m => m.doc_type))
    // REVIEW-only whole cluster: any financial/reporting type (versions carry distinct data) or mixed type.
    if ([...types].some(t => FINANCIAL.has(t)) || ![...types].every(t => CONTRACT_TYPES.has(t))) {
      review.push({ k, members, reason: [...types].some(t => FINANCIAL.has(t)) ? 'financial-versions' : 'mixed-type' }); continue
    }
    // Subgroup by tightKey: only SAME-dated format/copy/sign variants can be auto-superseded. A different
    // date/version → different tightKey → its own subgroup → kept (or reviewed if it has its own dups).
    const sub = new Map()
    for (const m of members) { const tk = tightKey(m.title); if (!sub.has(tk)) sub.set(tk, []); sub.get(tk).push(m) }
    for (const [tk, grp] of sub) {
      if (grp.length < 2) continue // unique dated/version doc — keep untouched
      if (new Set(grp.map(m => m.content_hash)).size < 2) continue // byte-exact handled by A2
      if (new Set(grp.map(m => langTag(m.title)).filter(Boolean)).size > 1) { review.push({ k: tk, members: grp, reason: 'translations' }); continue }
      const ranked = [...grp].sort((a, b) =>
        lcRank(b.lifecycle) - lcRank(a.lifecycle) ||
        (/(signed|firmad)/i.test(b.title) ? 1 : 0) - (/(signed|firmad)/i.test(a.title) ? 1 : 0) ||
        (/\.pdf$/i.test(b.title) ? 1 : 0) - (/\.pdf$/i.test(a.title) ? 1 : 0) ||
        (b.chunk_count ?? 0) - (a.chunk_count ?? 0))
      const canon = ranked[0]
      const fpCanon = await fingerprint(canon.id)
      for (const m of ranked.slice(1)) {
        const fpM = await fingerprint(m.id)
        const sim = jaccard(fpM.tg, fpCanon.tg)
        // length-ratio guard (Codex BLOCKER 4): an added/removed clause changes total length. Require the
        // two docs to be within 10% length AND >=0.95 trigram-similar AND same dated tightKey before
        // superseding — so a same-date amended contract (rare) still falls to review, not auto-supersede.
        const lenRatio = Math.min(fpM.chars, fpCanon.chars) / Math.max(fpM.chars, fpCanon.chars, 1)
        if (sim >= SIM_THRESHOLD && lenRatio >= 0.90) supersede.push({ doc: m, canonical: canon, sim, lenRatio })
        else review.push({ k: tk, members: [canon, m], reason: `sim ${sim.toFixed(2)} len ${lenRatio.toFixed(2)}` })
      }
    }
  }

  if (!REVIEW_ONLY) {
    console.log(`\n=== AUTO-SUPERSEDE candidates (contract near-dups, sim>=${SIM_THRESHOLD}): ${supersede.length} ===`)
    for (const s of supersede) console.log(`  ✗ [sim ${s.sim.toFixed(2)} len ${s.lenRatio.toFixed(2)}] supersede "${s.doc.title.slice(0, 46)}" (${s.doc.lifecycle}) → keep "${s.canonical.title.slice(0, 46)}" (${s.canonical.lifecycle})`)
  }
  console.log(`\n=== HUMAN REVIEW clusters (NOT auto-touched): ${review.length} ===`)
  const byReason = {}; for (const r of review) byReason[r.reason] = (byReason[r.reason] ?? 0) + 1
  console.log(`  by reason: ${JSON.stringify(byReason)}`)
  for (const r of review.slice(0, 40)) console.log(`  ? [${r.reason}] ${r.members.map(m => m.title.slice(0, 38)).join('  |  ')}`)
  writeReviewArtifacts(review, supersede)

  if (!APPLY) { console.log(`\nDRY-RUN. ${supersede.length} would supersede. Re-run --apply after review.`); return }
  let done = 0, skipped = 0
  for (const s of supersede) {
    // Optimistic lock (Codex HIGH #8): re-read version; skip if a concurrent session changed the doc.
    const [cur] = await rest(`rag_documents?select=current_version,lifecycle&id=eq.${s.doc.id}`)
    if (!cur || cur.lifecycle === 'superseded') { skipped++; continue }
    try {
      // lifecycle only (NOT supersedes_document_id — survivor→old semantics; canonical recorded in event).
      await rpc('apply_document_governance', {
        p_doc_id: s.doc.id, p_patch: { lifecycle: 'superseded' }, p_expected_version: cur.current_version,
        p_events: [{ document_id: s.doc.id, action: 'neardup_supersede', field: 'lifecycle', old_value: cur.lifecycle, new_value: 'superseded', actor: 'admin:console', reason: `B4 near-dup (sim ${s.sim.toFixed(2)}, len ${s.lenRatio.toFixed(2)}, canonical ${s.canonical.id} "${s.canonical.title.slice(0,40)}")` }],
      })
      done++
    } catch (e) { skipped++; console.error(`  skip ${s.doc.id}: ${e.message}`) }
  }
  console.log(`\nAPPLIED: superseded ${done}/${supersede.length} (skipped ${skipped}). Review clusters left for human: ${review.length}.`)
}
main().catch(e => { console.error(e); process.exit(1) })
