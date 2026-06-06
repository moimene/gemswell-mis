import { config } from 'dotenv'
config({ path: '.env.local' })
import { randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

// Run at cutover with SUPABASE_SERVICE_ROLE_KEY set. Emails via argv or the default list.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!key) { console.error('SUPABASE_SERVICE_ROLE_KEY required to seed admins'); process.exit(1) }
const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

const emails = process.argv.slice(2).length ? process.argv.slice(2) : ['moises.menendez@gmail.com']

function tempPassword(): string {
  // crypto-strong temp secret for full-access admin accounts (not Math.random)
  return 'Gw-' + randomBytes(18).toString('base64url') + '!'
}

async function main() {
  for (const email of emails) {
    const password = tempPassword()
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
    if (error) { console.error(`${email}: ${error.message}`); continue }
    console.log(`created ${email}  temp password: ${password}  (id ${data.user?.id}) — change it or use magic-link`)
  }
}
main().catch(e => { console.error(e); process.exit(1) })
