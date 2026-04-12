import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

// Check dim_funding_instrument columns + existing MAD instruments
const {data:dim,error:de} = await sb.from('dim_funding_instrument').select('*').like('instrument_id','MAD%')
console.log('dim_funding_instrument MAD rows:', JSON.stringify(dim,null,2))
if (de) console.log('ERR:', de.message)

// Check intel_contradiction_alert columns
const {data:ca,error:ce} = await sb.from('intel_contradiction_alert').select('*').limit(1)
console.log('intel_contradiction_alert cols:', ca?.[0] ? Object.keys(ca[0]) : ce?.message)
