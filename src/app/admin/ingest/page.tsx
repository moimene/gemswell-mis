'use client'
import { useState } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/shared/terminal'
import { UploadPanel } from '@/app/admin/documents/_components/UploadPanel'
import { Info, ArrowRight, FileInput, FileCheck2 } from 'lucide-react'

// Ingesta documental (UX refactor §8). Solo ENCOLA documentos generales en el corpus (mismo motor que
// la subida de la Biblioteca: parse → clasificación → embeddings → needs_review). NO aprueba ni
// publica métricas — eso ocurre después en el Centro de revisión. Sin botón "Procesar ahora" (§21):
// la ingesta es asíncrona y la revisión es un paso aparte.

export default function IngestaPage() {
  // Re-key the panel after a successful upload so the form resets cleanly for the next document.
  const [round, setRound] = useState(0)

  return (
    <div className="space-y-4 p-6">
      <PageHeader
        eyebrow="Gemswell Ventures · MIS · Documentos & Reporting"
        title="Ingesta documental"
        subtitle="Encola documentos para incorporarlos al corpus. La revisión y publicación se hacen después."
      />

      {/* Aviso fijo (§8.3) */}
      <div className="flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2.5 text-sm text-sky-900">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
        <p>Esta pantalla <strong>no aprueba documentos ni publica métricas</strong>. Solo prepara documentos para revisión. Cada documento queda en estado <em>sin revisar</em> y pasa al <Link href="/admin/review" className="font-medium underline">Centro de revisión</Link>.</p>
      </div>

      {/* Qué entra / Qué sale */}
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-widest text-slate-500"><FileInput className="h-4 w-4" /> Qué entra</div>
          <ul className="space-y-1 text-sm text-slate-600">
            <li>· Documentos sueltos (PDF, DOCX, XLSX, TXT…)</li>
            <li>· XLS no asociados a un pack</li>
            <li>· Contratos, actas, modelos</li>
            <li>· Evidencias complementarias</li>
          </ul>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-widest text-slate-500"><FileCheck2 className="h-4 w-4" /> Qué sale</div>
          <ul className="space-y-1 text-sm text-slate-600">
            <li>· Documento en el corpus, sin revisar</li>
            <li>· Pendiente de revisión documental</li>
            <li>· Métricas candidatas, si aplica</li>
            <li>· Disponible para el Chat tras aprobarse</li>
          </ul>
        </div>
      </div>

      {/* Motor de subida (mismo que la Biblioteca) */}
      <UploadPanel key={round} onClose={() => setRound(r => r + 1)} onUploaded={() => setRound(r => r + 1)} />

      <div className="flex items-center gap-3 text-sm">
        <Link href="/admin/review" className="inline-flex items-center gap-1 font-medium text-slate-700 hover:text-slate-900">
          Ir al Centro de revisión <ArrowRight className="h-4 w-4" />
        </Link>
        <span className="text-slate-300">·</span>
        <Link href="/admin/documents" className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900">
          Ver Biblioteca documental <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  )
}
