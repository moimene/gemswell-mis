import type { Metadata } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import { Sidebar } from '@/components/layout/Sidebar'
import { TowerControlBanner } from '@/components/layout/TowerControlBanner'
import { TowerDataFooter } from '@/components/layout/TowerDataFooter'
import { Providers } from '@/components/providers'
import { Toaster } from 'sonner'

// The whole "financial terminal" aesthetic depends on a real mono for figures/labels.
// These feed the --font-geist-sans / --font-geist-mono vars the Tailwind theme references.
const inter = Inter({ subsets: ['latin'], variable: '--font-geist-sans' })
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-geist-mono' })

export const metadata: Metadata = {
  title: 'Gemswell MIS',
  description: 'Management Information System for Gemswell Ventures wave park portfolio',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${inter.variable} ${mono.variable} font-sans`}>
        <Providers>
          <div className="flex h-screen overflow-hidden">
            <Sidebar />
            <main className="flex-1 overflow-auto bg-slate-100 p-6">
              <TowerControlBanner />
              {children}
              <TowerDataFooter />
            </main>
          </div>
          <Toaster />
        </Providers>
      </body>
    </html>
  )
}
