// Conversation-history restore: map a persisted rag_messages row back into the shape the chat UI renders.
// Persisted source shape (src/app/api/chat/route.ts persistConversation): { chunk_id, document_id,
// relevance, label, verification, metadata, preview? }. Older rows pre-date `preview`, so it defaults to ''.

export type RestoredSource = {
  id: string
  documentId?: string
  relevance: number
  metadata: Record<string, unknown>
  preview: string
  label?: string
  verification?: 'source_of_record' | 'supporting' | 'context' | 'unverified'
}

export type RestoredMessage = {
  role: 'user' | 'assistant'
  content: string
  sources?: RestoredSource[]
  toolCalls?: unknown[]
  provider?: 'openai' | 'anthropic' | 'gemini'
  model?: string
  fallback?: boolean
  persisted: true
}

export type StoredMessageRow = {
  role?: string | null
  content?: string | null
  sources?: unknown
  tool_calls?: unknown
  provider?: string | null
  model?: string | null
  fallback?: boolean | null
}

function mapStoredSource(raw: unknown): RestoredSource {
  const s = (raw ?? {}) as Record<string, unknown>
  return {
    id: String(s.chunk_id ?? s.id ?? ''),
    documentId: s.document_id != null ? String(s.document_id) : undefined,
    relevance: Number(s.relevance) || 0,
    metadata: (s.metadata && typeof s.metadata === 'object' ? s.metadata : {}) as Record<string, unknown>,
    preview: typeof s.preview === 'string' ? s.preview : '',
    label: typeof s.label === 'string' ? s.label : undefined,
    verification: s.verification as RestoredSource['verification'],
  }
}

/** Map one stored row to a UI message. Assistant role iff explicitly 'assistant'; everything else → user. */
export function mapStoredMessage(row: StoredMessageRow): RestoredMessage {
  const provider = row.provider === 'openai' || row.provider === 'anthropic' || row.provider === 'gemini' ? row.provider : undefined
  return {
    role: row.role === 'assistant' ? 'assistant' : 'user',
    content: row.content ?? '',
    sources: Array.isArray(row.sources) ? (row.sources as unknown[]).map(mapStoredSource) : undefined,
    toolCalls: Array.isArray(row.tool_calls) ? (row.tool_calls as unknown[]) : undefined,
    provider,
    model: typeof row.model === 'string' && row.model ? row.model : undefined,
    fallback: row.fallback === true || provider === 'gemini' ? true : undefined,
    persisted: true,
  }
}
