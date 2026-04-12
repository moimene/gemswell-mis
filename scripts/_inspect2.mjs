import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

for (const tbl of ['fct_capex_snapshot','fct_cash_13w','fct_funding_snapshot']) {
  const {data} = await sb.from(tbl).select('*')
  console.log(`\n=== ${tbl} (${data?.length} rows) ===`)
  data?.forEach(r => console.log(JSON.stringify(r)))
}
