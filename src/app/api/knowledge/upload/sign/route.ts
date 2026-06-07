import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createApiClient, requireUser } from '@/lib/supabase-server'

// F3: large files (board packs, audited PDFs of 8-20MB) exceed Vercel's ~4.5MB request-body cap, so
// they can never reach a multipart handler. Instead the client uploads the raw file DIRECTLY to
// Supabase Storage via a signed upload URL (no function body involved), then calls /api/knowledge/upload
// with just the storage path. This endpoint mints that signed URL.

const ALLOWED_EXT = new Set(['.pdf', '.docx', '.xlsx', '.xls', '.csv', '.txt', '.pptx'])
const UPLOAD_BUCKET = process.env.KNOWLEDGE_ARTIFACT_BUCKET ?? 'documents'

export async function POST(request: NextRequest) {
  if (!(await requireUser())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let body: { fileName?: string }
  try {
    body = (await request.json()) as { fileName?: string }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const fileName = (body.fileName ?? '').trim()
  if (!fileName) return NextResponse.json({ error: 'Falta fileName' }, { status: 400 })

  const dot = fileName.lastIndexOf('.')
  const fileExt = dot >= 0 ? fileName.slice(dot).toLowerCase() : ''
  if (!ALLOWED_EXT.has(fileExt)) {
    return NextResponse.json(
      { error: `Tipo no soportado (${fileExt || 'sin extensión'}). Permitidos: ${[...ALLOWED_EXT].join(', ')}` },
      { status: 415 }
    )
  }

  // Namespaced, collision-free raw path. Keeps the original extension for content-type inference.
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120)
  const path = `uploads/${randomUUID()}/${safeName}`

  const supabase = createApiClient()
  const { data, error } = await supabase.storage.from(UPLOAD_BUCKET).createSignedUploadUrl(path)
  if (error || !data) {
    console.error('[upload/sign] createSignedUploadUrl failed:', error?.message)
    return NextResponse.json({ error: 'No se pudo preparar la subida' }, { status: 500 })
  }

  return NextResponse.json({ bucket: UPLOAD_BUCKET, path: data.path, token: data.token })
}
