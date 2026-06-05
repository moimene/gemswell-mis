// One-time FTS backfill driver (Spec C migration 012). Loops the server-side
// backfill_fts_batch() RPC until every rag_chunks.fts is the dual-language vector.
// Temporary tooling: the RPC + fts_done marker column are dropped after completion.
import { config } from 'dotenv'
config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
if (!url || !key) { console.error('missing supabase env'); process.exit(1) }
const sb = createClient(url, key)

async function main() {
  let remaining = Number.POSITIVE_INFINITY
  let iter = 0
  const t0 = Date.now()
  while (remaining > 0) {
    const { data, error } = await sb.rpc('backfill_fts_batch', { p_n: 4000 })
    if (error) {
      // transient PostgREST/network hiccup → brief pause + retry (do not abort the whole backfill)
      console.warn(`batch ${iter + 1} error: ${error.message} — retrying in 3s`)
      await new Promise(r => setTimeout(r, 3000))
      continue
    }
    remaining = Number(data)
    iter++
    console.log(`batch ${iter}: remaining ${remaining}  (+${Math.round((Date.now() - t0) / 1000)}s)`)
  }
  console.log(`FTS BACKFILL COMPLETE after ${iter} batches, ${Math.round((Date.now() - t0) / 1000)}s`)
}
main().catch(e => { console.error(e); process.exit(1) })
