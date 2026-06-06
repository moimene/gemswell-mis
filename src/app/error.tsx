'use client'

import { useEffect } from 'react'

/** Route-level error boundary. Catches render/throw in any page (e.g. a component reading
 *  fields off a 401 body) and shows a branded recoverable card instead of a white screen. */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // surface to the console for debugging; never show raw error text to the user
    console.error('[route error]', error)
  }, [error])

  return (
    <div className="flex h-full min-h-[60vh] items-center justify-center p-6">
      <div className="w-full max-w-md rounded-lg border bg-white p-6 text-center shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Algo salió mal</h2>
        <p className="mt-2 text-sm text-slate-500">
          No pudimos cargar esta sección. Si el problema persiste, vuelve a iniciar sesión.
        </p>
        <div className="mt-4 flex justify-center gap-2">
          <button
            onClick={() => reset()}
            className="rounded bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Reintentar
          </button>
          <a
            href="/login"
            className="rounded border px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Iniciar sesión
          </a>
        </div>
      </div>
    </div>
  )
}
