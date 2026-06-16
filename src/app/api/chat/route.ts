import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createApiClient, requireUser } from '@/lib/supabase-server'
import {
  SYSTEM_PROMPT,
  systemPromptForGrounding,
  chooseChatModel,
  detectEntities,
  CHAT_VERIFIER_MODEL,
  CHAT_VERIFIER_ENABLED,
  type Source,
  type ToolCallAudit,
} from '@/lib/chat/agent'
import { runAgentLoopResilient, verifyAnswerResilient, type Provider } from '@/lib/chat/agent-gemini'
import type { GroundingMode } from '@/lib/rag/retrieve'

export const maxDuration = 800

type Message = { role: 'user' | 'assistant'; content: string }
const GROUNDING_MODES = new Set<GroundingMode>(['standard', 'trusted_only', 'official_only'])

function isMissingProviderColumns(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  return error.code === 'PGRST204' || /column.*(provider|fallback|model)|(provider|fallback|model).*column/i.test(error.message ?? '')
}

// ─── Persistence (ownership-checked, F7) ─────────────────────────────
async function persistConversation(
  user: { id: string; email?: string | null },
  conversationId: string | undefined,
  query: string,
  answer: string,
  sources: Source[],
  toolCalls: ToolCallAudit[],
  meta: { provider: Provider; model: string; fallback: boolean }
): Promise<{ convId?: string; persisted: boolean }> {
  const supabase = createApiClient()
  const userKey = user.email ?? user.id
  let convId = conversationId

  // Ownership check: never append to a conversation the caller does not own (client supplies the id).
  // If the supplied id is missing or owned by someone else, silently start a fresh conversation
  // rather than 403-leaking its existence or writing into another admin's thread.
  if (convId) {
    const { data: owned, error: ownErr } = await supabase
      .from('rag_conversations')
      .select('id')
      .eq('id', convId)
      .eq('user_id', userKey)
      .maybeSingle()
    if (ownErr || !owned) convId = undefined
  }

  if (!convId) {
    const { data: conv, error: convErr } = await supabase
      .from('rag_conversations')
      .insert({ title: query.slice(0, 100), user_id: userKey })
      .select('id')
      .single()
    if (convErr || !conv) {
      console.error('[chat] failed to create conversation:', convErr)
      return { convId: undefined, persisted: false }
    }
    convId = conv.id
  }

  const legacyRows = [
    { conversation_id: convId, role: 'user', content: query, sources: null },
    {
      conversation_id: convId,
      role: 'assistant',
      content: answer,
      sources: sources.map(s => ({
        chunk_id: s.id,
        document_id: s.documentId ?? null,
        relevance: s.relevance,
        label: s.label,
        verification: s.verification,
        metadata: s.metadata,
        preview: s.preview ?? null, // persist the snippet so a restored conversation shows source previews
      })),
      tool_calls: toolCalls,
    },
  ]
  const { error: insErr } = await supabase.from('rag_messages').insert([
    { conversation_id: convId, role: 'user', content: query, sources: null, provider: null, model: null, fallback: null },
    {
      conversation_id: convId,
      role: 'assistant',
      content: answer,
      provider: meta.provider,
      model: meta.model,
      fallback: meta.fallback,
      sources: sources.map(s => ({
        chunk_id: s.id,
        document_id: s.documentId ?? null,
        relevance: s.relevance,
        label: s.label,
        verification: s.verification,
        metadata: s.metadata,
        preview: s.preview ?? null, // persist the snippet so a restored conversation shows source previews
      })),
      tool_calls: toolCalls,
    },
  ])
  if (insErr) {
    if (isMissingProviderColumns(insErr)) {
      const retry = await supabase.from('rag_messages').insert(legacyRows)
      if (!retry.error) return { convId, persisted: true }
    }
    // The audit trail is load-bearing for financial advice — surface the failure, don't swallow it.
    console.error('[chat] failed to persist messages:', insErr)
    return { convId, persisted: false }
  }
  return { convId, persisted: true }
}

// ─── Main Chat Handler (SSE streaming, F4) ───────────────────────────
// We do NOT stream answer tokens (decision D2-A): the evidence verifier rewrites the COMPLETE draft,
// so showing unverified tokens then retracting them is exactly the failure an audit assistant must
// avoid. Instead we stream a rich PROGRESS channel (searching → drafting → verifying, with a
// heartbeat + elapsed timer) so the ~2-min wait is never a silent blank, and emit the verified
// answer only in the terminal `final` event. The agent machinery lives in @/lib/chat/agent.
export async function POST(request: NextRequest) {
  const user = await requireUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let body: { messages?: Message[]; conversationId?: string; groundingMode?: GroundingMode }
  try {
    body = (await request.json()) as { messages?: Message[]; conversationId?: string }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const { messages, conversationId } = body
  const groundingMode = GROUNDING_MODES.has(body.groundingMode as GroundingMode) ? body.groundingMode as GroundingMode : 'standard'
  if (!messages?.length) {
    return NextResponse.json({ error: 'No messages provided' }, { status: 400 })
  }
  const lastUserMessage = messages.filter(m => m.role === 'user').pop()
  if (!lastUserMessage) {
    return NextResponse.json({ error: 'No user message found' }, { status: 400 })
  }

  const query = lastUserMessage.content
  const entities = detectEntities(query) // for UI entity badges only
  const chatModel = chooseChatModel(query)
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
  const historyMessages: Anthropic.MessageParam[] = messages.slice(-10).map(m => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }))

  // Abort plumbing: a client disconnect cancels the in-flight Anthropic calls (saves cost, F12).
  const abort = new AbortController()
  request.signal?.addEventListener('abort', () => abort.abort())

  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false
      const send = (event: string, data: unknown) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
        } catch { /* controller already closed */ }
      }
      const startedAt = Date.now()
      let stage = 'searching'
      const setStage = (s: string, detail?: string) => {
        stage = s
        send('progress', { stage: s, detail, elapsedMs: Date.now() - startedAt })
      }
      // Heartbeat: re-emit the current stage every 5s so the connection never goes silent during a
      // long Opus draft and the client keeps resetting its per-chunk timeout.
      const heartbeat = setInterval(() => {
        send('progress', { stage, elapsedMs: Date.now() - startedAt, heartbeat: true })
      }, 5000)

      try {
        send('progress', { stage: 'searching', elapsedMs: 0 })
        // Resilient: primary = Anthropic; if Anthropic is unavailable (workspace usage/spend cap, 429,
        // overload, 5xx) the WHOLE turn (tool-use loop + verifier) falls back to Gemini, same tools/prompts.
        const loop = await runAgentLoopResilient(anthropic, historyMessages, systemPromptForGrounding(groundingMode, SYSTEM_PROMPT), chatModel, setStage, abort.signal, { groundingMode })
        const { text: answer, verified } = await verifyAnswerResilient(
          anthropic,
          { query, draft: loop.message, sources: loop.sources, toolCalls: loop.toolCalls, evidence: loop.searchEvidence, groundingMode },
          loop.provider,
          setStage,
          abort.signal
        )

        setStage('persisting')
        const responseModel = loop.provider === 'gemini' ? (process.env.GEMINI_CHAT_MODEL || 'gemini-2.5-pro') : chatModel
        const responseFallback = loop.provider === 'gemini'
        const { convId, persisted } = await persistConversation(
          user,
          conversationId,
          query,
          answer,
          loop.sources,
          loop.toolCalls,
          { provider: loop.provider, model: responseModel, fallback: responseFallback }
        )

        send('final', {
          message: answer,
          conversationId: convId ?? null,
          sources: loop.sources,
          toolCalls: loop.toolCalls,
          entities,
          model: responseModel,
          provider: loop.provider,
          fallback: responseFallback,
          verifierModel: CHAT_VERIFIER_ENABLED ? CHAT_VERIFIER_MODEL : null,
          groundingMode,
          verified,
          degraded: loop.degraded,
          injectionFlagged: loop.injectionFlagged,
          truncated: loop.truncated,
          retrievalIncomplete: loop.retrievalIncomplete,
          unreviewedUsed: loop.unreviewedUsed,
          persisted,
        })
      } catch (err: unknown) {
        if (abort.signal.aborted) {
          // Client went away — nothing to send, just clean up.
        } else {
          console.error('Chat API error:', err)
          const message = err instanceof Error ? err.message : 'Internal server error'
          send('error', { error: message })
        }
      } finally {
        clearInterval(heartbeat)
        closed = true
        try { controller.close() } catch { /* already closed */ }
      }
    },
    cancel() {
      abort.abort()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
