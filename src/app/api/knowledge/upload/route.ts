import { NextRequest, NextResponse } from 'next/server'
import { createApiClient, requireUser } from '@/lib/supabase-server'
import { ingestBuffer, errorMessage } from '@/lib/ingest/queue-processor'

// Single-document upload + governed ingest runs synchronously (parse -> classify -> chunk ->
// embed -> index), so give it room. Vercel Pro/fluid allows up to 800s.
export const maxDuration = 800

const MAX_BYTES = 25 * 1024 * 1024 // 25 MB
const ALLOWED_EXT = new Set(['.pdf', '.docx', '.xlsx', '.xls', '.csv', '.txt', '.pptx'])
const PROJECTS = new Set(['MAD', 'BHX', 'KLP', 'PHILAE', 'GVF', 'ETP'])

/** POST /api/knowledge/upload — multipart form: file, project_id?, doc_type? */
export async function POST(request: NextRequest) {
  try {
    if (!(await requireUser())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const form = await request.formData().catch(() => null)
    const file = form?.get('file')
    if (!form || !(file instanceof File)) {
      return NextResponse.json({ error: 'Falta el archivo (campo "file")' }, { status: 400 })
    }
    if (file.size === 0) return NextResponse.json({ error: 'El archivo está vacío' }, { status: 400 })
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: `El archivo supera el límite de ${MAX_BYTES / 1024 / 1024} MB` }, { status: 413 })
    }

    const fileName = file.name
    const dot = fileName.lastIndexOf('.')
    const fileExt = dot >= 0 ? fileName.slice(dot).toLowerCase() : ''
    if (!ALLOWED_EXT.has(fileExt)) {
      return NextResponse.json(
        { error: `Tipo no soportado (${fileExt || 'sin extensión'}). Permitidos: ${[...ALLOWED_EXT].join(', ')}` },
        { status: 415 }
      )
    }

    const projectRaw = (form.get('project_id') as string | null)?.trim() || null
    const projectId = projectRaw && PROJECTS.has(projectRaw) ? projectRaw : null
    const docTypeHint = (form.get('doc_type') as string | null)?.trim() || null

    const buffer = Buffer.from(await file.arrayBuffer())
    const supabase = createApiClient()

    const result = await ingestBuffer(supabase, { fileName, fileExt, buffer, projectId, docTypeHint })

    if (result.status === 'error') {
      return NextResponse.json({ error: result.error || 'Fallo al procesar el documento', file: fileName }, { status: 422 })
    }
    return NextResponse.json({
      ok: true,
      file: fileName,
      documentId: result.documentId,
      chunks: result.chunks,
      parser: result.parser,
      reused: result.reused ?? false,
    })
  } catch (err: unknown) {
    console.error('Upload API error:', err)
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 })
  }
}
