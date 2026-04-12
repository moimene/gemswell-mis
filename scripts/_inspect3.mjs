import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

// Funding rows
const {data:fund} = await sb.from('fct_funding_snapshot').select('*')
console.log(`\n=== fct_funding_snapshot (${fund?.length} rows) ===`)
fund?.forEach(r => console.log(JSON.stringify(r)))

// Cash rows
const {data:cash} = await sb.from('fct_cash_13w').select('*')
console.log(`\n=== fct_cash_13w (${cash?.length} rows) ===`)
cash?.forEach(r => console.log(JSON.stringify(r)))

// CapEx sums
const {data:capex} = await sb.from('fct_capex_snapshot').select('budget_baseline,committed_amount,paid_amount,eac,project_id').eq('project_id','MAD')
const totals = capex?.reduce((a,r) => ({
  budget: a.budget+(r.budget_baseline||0),
  committed: a.committed+(r.committed_amount||0),
  paid: a.paid+(r.paid_amount||0),
  eac: a.eac+(r.eac||0),
}),{budget:0,committed:0,paid:0,eac:0})
console.log('\nCapEx sums (MAD):', JSON.stringify(totals))
