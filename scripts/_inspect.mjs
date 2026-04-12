import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

const {data:defs} = await sb.from('intel_metric_definition')
  .select('id,display_name,target_table,target_column,target_filter,project_id')
  .like('id','MAD.%')
console.log('DEFS:', JSON.stringify(defs, null, 2))

for (const tbl of ['fct_capex_snapshot','fct_cash_13w','fct_funding_snapshot']) {
  const {data,error} = await sb.from(tbl).select('*').limit(2)
  if (error) console.log(tbl,'ERR:',error.message)
  else console.log(tbl,'→ rows:',data?.length,'cols:', data?.[0] ? Object.keys(data[0]).join(', ') : 'empty')
}

const {data:pubs} = await sb.from('intel_fact_publication').select('*').limit(5)
console.log('fact_publication rows:', pubs?.length)
