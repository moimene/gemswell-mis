import { NextRequest, NextResponse } from 'next/server'
import { createApiClient } from '@/lib/supabase-server'
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
    const { id } = await params
    const supabase = createApiClient()

    const { data: doc, error: docErr } = await supabase
      .from('rag_documents').select(DETAIL_COLUMNS).eq('id', id).maybeSingle()
    if (docErr) return NextResponse.json({ error: docErr.message }, { status: 500 })
    if (!doc) return NextResponse.json({ error: 'document not found' }, { status: 404 })

    const [{ data: chunks }, { data: events }] = await Promise.all([
      supabase.from('rag_chunks').select('chunk_index, content, metadata')
        .eq('document_id', id).order('chunk_index', { ascending: true }),
      supabase.from('rag_document_events').select('*')
        .eq('document_id', id).order('created_at', { ascending: false }),
    ])

    const markdown = reconstructMarkdown((chunks ?? []).map(c => ({
      chunk_index: c.chunk_index as number, content: c.content as string,
    })))

    return NextResponse.json({
      document: doc,
      chunks: chunks ?? [],
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

const GOV_COLS = 'review_status, classification_source, status, authority_score, authority_tier, current_version, supersedes_document_id'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json() as PatchBody
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

    // Apply primary patch
    if (Object.keys(result.patch).length > 0) {
      const { error: upErr } = await supabase.from('rag_documents').update(result.patch).eq('id', id)
      if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })
    }
    // Apply related (superseded old doc) patch
    if (result.related) {
      const { error: relErr } = await supabase.from('rag_documents').update(result.related.patch).eq('id', result.related.id)
      if (relErr) return NextResponse.json({ error: relErr.message }, { status: 500 })
    }
    // Append-only events
    if (result.events.length > 0) {
      const { error: evErr } = await supabase.from('rag_document_events').insert(result.events)
      if (evErr) return NextResponse.json({ error: evErr.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, action: body.action, patch: result.patch, related: result.related ?? null })
  } catch (err: unknown) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
