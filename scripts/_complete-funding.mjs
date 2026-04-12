import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

const PACK_ID = 'e264957c-9947-420a-b37a-0890069ff3c7'

// 1. Update dim_funding_instrument MAD-DBT-01 → Caixabank (intel-validated)
console.log('\n1. Updating dim MAD-DBT-01 → Caixabank...')
const {error: e1} = await sb.from('dim_funding_instrument').update({
  instrument_name: 'Caixabank Senior Facility',
  provider:        'Caixabank',
  facility_limit:  31_000_000,
  agreement_date:  '2024-10-01',
  maturity_date:   '2031-10-01',
  interest_type:   'Euribor3M + spread',
}).eq('instrument_id','MAD-DBT-01')
console.log(e1 ? '  ⚠️ ' + e1.message : '  ✅ Updated')

// 2. Add fct_funding_snapshot row for MAD-QEQ-01 (Buenavista Participativo, €15.66M)
console.log('\n2. Adding fct_funding_snapshot for MAD-QEQ-01 (participativo)...')
const {data:ex1} = await sb.from('fct_funding_snapshot').select('id').eq('project_id','MAD').eq('instrument_id','MAD-QEQ-01').single()
if (ex1) {
  console.log('  ⏭  Already exists')
} else {
  const {error: e2} = await sb.from('fct_funding_snapshot').insert({
    project_id:        'MAD',
    period_end_date:   '2026-02-28',
    instrument_id:     'MAD-QEQ-01',
    committed_amount:  15_657_498.18,
    drawn_to_date:     0,
    undrawn_available: 15_657_498.18,
    accrued_fees_interest: 0,
    comment: 'Crédito Participativo Buenavista — €15.66M committed, not yet drawn. Source: intel:MAD.funding.committed.total',
    source_file: 'intel:MAD.funding.committed.total',
  })
  console.log(e2 ? '  ⚠️ ' + e2.message : '  ✅ Inserted')
}

// 3. Add fct_funding_snapshot row for MAD-SPN-01 (Sponsor Rights €6M)
console.log('\n3. Adding fct_funding_snapshot for MAD-SPN-01 (sponsor rights)...')
const {data:ex2} = await sb.from('fct_funding_snapshot').select('id').eq('project_id','MAD').eq('instrument_id','MAD-SPN-01').single()
if (ex2) {
  console.log('  ⏭  Already exists')
} else {
  const {error: e3} = await sb.from('fct_funding_snapshot').insert({
    project_id:        'MAD',
    period_end_date:   '2026-03-30',
    instrument_id:     'MAD-SPN-01',
    committed_amount:  6_000_000,
    drawn_to_date:     0,
    undrawn_available: 6_000_000,
    accrued_fees_interest: 0,
    comment: 'Mahou + Cantabria Sponsor Upfront Rights — €6M committed.',
    source_file: '20260330_CapEx Monitoring CF.xlsx',
  })
  console.log(e3 ? '  ⚠️ ' + e3.message : '  ✅ Inserted')
}

// 4. Register capex contradiction with correct columns
console.log('\n4. Registering capex contradiction...')
const capexCandidate = await sb.from('intel_metric_candidate')
  .select('id').eq('metric_id','MAD.capex.budget_baseline.total').eq('pack_id', PACK_ID).single()

const {data:exContra} = await sb.from('intel_contradiction_alert')
  .select('id').eq('metric_id','MAD.capex.budget_baseline.total').eq('project_id','MAD').eq('status','open').single()

if (exContra) {
  console.log('  ⏭  Already registered')
} else {
  const {error: e4} = await sb.from('intel_contradiction_alert').insert({
    metric_id:      'MAD.capex.budget_baseline.total',
    project_id:     'MAD',
    period_label:   'Mar-2026',
    candidate_a_id: null,
    candidate_b_id: capexCandidate.data?.id || null,
    value_a:        103_207_591.06,   // CapEx Monitoring CF sum
    value_b:        57_130_736.73,    // Intel Budget UW
    delta_abs:      46_076_854.33,
    delta_pct:      0.807,
    severity:       'high',
    status:         'open',
    pack_id:        PACK_ID,
    resolution_note: 'CapEx Monitoring CF sums all cost categories across all periods (€103M). Budget UW from Cost Allocation MPS is hard+soft underwriting baseline (€57M). Methodological difference — requires CFO confirmation of canonical budget figure.',
  })
  console.log(e4 ? '  ⚠️ ' + e4.message : '  ✅ Registered')
}

// 5. Final funding summary
console.log('\n5. Final MAD funding totals...')
const {data:final} = await sb.from('fct_funding_snapshot')
  .select('instrument_id, committed_amount, drawn_to_date, undrawn_available')
  .eq('project_id','MAD')

const tot = final?.reduce((a,r)=>({
  c: a.c+(r.committed_amount||0),
  d: a.d+(r.drawn_to_date||0),
  u: a.u+(r.undrawn_available||0),
}),{c:0,d:0,u:0})

final?.forEach(r => console.log(`  ${r.instrument_id.padEnd(12)} committed €${(r.committed_amount/1e6).toFixed(2)}M  drawn €${(r.drawn_to_date/1e6).toFixed(2)}M`))
console.log(`  ${'TOTAL'.padEnd(12)} committed €${(tot.c/1e6).toFixed(2)}M  drawn €${(tot.d/1e6).toFixed(2)}M  undrawn €${(tot.u/1e6).toFixed(2)}M`)

console.log('\n✅ Done')
