import { config } from 'dotenv'
config({ path: '.env.local' })
import { randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

// Run at cutover with SUPABASE_SERVICE_ROLE_KEY set. Pass admin emails explicitly as args.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!key) { console.error('SUPABASE_SERVICE_ROLE_KEY required to seed admins'); process.exit(1) }
const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

// No hardcoded default — seeding a single personal account silently is a lockout risk.
const force = process.argv.includes('--force')
const emails = process.argv.slice(2).filter(a => a !== '--force')
if (emails.length === 0) {
  console.error('Usage: tsx scripts/seed-admins.ts <email> <email> [...]   (pass admin emails explicitly)')
  process.exit(1)
}
const badEmails = emails.filter(e => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e))
if (badEmails.length) { console.error('Invalid email(s): ' + badEmails.join(', ')); process.exit(1) }
if (emails.length < 2 && !force) {
  console.error(`Refusing to seed a single admin (${emails[0]}): no break-glass account, and there is no password-reset UI yet. Pass ≥2 emails, or --force to override.`)
  process.exit(1)
}

function tempPassword(): string {
  // crypto-strong temp secret for full-access admin accounts (not Math.random)
  return 'Gw-' + randomBytes(18).toString('base64url') + '!'
}

async function main() {
  for (const email of emails) {
    const password = tempPassword()
    const { data, error } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
      app_metadata: { role: 'admin' }, // CX-1: the claim the proxy/requireUser/RLS gate on
    })
    if (error) { console.error(`${email}: ${error.message}`); continue }
    // Confirm the admin claim actually landed (this is what proxy/requireUser/RLS gate on).
    const role = data.user?.app_metadata?.role
    const ok = role === 'admin' ? 'role=admin ✓' : `role=${role} ⚠️ NOT admin`
    console.log(`created ${email}  temp password: ${password}  (id ${data.user?.id}, ${ok}) — change it or use magic-link`)
  }
}
main().catch(e => { console.error(e); process.exit(1) })
