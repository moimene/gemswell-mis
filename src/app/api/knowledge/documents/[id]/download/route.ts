import { NextRequest, NextResponse } from 'next/server'
import { createApiClient, requireUser } from '@/lib/supabase-server'

// Fase 5 / WS5-T1 — signed download of a document's ORIGINAL artifact, so a chat citation can open the
// real PDF (admin-only). Redirects (302) to a short-lived signed Storage URL; the browser re-applies the
// request's `#page=N` fragment to the redirect target, so `…/download#page=5` opens the PDF at page 5.
// Only the original bytes (storage_path) are served — a doc without them (legacy corpus) returns 404 and
// the chat UI falls back to its gestor link (the md artifact is not page-anchorable, so it's not served).

const BUCKET = process.env.KNOWLEDGE_ARTIFACT_BUCKET ?? 'documents'
const SIGNED_TTL_SECONDS = 300

function fallbackNameFromPath(path: string): string {
  return path.split('/').pop() || 'document'
}

function safeDownloadName(title: unknown, path: string): string {
  const name = typeof title === 'string' && title.trim() ? title.trim() : fallbackNameFromPath(path)
  return name
    .replace(/[\\/:*?"<>|\r\n]+/g, '_')
    .replace(/\s+/g, ' ')
    .slice(0, 180) || 'document'
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireUser())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { id } = await params

  const supabase = createApiClient()
  const { data: doc, error } = await supabase
    .from('rag_documents').select('storage_path, title').eq('id', id).maybeSingle()
  if (error) return NextResponse.json({ error: 'lookup failed' }, { status: 500 })
  if (!doc) return NextResponse.json({ error: 'document not found' }, { status: 404 })

  const path = doc.storage_path as string | null
  if (!path) {
    // No original bytes in Storage (legacy corpus): the UI uses the gestor view instead.
    return NextResponse.json({ error: 'no original artifact stored for this document' }, { status: 404 })
  }

  const forceDownload = request.nextUrl.searchParams.get('download') === '1'
  const { data: signed, error: signErr } = await supabase.storage.from(BUCKET).createSignedUrl(
    path,
    SIGNED_TTL_SECONDS,
    forceDownload ? { download: safeDownloadName(doc.title, path) } : undefined
  )
  if (signErr || !signed?.signedUrl) {
    console.error('[documents/download] createSignedUrl failed:', signErr?.message)
    return NextResponse.json({ error: 'could not sign download' }, { status: 500 })
  }
  // 302 → signed URL; the original request's #page=N fragment carries over to the opened file.
  return NextResponse.redirect(signed.signedUrl, 302)
}
