'use client'
import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { safeRedirectPath } from '@/lib/safe-redirect'
import { toast } from 'sonner'

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  // CWE-601/79: never feed an unvalidated redirect to router.replace (javascript: URLs execute in-origin)
  const redirectTo = safeRedirectPath(params.get('redirect'))
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const supabase = createClient()

  async function signInPassword(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (error) {
      toast.error(error.message)
      return
    }
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
    <form onSubmit={signInPassword} className="w-80 space-y-3 rounded-lg border bg-white p-6 shadow">
      <h1 className="text-lg font-bold text-slate-900">Gemswell MIS</h1>
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="email"
        className="w-full rounded border px-3 py-2 text-sm"
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="contraseña"
        className="w-full rounded border px-3 py-2 text-sm"
      />
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded bg-slate-800 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        Entrar
      </button>
      <button
        type="button"
        onClick={sendMagicLink}
        disabled={busy}
        className="w-full rounded border py-2 text-sm disabled:opacity-50"
      >
        Enviar enlace mágico
      </button>
    </form>
  )
}

export default function LoginPage() {
  return (
    <div className="fixed inset-0 z-50 flex min-h-screen items-center justify-center bg-slate-100">
      <Suspense fallback={<div className="text-sm text-slate-500">Cargando…</div>}>
        <LoginForm />
      </Suspense>
    </div>
  )
}
