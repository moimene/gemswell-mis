// Tranche B — curated clause-aware re-chunk + re-embed of GENUINE contracts (trabajo de fondo 2026-06-13).
//
// WHY: legacy legal/board docs were chunked by the old structured heuristic → 0 'clause' chunks. Real
// contracts (SHAs, loan agreements, signed agreements) retrieve better when chunked clause-atomic
// (src/lib/rag/embeddings.ts tryClauseChunk, WS2-T3) + page provenance (assignPages, WS2-T4). Source
// bytes are gone (storage_path=0), so we RECONSTRUCT text from existing chunks (de-overlapped) and
// re-run the REAL chunker, then re-embed ONLY the curated contract subset (NOT the 57k-chunk blanket,
// which mis-clauses engineering annexes mislabeled 'legal').
//
// SAFETY:
//  • DEFAULT = DRY-RUN (reconstruct + re-chunk + report; NO embeds, NO writes).
//  • --apply requires a full pre-backup table rag_chunks_rechunk_bak_20260613 to exist (asserted).
//  • Per doc: delete old chunks -> insert new (embedded). RESUMABLE: skips docs with a 'rechunk' event.
//  • fts auto-populates via trig_rag_chunks_fts; embedding_model via column default. Mirrors insertChunkBatch.
//  • Curated subset only (contract title signal ∧ not-engineering ∧ chunk_count>=5).
//
// Usage:
//   npx tsx scripts/rechunk-contracts.ts                 # dry-run report (all curated targets)
//   npx tsx scripts/rechunk-contracts.ts --limit 3       # dry-run first 3
//   npx tsx scripts/rechunk-contracts.ts --apply --limit 3   # WRITE first 3 (pilot)
//   npx tsx scripts/rechunk-contracts.ts --apply             # WRITE all curated
import { config } from 'dotenv'
config({ path: '.env.local' })
import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { chunkFinancialContent, embedBatch, DIMENSIONS, EMBEDDING_MODEL, type ChunkMetadata } from '../src/lib/rag/embeddings'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
if (!url || !key) { console.error('missing supabase env'); process.exit(1) }
const sb = createClient(url, key)

const argv = process.argv.slice(2)
const APPLY = argv.includes('--apply')
const li = argv.indexOf('--limit'); const LIMIT = li >= 0 ? parseInt(argv[li + 1], 10) : Infinity
const EMBED_BATCH = 32
const BAK_TABLE = 'rag_chunks_rechunk_bak_20260613'

// curated true-contract filter (mirrors the SQL sizing query). Title-positive ∧ not-engineering.
const INCLUDE = /(contrato|contract|agreement|loan|cr[ée]dito|pr[ée]stamo|facilit|escritura|pacto|shareholder|socios|estatuto|\bpoder|\bacta\b|junta|consejo|\bnda\b|term ?sheet|side ?letter|engagement|hoja de encargo|convenio|acuerdo|firmad|signed|mandate)/i
const EXCLUDE = /(anexo|\bmem\b|\burb\b|medici|plazos|costes|ahorro|\bcove\b|\bplot\b|drawing|\bdr[_ -]|\.dwg|roof|render|\bcgi\b|\bgla\b|sketch|\bhub\b|sections?|facilities)/i
const CLAUSE_SIG = /(art[íi]culo|cl[áa]usula|secci[óo]n|clause|article)\s+(\d+|[ivxlcdm]+|primer|segund|tercer|cuart)/i

type Doc = {
  id: string; title: string; doc_type: string | null; project_id: string | null; chunk_count: number | null
  review_status: string | null; lifecycle: string | null; authority_tier: string | null
  authority_score: number | null; classification_source: string | null; source_channel: string | null; source_hash: string | null
}

async function pullTargets(): Promise<Doc[]> {
  const rows: Doc[] = []
  for (let off = 0; ; off += 1000) {
    const { data, error } = await sb.from('rag_documents')
      .select('id,title,doc_type,project_id,chunk_count,review_status,lifecycle,authority_tier,authority_score,classification_source,source_channel,source_hash')
      .in('doc_type', ['legal', 'board']).neq('lifecycle', 'superseded')
      .order('id').range(off, off + 999)
    if (error) throw new Error(error.message)
    rows.push(...(data as Doc[]))
    if (!data || data.length < 1000) break
  }
  return rows.filter(d => d.title && INCLUDE.test(d.title) && !EXCLUDE.test(d.title) && (d.chunk_count ?? 0) >= 5)
}

// Read OLD chunks from the IMMUTABLE backup (not rag_chunks): apply deletes+reinserts rag_chunks per
// doc, so reading source from the backup makes a resume after a mid-doc crash reconstruct from pristine
// text (reading rag_chunks would re-derive from PARTIAL new chunks → corruption).
async function fetchChunks(docId: string): Promise<string[]> {
  const out: string[] = []
  for (let off = 0; ; off += 1000) {
    const { data, error } = await sb.from(BAK_TABLE)
      .select('content,chunk_index').eq('document_id', docId).order('chunk_index').range(off, off + 999)
    if (error) throw new Error(error.message)
    for (const c of data as { content: string }[]) out.push(c.content ?? '')
    if (!data || data.length < 1000) break
  }
  return out
}

// Reconstruct by NEWLINE-PRESERVING join. The chunker's structure detection (clause `^cláusula`, table
// `^|...|`, page `^---$`) is line-anchored, so any whitespace-collapsing de-overlap blinds it (an earlier
// `.split(/\s+/).join(' ')` de-overlap dropped clause detection from ~thousands to 118). The ~20% overlap
// duplication is benign: the clause/table-aware re-chunker re-segments cleanly and the goal IS more,
// clause-atomic chunks. Pilot (scripts/rechunk-pilot.ts) proved simple join recovers clauses + pages.
function reconstruct(parts: string[]): string {
  return parts.join('\n\n')
}

function contentHash(chunkContents: string[]): string {
  const h = createHash('sha256')
  for (const c of chunkContents) h.update((c ?? '').replace(/\s+/g, ' ').trim() + '\n')
  return h.digest('hex')
}

async function alreadyRechunked(ids: string[]): Promise<Set<string>> {
  const done = new Set<string>()
  const { data } = await sb.from('rag_document_events').select('document_id').eq('action', 'rechunk').in('document_id', ids)
  for (const r of (data ?? []) as { document_id: string }[]) done.add(r.document_id)
  return done
}

// Docs whose chunks are referenced by the Layer-3 provenance FKs (intel_fact_source_link,
// intel_metric_candidate — both ON DELETE NO ACTION) MUST NOT be re-chunked: deleting a cited chunk
// orphans the provenance and the FK blocks the delete (errors the job). Union both tables.
async function factLinkedDocs(): Promise<Set<string>> {
  const s = new Set<string>()
  for (const tbl of ['intel_fact_source_link', 'intel_metric_candidate']) {
    const { data } = await sb.from(tbl).select('rag_document_id')
    for (const r of (data ?? []) as { rag_document_id: string | null }[]) if (r.rag_document_id) s.add(r.rag_document_id)
  }
  return s
}

async function main() {
  const targets = (await pullTargets()).slice(0, LIMIT === Infinity ? undefined : LIMIT)
  console.log(`curated contract targets: ${targets.length}  (mode: ${APPLY ? 'APPLY' : 'DRY-RUN'})`)
  if (APPLY) {
    const { error } = await sb.from(BAK_TABLE).select('id', { count: 'exact', head: true })
    if (error) { console.error(`ABORT: backup table ${BAK_TABLE} missing — create it first (see runbook).`); process.exit(2) }
  }
  const done = APPLY ? await alreadyRechunked(targets.map(t => t.id)) : new Set<string>()
  const factLinked = await factLinkedDocs()

  let totalOld = 0, totalNew = 0, totalClause = 0, totalPage = 0, processed = 0, skipped = 0, factSkipped = 0
  const t0 = Date.now()
  for (const d of targets) {
    if (done.has(d.id)) { skipped++; continue }
    if (factLinked.has(d.id)) { factSkipped++; continue }
    const parts = await fetchChunks(d.id)
    const text = reconstruct(parts)
    const base: ChunkMetadata = {
      project_id: d.project_id ?? undefined, doc_type: d.doc_type ?? undefined, source_file: d.title,
      document_id: d.id, source_hash: d.source_hash ?? undefined, source_channel: d.source_channel ?? undefined,
      review_status: d.review_status ?? undefined, classification_source: d.classification_source ?? undefined,
      lifecycle: d.lifecycle ?? undefined, authority_tier: d.authority_tier ?? undefined,
      authority_score: d.authority_score ?? undefined, embedding_model: EMBEDDING_MODEL,
    }
    const re = chunkFinancialContent(text, base)
    const clause = re.filter(c => c.metadata.chunk_type === 'clause').length
    const pages = re.filter(c => c.metadata.page != null).length
    totalOld += parts.length; totalNew += re.length; totalClause += clause; totalPage += pages
    const hadClauseSignal = CLAUSE_SIG.test(text)

    console.log(`${APPLY ? '►' : '·'} ${String(d.title).slice(0, 54).padEnd(54)} ${String(parts.length).padStart(4)}→${String(re.length).padStart(4)}  clause=${String(clause).padStart(4)} page=${String(pages).padStart(4)} ${hadClauseSignal ? '' : '(no-clause-sig)'}`)

    if (!APPLY) { processed++; continue }
    if (re.length === 0) { console.error(`  skip ${d.id}: 0 new chunks`); skipped++; continue }

    // delete old -> insert new (embedded). fts via trigger, embedding_model via default.
    const del = await sb.from('rag_chunks').delete().eq('document_id', d.id)
    if (del.error) { console.error(`  ABORT ${d.id}: delete failed ${del.error.message}`); process.exit(3) }
    for (let i = 0; i < re.length; i += EMBED_BATCH) {
      const batch = re.slice(i, i + EMBED_BATCH)
      const emb = await embedBatch(batch.map(c => c.content), { lane: 'bulk' })
      if (!emb.every(e => Array.isArray(e) && e.length === DIMENSIONS)) throw new Error(`bad emb dims doc ${d.id}`)
      const rows = batch.map((c, j) => ({
        document_id: d.id, chunk_index: i + j, content: c.content,
        embedding: JSON.stringify(emb[j]), metadata: c.metadata, token_count: c.tokenEstimate,
      }))
      const ins = await sb.from('rag_chunks').insert(rows)
      if (ins.error) { console.error(`  ABORT ${d.id} @${i}: insert failed ${ins.error.message} (restore from ${BAK_TABLE})`); process.exit(4) }
    }
    const newHash = contentHash(re.map(c => c.content))
    await sb.from('rag_documents').update({ chunk_count: re.length }).eq('id', d.id)
    await sb.from('rag_documents').update({ content_hash: newHash }).eq('id', d.id).then(r => { if (r.error) console.warn(`  content_hash update skipped (collision?) ${d.id}`) })
    await sb.from('rag_document_events').insert({
      document_id: d.id, action: 'rechunk', field: 'chunks', old_value: String(parts.length), new_value: String(re.length),
      actor: 'admin:console', reason: `B curated clause-aware re-chunk+re-embed (clause=${clause}, page=${pages}; trabajo de fondo 2026-06-13)`,
    })
    processed++
    if (processed % 10 === 0) console.log(`  …${processed} done, +${Math.round((Date.now() - t0) / 1000)}s`)
  }
  console.log(`\n${APPLY ? 'APPLIED' : 'DRY-RUN'}: ${processed} docs${skipped ? `, ${skipped} done-skip` : ''}${factSkipped ? `, ${factSkipped} fact-linked-skip` : ''}.  chunks ${totalOld}→${totalNew}  clause+${totalClause}  page+${totalPage}  ${Math.round((Date.now() - t0) / 1000)}s`)
}
main().catch(e => { console.error(e); process.exit(1) })
