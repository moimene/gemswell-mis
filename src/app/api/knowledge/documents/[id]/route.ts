import { NextRequest, NextResponse } from 'next/server'
import { createApiClient, requireUser } from '@/lib/supabase-server'
import { reconstructMarkdown } from '@/lib/knowledge/markdown-reconstruct'
import { computeGovernanceAction, InvalidTransitionError } from '@/lib/knowledge/governance-actions'
import type { DocGovernanceState, GovernanceAction, ReclassifyFields } from '@/lib/knowledge/contracts'

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Internal server error'
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
    if (docErr) return NextResponse.json({ error: docErr.message }, { status: 500 })
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
    const markdown = reconstructMarkdown(fetched.map(c => ({
      chunk_index: c.chunk_index as number, content: c.content as string,
    })))

    return NextResponse.json({
      document: doc,
      chunks: fetched,
      chunks_truncated: chunksTruncated,
      events: events ?? [],
      markdown: { source: doc.md_path ? 'artifact_path' : 'reconstructed', content: markdown },
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
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
    if (curErr) return NextResponse.json({ error: curErr.message }, { status: 500 })
    if (!current) return NextResponse.json({ error: 'document not found' }, { status: 404 })

    // supersede needs the old doc's state
    let supersede: { oldId: string; oldDoc: DocGovernanceState } | undefined
    if (body.action === 'supersede') {
      if (!body.supersedesId) return NextResponse.json({ error: 'supersedesId required' }, { status: 400 })
      const { data: oldDoc, error: oldErr } = await supabase
        .from('rag_documents').select(GOV_COLS).eq('id', body.supersedesId).maybeSingle()
      if (oldErr) return NextResponse.json({ error: oldErr.message }, { status: 500 })
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
      // 40001 version conflict, 23505 double-supersede, 22023 self-supersede, 40P01 deadlock — all retryable
      if (code === '40001' || code === '23505' || code === '22023' || code === '40P01')
        return NextResponse.json({ error: rpcErr.message }, { status: 409 })
      if (code === '22P02' || code === '23514') return NextResponse.json({ error: 'invalid field value' }, { status: 400 })
      return NextResponse.json({ error: rpcErr.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, action: body.action, patch: result.patch, related: result.related ?? null })
  } catch (err: unknown) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
