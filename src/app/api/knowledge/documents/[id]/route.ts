import { NextRequest, NextResponse } from 'next/server'
import { createApiClient, requireUser } from '@/lib/supabase-server'
import { reconstructMarkdown } from '@/lib/knowledge/markdown-reconstruct'
import { computeGovernanceAction, InvalidTransitionError } from '@/lib/knowledge/governance-actions'
import { canDeleteFailedDocument } from '@/lib/knowledge/failed-document-actions'
import type { DocGovernanceState, GovernanceAction, ReclassifyFields } from '@/lib/knowledge/contracts'

const ARTIFACT_BUCKET = process.env.KNOWLEDGE_ARTIFACT_BUCKET ?? 'documents'

// F11: log the real DB error server-side, return a generic message (never leak column/enum/constraint
// names to the client).
function internalError(context: string, err: unknown): NextResponse {
  console.error(`[knowledge/documents/:id] ${context}:`, err instanceof Error ? err.message : err)
  return NextResponse.json({ error: 'Error interno al procesar la solicitud.' }, { status: 500 })
}

const DETAIL_COLUMNS = `
  id, title, project_id, doc_type, period, lifecycle, review_status, review_reason,
  authority_score, authority_tier, classification_source, classification_confidence,
  status, source_channel, source_type, source_hash, external_id, storage_path, md_path, md_status,
  summary, topics, currency, entity_ids, chunk_count, current_version, supersedes_document_id,
  governance_backfilled_at, created_at
`

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await requireUser())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    const { id } = await params
    const supabase = createApiClient()

    const { data: doc, error: docErr } = await supabase
      .from('rag_documents').select(DETAIL_COLUMNS).eq('id', id).maybeSingle()
    if (docErr) return internalError('detail fetch', docErr)
    if (!doc) return NextResponse.json({ error: 'document not found' }, { status: 404 })

    // F8: cap the chunk fetch so a pathological doc (some have thousands of chunks) cannot
    // blow up the payload or memory. The panel only previews the first chunks anyway.
    const CHUNK_CAP = 1200
    const [{ data: chunks }, { data: events }] = await Promise.all([
      supabase.from('rag_chunks').select('chunk_index, content, metadata')
        .eq('document_id', id).order('chunk_index', { ascending: true }).limit(CHUNK_CAP),
      supabase.from('rag_document_events').select('*')
        .eq('document_id', id).order('created_at', { ascending: false }),
    ])

    const fetched = chunks ?? []
    const chunksTruncated = (doc.chunk_count ?? 0) > fetched.length
    const reconstructedMarkdown = reconstructMarkdown(fetched.map(c => ({
      chunk_index: c.chunk_index as number, content: c.content as string,
    })))
    let markdown = reconstructedMarkdown
    let markdownSource = doc.md_path ? 'artifact_unavailable' : 'reconstructed'
    if (doc.md_path) {
      const { data: mdBlob, error: mdErr } = await supabase.storage.from(ARTIFACT_BUCKET).download(doc.md_path as string)
      if (mdBlob && !mdErr) {
        markdown = await mdBlob.text()
        markdownSource = 'artifact_path'
      } else {
        console.warn(`[knowledge/documents/:id] markdown artifact unavailable for ${id}:`, mdErr?.message)
      }
    }

    return NextResponse.json({
      document: doc,
      chunks: fetched,
      chunks_truncated: chunksTruncated,
      events: events ?? [],
      markdown: { source: markdownSource, content: markdown },
    })
  } catch (err: unknown) {
    return internalError('handler', err)
  }
}

type PatchBody = {
  action: GovernanceAction
  fields?: ReclassifyFields
  supersedesId?: string   // old doc this one replaces
  reason?: string
  actor?: string
}

const GOV_COLS = 'review_status, classification_source, status, authority_score, authority_tier, current_version, supersedes_document_id, doc_type, project_id, period, lifecycle'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await requireUser())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    const { id } = await params
    // F13: a malformed JSON body is a client error, not a 500.
    let body: PatchBody
    try {
      body = await request.json() as PatchBody
    } catch {
      return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
    }
    const actor = body.actor?.trim() || 'admin:console'
    if (!body.action) return NextResponse.json({ error: 'action required' }, { status: 400 })

    const supabase = createApiClient()
    const { data: current, error: curErr } = await supabase
      .from('rag_documents').select(GOV_COLS).eq('id', id).maybeSingle()
    if (curErr) return internalError('governance fetch', curErr)
    if (!current) return NextResponse.json({ error: 'document not found' }, { status: 404 })

    // supersede needs the old doc's state
    let supersede: { oldId: string; oldDoc: DocGovernanceState } | undefined
    if (body.action === 'supersede') {
      if (!body.supersedesId) return NextResponse.json({ error: 'supersedesId required' }, { status: 400 })
      const { data: oldDoc, error: oldErr } = await supabase
        .from('rag_documents').select(GOV_COLS).eq('id', body.supersedesId).maybeSingle()
      if (oldErr) return internalError('supersede fetch', oldErr)
      if (!oldDoc) return NextResponse.json({ error: 'superseded document not found' }, { status: 404 })
      supersede = { oldId: body.supersedesId, oldDoc: oldDoc as unknown as DocGovernanceState }
    }

    let result
    try {
      result = computeGovernanceAction({
        action: body.action, documentId: id, current: current as unknown as DocGovernanceState,
        actor, reason: body.reason, fields: body.fields, supersede,
      })
    } catch (e) {
      if (e instanceof InvalidTransitionError) return NextResponse.json({ error: e.message }, { status: 409 })
      throw e
    }

    // F1: apply the primary patch, the optional related (superseded) patch, and the audit events
    // in ONE transaction via the governance RPC — with an optimistic version check and a
    // double-supersede guard. Replaces the previous 3 separate non-transactional writes.
    const { error: rpcErr } = await supabase.rpc('apply_document_governance', {
      p_doc_id: id,
      p_patch: result.patch,
      p_expected_version: (current as { current_version: number }).current_version,
      p_related_id: result.related?.id ?? null,
      p_related_patch: result.related?.patch ?? {},
      p_events: result.events,
    })
    if (rpcErr) {
      const code = (rpcErr as { code?: string }).code
      if (code === 'P0002') return NextResponse.json({ error: 'document not found' }, { status: 404 })
      // Conflicts (retryable) get a clean, user-facing message instead of the raw RAISE text (F11).
      if (code === '40001') return NextResponse.json({ error: 'El documento cambió mientras lo editabas. Recarga e inténtalo de nuevo.' }, { status: 409 })
      if (code === '23505') return NextResponse.json({ error: 'Ese documento ya ha sido sustituido.' }, { status: 409 })
      if (code === '22023') return NextResponse.json({ error: 'Un documento no puede sustituirse a sí mismo.' }, { status: 409 })
      if (code === '40P01') return NextResponse.json({ error: 'Conflicto temporal de concurrencia. Inténtalo de nuevo.' }, { status: 409 })
      if (code === '22P02' || code === '23514') return NextResponse.json({ error: 'invalid field value' }, { status: 400 })
      return internalError('governance rpc', rpcErr)
    }

    return NextResponse.json({ ok: true, action: body.action, patch: result.patch, related: result.related ?? null })
  } catch (err: unknown) {
    return internalError('handler', err)
  }
}

const DELETE_COLUMNS = 'id, title, status, storage_path, md_path'

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await requireUser())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    const { id } = await params
    const supabase = createApiClient()

    const { data: doc, error: docErr } = await supabase
      .from('rag_documents')
      .select(DELETE_COLUMNS)
      .eq('id', id)
      .maybeSingle()
    if (docErr) return internalError('delete fetch', docErr)
    if (!doc) return NextResponse.json({ error: 'document not found' }, { status: 404 })

    const allowed = canDeleteFailedDocument(doc)
    if (!allowed.ok) {
      return NextResponse.json({ error: allowed.reason }, { status: allowed.reason === 'document not found' ? 404 : 409 })
    }

    const chunkDelete = await supabase.from('rag_chunks').delete().eq('document_id', id)
    if (chunkDelete.error) return internalError('delete chunks', chunkDelete.error)
    const eventDelete = await supabase.from('rag_document_events').delete().eq('document_id', id)
    if (eventDelete.error) return internalError('delete events', eventDelete.error)
    const docDelete = await supabase.from('rag_documents').delete().eq('id', id).eq('status', 'error')
    if (docDelete.error) return internalError('delete document', docDelete.error)

    const paths = [doc.storage_path, doc.md_path].filter((p): p is string => typeof p === 'string' && p.length > 0)
    if (paths.length > 0) {
      const removed = await supabase.storage.from(ARTIFACT_BUCKET).remove(paths)
      if (removed.error) console.warn(`[knowledge/documents/:id] failed document storage cleanup skipped for ${id}:`, removed.error.message)
    }

    return NextResponse.json({ ok: true, deleted: true })
  } catch (err: unknown) {
    return internalError('delete handler', err)
  }
}
