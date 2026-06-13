import { NextRequest, NextResponse } from 'next/server'
import { createApiClient, requireUser } from '@/lib/supabase-server'
import { ingestBuffer, errorMessage, reapStrandedDocuments } from '@/lib/ingest/queue-processor'

// Single-document governed ingest runs synchronously (parse -> classify -> chunk -> embed -> index),
// so give it room. Vercel Pro/fluid allows up to 800s.
export const maxDuration = 800

const MAX_BYTES = 50 * 1024 * 1024 // 50 MB (direct-to-Storage path; the old 4.5MB function-body cap no longer applies)
const ALLOWED_EXT = new Set(['.pdf', '.docx', '.xlsx', '.xls', '.csv', '.txt', '.pptx'])
const PROJECTS = new Set(['MAD', 'BHX', 'KLP', 'PHILAE', 'GVF', 'ETP'])
const UPLOAD_BUCKET = process.env.KNOWLEDGE_ARTIFACT_BUCKET ?? 'documents'

function extOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  return dot >= 0 ? fileName.slice(dot).toLowerCase() : ''
}

/**
 * POST /api/knowledge/upload
 *  - JSON  { storagePath, fileName, project_id?, doc_type? } → download the raw file the client already
 *    PUT to Storage (via /api/knowledge/upload/sign) and ingest it. This is the path for real
 *    board-pack-sized PDFs that exceed Vercel's request-body cap (F3).
 *  - multipart { file, project_id?, doc_type? } → legacy small-file path (kept for convenience).
 */
export async function POST(request: NextRequest) {
  try {
    if (!(await requireUser())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    const supabase = createApiClient()

    // F15: opportunistically clear any docs stranded in 'processing' by a previously killed ingest.
    reapStrandedDocuments(supabase).catch(() => undefined)

    const contentType = request.headers.get('content-type') ?? ''
    let fileName: string
    let fileExt: string
    let buffer: Buffer
    let projectRaw: string | null
    let docTypeHint: string | null
    let rawStoragePath: string | null = null

    if (contentType.includes('application/json')) {
      // ── direct-to-Storage path (large files) ──────────────────────────
      const body = (await request.json().catch(() => null)) as
        | { storagePath?: string; fileName?: string; project_id?: string; doc_type?: string }
        | null
      if (!body?.storagePath || !body.fileName) {
        return NextResponse.json({ error: 'Faltan storagePath/fileName' }, { status: 400 })
      }
      // CX-2: only ingest objects from the signed-upload namespace (uploads/<uuid>/…), never an
      // arbitrary object in the shared bucket (artifacts/, other docs, …).
      if (!/^uploads\/[0-9a-fA-F-]{36}\/[^/]+$/.test(body.storagePath)) {
        return NextResponse.json({ error: 'storagePath inválido' }, { status: 400 })
      }
      fileName = body.fileName
      fileExt = extOf(fileName)
      if (!ALLOWED_EXT.has(fileExt)) {
        return NextResponse.json({ error: `Tipo no soportado (${fileExt || 'sin extensión'})` }, { status: 415 })
      }
      const { data: blob, error: dlErr } = await supabase.storage.from(UPLOAD_BUCKET).download(body.storagePath)
      if (dlErr || !blob) {
        return NextResponse.json({ error: 'No se encontró el archivo subido en Storage' }, { status: 400 })
      }
      buffer = Buffer.from(await blob.arrayBuffer())
      rawStoragePath = body.storagePath
      projectRaw = body.project_id?.trim() || null
      docTypeHint = body.doc_type?.trim() || null
    } else {
      // ── legacy multipart path (small files) ───────────────────────────
      const form = await request.formData().catch(() => null)
      const file = form?.get('file')
      if (!form || !(file instanceof File)) {
        return NextResponse.json({ error: 'Falta el archivo (campo "file")' }, { status: 400 })
      }
      if (file.size === 0) return NextResponse.json({ error: 'El archivo está vacío' }, { status: 400 })
      fileName = file.name
      fileExt = extOf(fileName)
      if (!ALLOWED_EXT.has(fileExt)) {
        return NextResponse.json({ error: `Tipo no soportado (${fileExt || 'sin extensión'})` }, { status: 415 })
      }
      buffer = Buffer.from(await file.arrayBuffer())
      projectRaw = (form.get('project_id') as string | null)?.trim() || null
      docTypeHint = (form.get('doc_type') as string | null)?.trim() || null
    }

    if (buffer.length === 0) return NextResponse.json({ error: 'El archivo está vacío' }, { status: 400 })
    if (buffer.length > MAX_BYTES) {
      return NextResponse.json({ error: `El archivo supera el límite de ${MAX_BYTES / 1024 / 1024} MB` }, { status: 413 })
    }
    const projectId = projectRaw && PROJECTS.has(projectRaw) ? projectRaw : null

    const result = await ingestBuffer(supabase, {
      fileName,
      fileExt,
      buffer,
      projectId,
      docTypeHint,
      rawStoragePath,
      sourceChannel: 'browser_upload',
    })

    if (result.status === 'error') {
      // CX-6: only surface curated, user-safe messages; log the rest and return a generic reason so DB/
      // parser/bucket internals never reach the client.
      console.error('[knowledge/upload] ingest failed:', result.error)
      const raw = result.error ?? ''
      const userSafe = /^(El documento parece escaneado|El archivo|Tipo no soportado|No se generaron)/.test(raw)
      return NextResponse.json(
        { error: userSafe ? raw : 'No se pudo procesar el documento (formato no soportado o contenido ilegible).', file: fileName },
        { status: 422 }
      )
    }
    return NextResponse.json({
      ok: true,
      file: fileName,
      documentId: result.documentId,
      chunks: result.chunks,
      parser: result.parser,
      reused: result.reused ?? false,
      duplicateTitleCount: result.duplicateTitleCount ?? 0,
    })
  } catch (err: unknown) {
    // CX-6: log the real error, return a generic message (never leak internals).
    console.error('Upload API error:', errorMessage(err))
    return NextResponse.json({ error: 'Error interno al subir el documento.' }, { status: 500 })
  }
}
