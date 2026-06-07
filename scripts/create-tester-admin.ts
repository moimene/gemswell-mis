import { config } from 'dotenv'
config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'

// Create (or reset) a full-access admin account for testers.
// Mirrors scripts/seed-admins.ts but takes an explicit password so a known
// credential can be handed to testers. Idempotent: if the email already
// exists, it resets the password + re-asserts the admin claim instead of failing.
//
// Usage: tsx scripts/create-tester-admin.ts <email> <password>
// Requires SUPABASE_SERVICE_ROLE_KEY in .env.local.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!key) { console.error('SUPABASE_SERVICE_ROLE_KEY required'); process.exit(1) }

const email = process.argv[2]
const password = process.argv[3]
if (!email || !password) {
  console.error('Usage: tsx scripts/create-tester-admin.ts <email> <password>')
  process.exit(1)
}
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { console.error(`Invalid email: ${email}`); process.exit(1) }

const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

async function findUserId(target: string): Promise<string | undefined> {
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) { console.error(error.message); process.exit(1) }
    const u = data.users.find(u => u.email?.toLowerCase() === target.toLowerCase())
    if (u) return u.id
    if (data.users.length < 200) return undefined
  }
  return undefined
}

async function main() {
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
    app_metadata: { role: 'admin' }, // the claim proxy/requireUser/RLS (sql/013) gate on
  })
  if (!error) {
    const role = data.user?.app_metadata?.role
    const ok = role === 'admin' ? 'role=admin ✓' : `role=${role} ⚠️ NOT admin`
    console.log(`CREATED ${email}  (id ${data.user?.id}, ${ok})`)
    return
  }
  if (/already|exists|registered/i.test(error.message)) {
    const id = await findUserId(email)
    if (!id) { console.error(`${email} reported as existing but not found via listUsers`); process.exit(1) }
    const { data: upd, error: updErr } = await admin.auth.admin.updateUserById(id, {
      password, email_confirm: true, app_metadata: { role: 'admin' },
    })
    if (updErr) { console.error(`${email}: ${updErr.message}`); process.exit(1) }
    const role = upd.user?.app_metadata?.role
    const ok = role === 'admin' ? 'role=admin ✓' : `role=${role} ⚠️ NOT admin`
    console.log(`UPDATED ${email}  (id ${upd.user?.id}, ${ok}) — password reset + admin claim re-asserted`)
    return
  }
  console.error(`${email}: ${error.message}`)
  process.exit(1)
}
main().catch(e => { console.error(e); process.exit(1) })
