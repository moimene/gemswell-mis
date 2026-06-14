import { NextRequest, NextResponse } from 'next/server'
import { createApiClient, requireUser } from '@/lib/supabase-server'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// GET /api/chat/conversations/:id — the messages of one conversation the caller OWNS (user_id guard,
// since createApiClient is service-role). Returns 404 for a missing OR not-owned id (no existence leak).
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    const { id } = await params
    if (!UUID_RE.test(id)) return NextResponse.json({ error: 'not found' }, { status: 404 })
    const userKey = user.email ?? user.id
    const supabase = createApiClient()

    const { data: conv } = await supabase
      .from('rag_conversations').select('id, title, created_at')
      .eq('id', id).eq('user_id', userKey).maybeSingle()
    if (!conv) return NextResponse.json({ error: 'not found' }, { status: 404 })

    const { data: messages, error } = await supabase
      .from('rag_messages').select('role, content, sources, tool_calls, created_at')
      .eq('conversation_id', id).order('created_at', { ascending: true })
    if (error) {
      console.error('[chat/conversations/:id] messages failed:', error.message)
      return NextResponse.json({ error: 'No se pudo cargar la conversación.' }, { status: 500 })
    }
    return NextResponse.json({ conversation: conv, messages: messages ?? [] })
  } catch (err) {
    console.error('[chat/conversations/:id] GET error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/chat/conversations/:id — delete a conversation the caller owns (+ its messages).
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    const { id } = await params
    if (!UUID_RE.test(id)) return NextResponse.json({ error: 'not found' }, { status: 404 })
    const userKey = user.email ?? user.id
    const supabase = createApiClient()

    const { data: conv } = await supabase
      .from('rag_conversations').select('id').eq('id', id).eq('user_id', userKey).maybeSingle()
    if (!conv) return NextResponse.json({ error: 'not found' }, { status: 404 })

    // delete messages first (explicit — robust whether or not an ON DELETE CASCADE FK exists).
    const delMsgs = await supabase.from('rag_messages').delete().eq('conversation_id', id)
    if (delMsgs.error) {
      console.error('[chat/conversations/:id] delete messages failed:', delMsgs.error.message)
      return NextResponse.json({ error: 'No se pudo eliminar la conversación.' }, { status: 500 })
    }
    const delConv = await supabase.from('rag_conversations').delete().eq('id', id).eq('user_id', userKey)
    if (delConv.error) {
      console.error('[chat/conversations/:id] delete conversation failed:', delConv.error.message)
      return NextResponse.json({ error: 'No se pudo eliminar la conversación.' }, { status: 500 })
    }
    return NextResponse.json({ deleted: true })
  } catch (err) {
    console.error('[chat/conversations/:id] DELETE error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
