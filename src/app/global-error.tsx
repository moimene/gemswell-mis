'use client'

import { useEffect } from 'react'

/** Last-resort boundary for errors thrown in the root layout itself. Must render its own
 *  <html>/<body>. Keeps a hard crash from becoming an unstyled browser error page. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('[global error]', error) }, [error])
  return (
    <html lang="es">
      <body>
        <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif' }}>
          <div style={{ maxWidth: 420, textAlign: 'center', padding: 24 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600 }}>Algo salió mal</h2>
            <p style={{ marginTop: 8, fontSize: 14, color: '#64748b' }}>
              La aplicación encontró un error inesperado.
            </p>
            <button
              onClick={() => reset()}
              style={{ marginTop: 16, borderRadius: 6, background: '#1e293b', color: '#fff', padding: '8px 16px', fontSize: 14, border: 'none', cursor: 'pointer' }}
            >
              Reintentar
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
