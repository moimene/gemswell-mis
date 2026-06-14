import { NextResponse } from 'next/server'
import { createApiClient, requireUser } from '@/lib/supabase-server'

// GET /api/chat/conversations — list the CURRENT user's conversations (most recent first). createApiClient
// is service-role (bypasses RLS), so the user_id filter is the ownership boundary — never list another
// admin's threads. user_id is keyed by email ?? id (same key persistConversation writes).
export async function GET() {
  try {
    const user = await requireUser()
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    const userKey = user.email ?? user.id
    const supabase = createApiClient()
    const { data, error } = await supabase
      .from('rag_conversations')
      .select('id, title, created_at, project_id')
      .eq('user_id', userKey)
      .order('created_at', { ascending: false })
      .limit(300)
    if (error) {
      console.error('[chat/conversations] list failed:', error.message)
      return NextResponse.json({ error: 'No se pudieron cargar las conversaciones.' }, { status: 500 })
    }
    return NextResponse.json({ conversations: data ?? [] })
  } catch (err) {
    console.error('[chat/conversations] GET error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
