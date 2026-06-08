// F6 — read-only duplicate analysis of the live corpus (evidence for sql/028 dedup).
// NO writes. Quantifies redundant documents that pollute retrieval (same content ranked
// multiple times crowds out diversity). Heuristic only: identical (title, project_id, doc_type,
// chunk_count) is a STRONG dup signal but NOT proof of byte-identical content — never auto-delete
// on it; sql/028 adds a real content_hash, and remediation supersedes (never deletes) and is
// gated on token + explicit user authorization.
//
// Usage: node scripts/analyze-corpus-duplicates.mjs   (reads SUPABASE creds from .env.local)

import { readFileSync } from 'node:fs'

function env(name) {
  if (process.env[name]) return process.env[name]
  const m = readFileSync(new URL('../.env.local', import.meta.url), 'utf8').match(new RegExp(`^${name}=(.*)$`, 'm'))
  if (!m) throw new Error(`${name} not set`)
  return m[1].trim().replace(/^["']|["']$/g, '')
}

const URL_BASE = `${env('NEXT_PUBLIC_SUPABASE_URL')}/rest/v1/rag_documents`
const SRK = env('SUPABASE_SERVICE_ROLE_KEY')

async function pullAll() {
  const rows = []
  for (let off = 0; ; off += 1000) {
    const url = `${URL_BASE}?select=id,title,project_id,doc_type,chunk_count,lifecycle,review_status,authority_tier&order=id&limit=1000&offset=${off}`
    const res = await fetch(url, { headers: { apikey: SRK, Authorization: `Bearer ${SRK}` } })
    if (!res.ok) throw new Error(`pull failed ${res.status}: ${(await res.text()).slice(0, 200)}`)
    const page = await res.json()
    rows.push(...page)
    if (page.length < 1000) break
  }
  return rows
}

function counter(items) {
  const m = new Map()
  for (const it of items) m.set(it, (m.get(it) ?? 0) + 1)
  return m
}

async function main() {
  const rows = await pullAll()
  const key = r => JSON.stringify([r.title, r.project_id, r.doc_type, r.chunk_count])

  const byKey = counter(rows.map(key))
  const dupClusters = [...byKey.entries()].filter(([k, c]) => c > 1 && JSON.parse(k)[0])
  const redundant = dupClusters.reduce((s, [, c]) => s + (c - 1), 0)
  const docsInClusters = dupClusters.reduce((s, [, c]) => s + c, 0)

  const zeroChunk = rows.filter(r => (r.chunk_count ?? 0) === 0)
  const appleDouble = rows.filter(r => (r.title ?? '').startsWith('._'))

  const report = {
    totalDocs: rows.length,
    distinctTitles: new Set(rows.map(r => r.title)).size,
    dupClusters: dupClusters.length,
    docsInDupClusters: docsInClusters,
    redundantCopies: redundant, // how many docs could be superseded (keep one per cluster)
    zeroChunkDocs: zeroChunk.length, // ingested but produced no chunks (dead weight)
    appleDoubleJunk: appleDouble.length, // macOS resource-fork files wrongly ingested
    topClusters: dupClusters.sort((a, b) => b[1] - a[1]).slice(0, 10)
      .map(([k, c]) => ({ count: c, key: JSON.parse(k) })),
  }
  console.log(JSON.stringify(report, null, 2))
  console.error(`\nSummary: ${report.redundantCopies} redundant copies across ${report.dupClusters} clusters; `
    + `${report.zeroChunkDocs} zero-chunk; ${report.appleDoubleJunk} AppleDouble junk. `
    + `Heuristic only — sql/028 content_hash needed for byte-exact dedup; remediation supersedes, never deletes.`)
}

main().catch(e => { console.error(e); process.exit(1) })
