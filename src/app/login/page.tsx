'use client'
import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { isAdminUser } from '@/lib/is-admin'
import { safeRedirectPath } from '@/lib/safe-redirect'
import { toast } from 'sonner'

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  // CWE-601/79: never feed an unvalidated redirect to router.replace (javascript: URLs execute in-origin)
  const redirectTo = safeRedirectPath(params.get('redirect'))
  const errorParam = params.get('error')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const supabase = createClient()

  // surface why a redirect bounced the user back here (expired magic link, or non-admin account)
  useEffect(() => {
    if (errorParam === 'link_invalid') toast.error('El enlace de acceso caducó o no es válido. Solicita uno nuevo.')
    else if (errorParam === 'not_admin') toast.error('Tu cuenta no tiene acceso de administrador.')
  }, [errorParam])

  async function signInPassword(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setBusy(false)
      toast.error(error.message)
      return
    }
    // A seeded account without the admin claim would authenticate but then be bounced by the
    // proxy back to /login on every navigation (a silent loop). Verify the claim here and stop.
    const { data: { user } } = await supabase.auth.getUser()
    if (!isAdminUser(user)) {
      await supabase.auth.signOut()
      setBusy(false)
      toast.error('Tu cuenta no tiene acceso de administrador.')
      return
    }
    setBusy(false)
    router.replace(redirectTo)
  }

  async function sendMagicLink() {
    if (!email) {
      toast.error('Introduce tu email')
      return
    }
    setBusy(true)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false, // CX-1: magic-link must NOT create accounts — only seeded admins log in
        emailRedirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirectTo)}`,
      },
    })
    setBusy(false)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Te enviamos un enlace de acceso. Revisa tu email.')
  }

  return (
    <form
      onSubmit={signInPassword}
      className="w-[360px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-md"
    >
      {/* ── BRAND HEADER ──────────────────────────────────────────────────── */}
      <div className="h-1 w-full bg-[#0B4A6F]" />
      <div className="space-y-4 p-7">
        <div>
          <p className="font-mono text-[10px] font-bold tracking-[0.2em] text-slate-400 uppercase">
            Gemswell Ventures · MIS
          </p>
          <h1 className="mt-1 text-[20px] font-bold tracking-tight text-slate-900">
            Acceso al panel
          </h1>
          <p className="mt-0.5 font-mono text-[11px] text-slate-500">
            Portfolio MAD · BHX
          </p>
        </div>

        <div className="space-y-1">
          <label
            htmlFor="login-email"
            className="font-mono text-[10px] font-bold tracking-widest text-slate-500 uppercase"
          >
            Email
          </label>
          <input
            id="login-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@empresa.com"
            className="w-full rounded border border-slate-300 px-3 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-[#0B4A6F] focus:ring-1 focus:ring-[#0B4A6F] focus:outline-none"
          />
        </div>

        <div className="space-y-1">
          <label
            htmlFor="login-password"
            className="font-mono text-[10px] font-bold tracking-widest text-slate-500 uppercase"
          >
            Contraseña
          </label>
          <input
            id="login-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full rounded border border-slate-300 px-3 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-[#0B4A6F] focus:ring-1 focus:ring-[#0B4A6F] focus:outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded bg-[#0B4A6F] py-2.5 text-sm font-medium text-white hover:bg-[#0a3f5e] disabled:opacity-50"
        >
          Entrar
        </button>

        <div className="pt-1">
          <button
            type="button"
            onClick={sendMagicLink}
            disabled={busy}
            className="w-full text-center font-mono text-[11px] text-slate-500 hover:text-slate-800 hover:underline disabled:opacity-50"
          >
            ¿Prefieres un enlace de acceso por email?
          </button>
        </div>
      </div>
    </form>
  )
}

export default function LoginPage() {
  return (
    <div className="fixed inset-0 z-50 flex min-h-screen items-center justify-center bg-slate-50">
      <Suspense
        fallback={
          <div className="w-[360px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-md">
            <div className="h-1 w-full bg-[#0B4A6F]" />
            <div className="p-7 text-center">
              <div className="font-mono text-[11px] tracking-wide text-slate-400 uppercase">
                Cargando…
              </div>
            </div>
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  )
}
