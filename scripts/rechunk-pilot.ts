// B-feasibility pilot (trabajo de fondo 2026-06-13). READ-ONLY. No DB writes, no embeds.
// Source bytes are gone (storage_path=0), so the ONLY way to re-chunk legacy is to reconstruct text
// from existing chunks. This proves whether reconstruct -> chunkFinancialContent (clause/table-aware)
// recovers structure (clause chunks for legal docs) that the legacy chunker never produced (0 clause).
//
// Usage: npx tsx scripts/rechunk-pilot.ts [N]   (default 5 legal docs with clause signals)
import { readFileSync } from 'node:fs'
import { chunkFinancialContent } from '../src/lib/rag/embeddings'

function env(name: string): string {
  if (process.env[name]) return process.env[name] as string
  const m = readFileSync(new URL('../.env.local', import.meta.url), 'utf8').match(new RegExp(`^${name}=(.*)$`, 'm'))
  if (!m) throw new Error(`${name} not set`)
  return m[1].trim().replace(/^["']|["']$/g, '')
}
const SUPA = env('NEXT_PUBLIC_SUPABASE_URL')
const SRK = env('SUPABASE_SERVICE_ROLE_KEY')
const H = { apikey: SRK, Authorization: `Bearer ${SRK}`, 'Content-Type': 'application/json' }

async function rest(path: string): Promise<any[]> {
  const res = await fetch(`${SUPA}/rest/v1/${path}`, { headers: H })
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return res.json() as Promise<any[]>
}

async function reconstruct(docId: string): Promise<string> {
  const parts: string[] = []
  for (let off = 0; ; off += 1000) {
    const page = await rest(`rag_chunks?select=content,chunk_index&document_id=eq.${docId}&order=chunk_index&limit=1000&offset=${off}`)
    if (!page.length) break
    for (const c of page) parts.push(c.content ?? '')
    if (page.length < 1000) break
  }
  // Join by blank line so paragraph/clause boundaries survive; the chunker re-detects structure.
  return parts.join('\n\n')
}

async function main() {
  const N = parseInt(process.argv[2] ?? '5', 10)
  // pick live legal/board docs that have clause signals in their text
  const docs = await rest(
    `rag_documents?select=id,title,doc_type,chunk_count&doc_type=in.(legal,board)&lifecycle=neq.superseded&order=chunk_count.desc&limit=40`,
  )
  let shown = 0
  for (const d of docs) {
    const text = await reconstruct(d.id)
    const hasClauseSignal = /(art[íi]culo|cl[áa]usula|secci[óo]n|clause|article|section)\s+(\d+|[ivxlcdm]+|primer|segund|tercer)/i.test(text)
    if (!hasClauseSignal) continue
    const re = chunkFinancialContent(text, { doc_type: d.doc_type })
    const types = re.reduce<Record<string, number>>((a, c) => { const t = c.metadata.chunk_type ?? '?'; a[t] = (a[t] ?? 0) + 1; return a }, {})
    const pages = re.filter((c) => c.metadata.page != null).length
    console.log(`\n■ ${String(d.title).slice(0, 64)}  [${d.doc_type}]`)
    console.log(`   legacy chunks: ${d.chunk_count}   reconstructed text: ${text.length} chars`)
    console.log(`   re-chunked: ${re.length} chunks  types=${JSON.stringify(types)}  withPage=${pages}`)
    const firstClause = re.find((c) => c.metadata.chunk_type === 'clause')
    if (firstClause) console.log(`   e.g. clause head: "${firstClause.content.split('\n')[0].slice(0, 80)}"`)
    if (++shown >= N) break
  }
  if (!shown) console.log('No legal/board docs with clause signals found in the sample window.')
}
main().catch((e) => { console.error(e); process.exit(1) })
