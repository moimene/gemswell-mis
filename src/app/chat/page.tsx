'use client'
import { useState, useRef, useEffect } from 'react'

type Source = {
  id: string
  documentId?: string
  relevance: number
  metadata: Record<string, unknown>
  preview: string
  label?: string
  verification?: 'source_of_record' | 'supporting' | 'context' | 'unverified'
}

type Message = {
  role: 'user' | 'assistant'
  content: string
  sources?: Source[]
  entities?: { type: string; value: string }[]
  degraded?: boolean
  injectionFlagged?: boolean
  truncated?: boolean
  persisted?: boolean
}

type Progress = { stage: string; detail?: string; elapsedMs: number }

const SUGGESTED_QUERIES = [
  '¿Cuál es el estado actual del CapEx de Madrid?',
  'Compara la utilización de financiación entre MAD y BHX',
  '¿Cuánto queda de CESCE sin disponer?',
  '¿Cuál es la desviación del EAC en Birmingham?',
  'Resumen de flujo de caja de ambos proyectos',
  '¿Cuál es el presupuesto total del portfolio?',
]

// Human-readable label per server SSE stage (see /api/chat progress events).
const STAGE_LABELS: Record<string, string> = {
  searching: 'Buscando documentos…',
  analyzing: 'Consultando datos estructurados…',
  drafting: 'Redactando respuesta…',
  verifying: 'Verificando evidencia…',
  persisting: 'Guardando conversación…',
}

const VERIFICATION_LABELS = {
  source_of_record: 'fuente oficial',
  supporting: 'respaldo',
  context: 'contexto',
  unverified: 'sin verificar',
} as const

// Client abort if no SSE event arrives for this long (heartbeat is every 5s server-side, so a 90s
// silence means the stream is genuinely dead). Reset on every chunk — the old fixed 270s wall is gone.
const STREAM_IDLE_TIMEOUT_MS = 90_000

function sourceText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

// Citation link (F1/F23): prefer a validated external artifact URL; otherwise deep-link to the
// document's gestor detail so EVERY source is inspectable even with no stored artifact.
function sourceHref(src: Source): string | undefined {
  const publicUrl = sourceText(src.metadata?.public_url)
  if (publicUrl && /^https?:\/\//i.test(publicUrl)) return publicUrl
  if (src.documentId) return `/admin/documents?doc=${encodeURIComponent(src.documentId)}`
  return undefined
}

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  // collapsed-set: sources show by default (UAT is about citations); clicking COLLAPSES a message's sources
  const [collapsedSources, setCollapsedSources] = useState<Set<number>>(new Set())
  const [progress, setProgress] = useState<Progress | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, progress])

  useEffect(() => () => abortRef.current?.abort(), [])

  function toggleSources(i: number) {
    setCollapsedSources(prev => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i); else next.add(i)
      return next
    })
  }

  function cancelRequest() {
    abortRef.current?.abort()
  }

  async function sendMessage(text?: string) {
    const query = text || input.trim()
    if (!query || loading) return

    const userMsg: Message = { role: 'user', content: query }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setProgress({ stage: 'searching', elapsedMs: 0 })
    setLoading(true)

    const controller = new AbortController()
    abortRef.current = controller
    // Idle watchdog: reset on every SSE chunk. A live stream (heartbeat ≤5s) never trips it; only a
    // genuinely stalled connection does.
    let idleTimer: ReturnType<typeof setTimeout> | null = null
    const armIdle = () => {
      if (idleTimer) clearTimeout(idleTimer)
      idleTimer = setTimeout(() => controller.abort(), STREAM_IDLE_TIMEOUT_MS)
    }

    try {
      armIdle()
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          conversationId,
        }),
        signal: controller.signal,
      })

      // session expired mid-conversation -> bounce to login preserving where we were
      if (res.status === 401) {
        if (typeof window !== 'undefined') window.location.assign('/login?redirect=/chat')
        return
      }
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `HTTP ${res.status}`)
      }

      // ── Consume the SSE stream ──────────────────────────────────────
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let finalReceived = false

      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        armIdle()
        buffer += decoder.decode(value, { stream: true })

        // SSE frames are separated by a blank line
        let sep: number
        while ((sep = buffer.indexOf('\n\n')) !== -1) {
          const frame = buffer.slice(0, sep)
          buffer = buffer.slice(sep + 2)
          let event = 'message'
          const dataLines: string[] = []
          for (const line of frame.split('\n')) {
            if (line.startsWith('event:')) event = line.slice(6).trim()
            else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim())
          }
          if (dataLines.length === 0) continue
          let payload: Record<string, unknown> = {}
          try { payload = JSON.parse(dataLines.join('\n')) } catch { continue }

          if (event === 'progress') {
            setProgress({
              stage: String(payload.stage ?? 'drafting'),
              detail: payload.detail ? String(payload.detail) : undefined,
              elapsedMs: Number(payload.elapsedMs) || 0,
            })
          } else if (event === 'error') {
            throw new Error(String(payload.error || 'stream error'))
          } else if (event === 'final') {
            finalReceived = true
            if (payload.conversationId) setConversationId(String(payload.conversationId))
            setMessages([...newMessages, {
              role: 'assistant',
              content: String(payload.message ?? ''),
              sources: (payload.sources as Source[]) ?? undefined,
              entities: (payload.entities as { type: string; value: string }[]) ?? undefined,
              degraded: Boolean(payload.degraded),
              injectionFlagged: Boolean(payload.injectionFlagged),
              truncated: Boolean(payload.truncated),
              persisted: payload.persisted !== false,
            }])
          }
        }
      }

      if (!finalReceived) throw new Error('La respuesta se interrumpió antes de completarse.')
    } catch (err: unknown) {
      console.error('[chat] request failed', err)
      const aborted = err instanceof DOMException && err.name === 'AbortError'
      setMessages([...newMessages, {
        role: 'assistant',
        content: aborted
          ? 'Consulta cancelada. Puedes reformularla o intentarlo de nuevo.'
          : 'No se pudo completar la consulta. Inténtalo de nuevo.',
      }])
    } finally {
      if (idleTimer) clearTimeout(idleTimer)
      abortRef.current = null
      setProgress(null)
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex-none border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
              Gemswell MIS
            </p>
            <h1 className="mt-0.5 text-lg font-bold tracking-tight text-slate-900">Asistente documental</h1>
            <p className="text-sm text-slate-500">Pregunta sobre CapEx, tesorería, financiación o cualquier dato de los proyectos</p>
          </div>
          {conversationId && (
            <button
              onClick={() => { setMessages([]); setConversationId(null); setCollapsedSources(new Set()) }}
              className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
            >
              Nueva conversación
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="mx-auto flex h-full w-full max-w-4xl flex-col items-center justify-center text-center">
            <div className="mb-4 rounded-md bg-slate-100 p-4">
              <svg className="h-8 w-8 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <p className="mb-1 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
              Gemswell MIS
            </p>
            <h2 className="mb-2 text-lg font-bold tracking-tight text-slate-800">Asistente documental</h2>
            <p className="mb-6 max-w-md text-sm text-slate-500">
              Tengo acceso a los datos financieros y documentales de tu portfolio — CapEx, tesorería,
              instrumentos de financiación y más. Pregúntame sobre cualquier proyecto (MAD, BHX, Kelpa, fondo…).
            </p>
            <div className="grid w-full max-w-lg grid-cols-2 gap-2">
              {SUGGESTED_QUERIES.map((q, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(q)}
                  className="rounded-lg border border-slate-200 px-3 py-2.5 text-left text-sm text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] ${msg.role === 'user' ? 'order-2' : 'order-1'}`}>
              {/* Avatar + Message */}
              <div className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`flex-none h-8 w-8 rounded-md flex items-center justify-center font-mono text-[10px] font-bold uppercase tracking-wider ${
                  msg.role === 'user'
                    ? 'bg-slate-800 text-white'
                    : 'bg-slate-100 text-slate-600'
                }`}>
                  {msg.role === 'user' ? 'TÚ' : 'IA'}
                </div>
                <div className={`rounded-lg px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-slate-800 text-white'
                    : 'bg-white border border-slate-200 text-slate-800'
                }`}>
                  {msg.role === 'assistant' ? (
                    <div className="prose prose-sm prose-slate max-w-none">
                      <FormattedMessage content={msg.content} />
                    </div>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  )}
                </div>
              </div>

              {/* Answer-level advisories (degraded / injection / truncated / not-persisted) */}
              {msg.role === 'assistant' && (msg.degraded || msg.injectionFlagged || msg.truncated || msg.persisted === false) && (
                <div className="mt-2 ml-11 flex flex-wrap gap-1.5">
                  {msg.injectionFlagged && (
                    <span className="inline-flex items-center gap-1 rounded bg-red-50 px-1.5 py-0.5 text-[11px] font-medium text-red-700 border border-red-100">
                      ⚠ Posible contenido manipulado en una fuente
                    </span>
                  )}
                  {msg.degraded && (
                    <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 border border-amber-100">
                      Relevancia aproximada (reordenador no disponible)
                    </span>
                  )}
                  {msg.truncated && (
                    <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 border border-amber-100">
                      Respuesta truncada por longitud
                    </span>
                  )}
                  {msg.persisted === false && (
                    <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600 border border-slate-200">
                      No se guardó en el historial
                    </span>
                  )}
                </div>
              )}

              {/* Entities — shown independently of sources */}
              {msg.role === 'assistant' && msg.entities && msg.entities.length > 0 && (
                <div className="mt-2 ml-11 flex flex-wrap gap-1">
                  {msg.entities.map((e, j) => (
                    <span key={j} className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] bg-slate-100 text-slate-600">
                      {e.value}
                    </span>
                  ))}
                </div>
              )}

              {/* Sources — expanded by default (citations are the point of the documental chat) */}
              {msg.role === 'assistant' && msg.sources && msg.sources.length > 0 && (
                <div className="mt-2 ml-11">
                  <button
                    onClick={() => toggleSources(i)}
                    className="text-xs font-medium text-slate-600 hover:text-slate-800 flex items-center gap-1"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {collapsedSources.has(i) ? `Ver ${msg.sources.length} fuentes` : `Ocultar fuentes (${msg.sources.length})`}
                  </button>
                  {!collapsedSources.has(i) && (
                    <div className="mt-2 space-y-1.5">
                      {msg.sources.map((src, j) => {
                        const href = sourceHref(src)
                        const flagged = src.metadata?.injection_flagged === true
                        const unreviewed = src.metadata?.review_status === 'needs_review' || src.metadata?.review_status === 'pending'
                        const label = src.label || sourceText(src.metadata?.source_label) || sourceText(src.metadata?.source_file) || 'documento'
                        return (
                          <div key={j} className={`text-xs rounded-md p-2.5 border ${flagged ? 'bg-red-50/40 border-red-100' : 'bg-slate-50 border-slate-100'}`}>
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`h-1.5 w-1.5 rounded-full ${
                                typeof src.relevance !== 'number' ? 'bg-slate-300' :
                                src.relevance > 0.7 ? 'bg-green-500' :
                                src.relevance > 0.4 ? 'bg-amber-500' : 'bg-slate-300'
                              }`} />
                              {href ? (
                                <a
                                  href={href}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="font-medium text-slate-700 hover:underline"
                                >
                                  {label}
                                </a>
                              ) : (
                                <span className="font-medium text-slate-600">{label}</span>
                              )}
                              {typeof src.relevance === 'number' && (
                                <span className="text-slate-500">{(src.relevance * 100).toFixed(0)}% relevante</span>
                              )}
                            </div>
                            <div className="mb-1 flex flex-wrap items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest">
                              <span className="rounded bg-white px-1.5 py-0.5 text-slate-500 border border-slate-100">
                                {sourceText(src.metadata?.project_id) || 'Proyecto —'}
                              </span>
                              <span className="rounded bg-white px-1.5 py-0.5 text-slate-500 border border-slate-100">
                                {sourceText(src.metadata?.doc_type) || 'Tipo —'}
                              </span>
                              <span className="rounded bg-white px-1.5 py-0.5 text-slate-500 border border-slate-100">
                                {VERIFICATION_LABELS[src.verification || 'unverified']}
                              </span>
                              {unreviewed && (
                                <span className="rounded bg-amber-50 px-1.5 py-0.5 text-amber-700 border border-amber-100">
                                  sin revisar
                                </span>
                              )}
                              {flagged && (
                                <span className="rounded bg-red-50 px-1.5 py-0.5 text-red-700 border border-red-100">
                                  anomalía
                                </span>
                              )}
                              {src.metadata?.authority != null && (
                                <span className="rounded bg-white px-1.5 py-0.5 text-slate-500 border border-slate-100">
                                  autoridad {String(src.metadata.authority)}
                                </span>
                              )}
                            </div>
                            {sourceText(src.metadata?.dms_path) && (
                              <p className="mb-1 font-mono text-[10px] text-slate-500 truncate">
                                {sourceText(src.metadata.dms_path)}
                              </p>
                            )}
                            <p className="text-slate-600 line-clamp-2">{src.preview}</p>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="flex gap-3">
              <div className="flex-none h-8 w-8 rounded-md bg-slate-100 flex items-center justify-center font-mono text-[10px] font-bold uppercase tracking-wider text-slate-600">
                IA
              </div>
              <div className="rounded-lg px-4 py-3 bg-white border border-slate-200">
                <div className="flex items-center gap-3 font-mono text-xs text-slate-600">
                  <div className="flex gap-1">
                    <span className="h-2 w-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="h-2 w-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="h-2 w-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span>{STAGE_LABELS[progress?.stage ?? 'searching'] ?? 'Procesando…'}</span>
                  {progress && progress.elapsedMs > 0 && (
                    <span className="text-slate-400">· {formatElapsed(progress.elapsedMs)}</span>
                  )}
                  <button
                    onClick={cancelRequest}
                    className="ml-1 rounded border border-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex-none border-t border-slate-200 bg-white px-6 py-4">
        <div className="flex items-end gap-3 max-w-4xl mx-auto">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Pregunta sobre CapEx, tesorería, financiación…"
              rows={1}
              className="w-full resize-none rounded-lg border border-slate-200 px-4 py-3 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent placeholder:text-slate-400"
              style={{ minHeight: '44px', maxHeight: '120px' }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement
                target.style.height = '44px'
                target.style.height = Math.min(target.scrollHeight, 120) + 'px'
              }}
            />
          </div>
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
            className="flex-none h-11 w-11 rounded-lg bg-slate-800 text-white flex items-center justify-center hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

/** Simple markdown-ish formatter for assistant responses. Consecutive pipe rows are grouped into a
 *  single aligned <table> (financial answers are table-heavy — F21). */
function FormattedMessage({ content }: { content: string }) {
  const lines = content.split('\n')
  const elements: React.ReactNode[] = []

  const isTableRow = (l?: string) => !!l && l.trim().startsWith('|') && l.trim().endsWith('|')
  const isSeparatorRow = (l?: string) =>
    !!l && l.trim().startsWith('|') &&
    l.split('|').slice(1, -1).every(c => /^\s*:?-{1,}:?\s*$/.test(c))
  const parseCells = (l: string) => l.split('|').slice(1, -1).map(c => c.trim())

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (isTableRow(line) && !isSeparatorRow(line)) {
      // Collect the contiguous block of table rows starting here.
      const block: string[] = []
      let j = i
      while (j < lines.length && isTableRow(lines[j])) { block.push(lines[j]); j++ }
      const dataRows = block.filter(r => !isSeparatorRow(r))
      const hasHeader = block.length >= 2 && isSeparatorRow(block[1])
      const header = hasHeader ? parseCells(dataRows[0]) : null
      const bodyRows = (hasHeader ? dataRows.slice(1) : dataRows).map(parseCells)
      const colCount = Math.max(header?.length ?? 0, ...bodyRows.map(r => r.length), 1)

      elements.push(
        <div key={i} className="my-2 overflow-x-auto">
          <table className="w-full border-collapse text-xs font-mono">
            {header && (
              <thead>
                <tr className="bg-slate-50">
                  {Array.from({ length: colCount }).map((_, c) => (
                    <th key={c} className={`border border-slate-200 px-2 py-1 font-semibold text-slate-700 ${c === 0 ? 'text-left' : 'text-right'}`}>
                      {header[c] ?? ''}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {bodyRows.map((cells, r) => (
                <tr key={r} className="even:bg-slate-50/40">
                  {Array.from({ length: colCount }).map((_, c) => (
                    <td key={c} className={`border border-slate-200 px-2 py-1 text-slate-600 ${c === 0 ? 'text-left' : 'text-right'}`}>
                      <InlineFormat text={cells[c] ?? ''} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
      i = j - 1
      continue
    }

    if (line.startsWith('### ')) {
      elements.push(<h4 key={i} className="font-semibold text-slate-800 mt-3 mb-1">{line.slice(4)}</h4>)
    } else if (line.startsWith('## ')) {
      elements.push(<h3 key={i} className="font-bold text-slate-900 mt-4 mb-2 text-base">{line.slice(3)}</h3>)
    } else if (line.startsWith('# ')) {
      elements.push(<h2 key={i} className="font-bold text-slate-900 mt-4 mb-2 text-lg">{line.slice(2)}</h2>)
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      elements.push(
        <div key={i} className="flex gap-2 ml-2">
          <span className="text-slate-400 mt-0.5">•</span>
          <span className="text-sm"><InlineFormat text={line.slice(2)} /></span>
        </div>
      )
    } else if (line.match(/^\d+\.\s/)) {
      const num = line.match(/^(\d+)\.\s(.*)/)
      elements.push(
        <div key={i} className="flex gap-2 ml-2">
          <span className="text-slate-400 font-mono text-xs mt-0.5 w-4 text-right">{num?.[1]}.</span>
          <span className="text-sm"><InlineFormat text={num?.[2] || ''} /></span>
        </div>
      )
    } else if (line.trim() === '') {
      elements.push(<div key={i} className="h-2" />)
    } else {
      elements.push(<p key={i} className="text-sm leading-relaxed"><InlineFormat text={line} /></p>)
    }
  }

  return <>{elements}</>
}

function InlineFormat({ text }: { text: string }) {
  // Bold (**text**) and inline code (`text`)
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/)
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i} className="font-semibold text-slate-900">{part.slice(2, -2)}</strong>
        }
        if (part.startsWith('`') && part.endsWith('`')) {
          return <code key={i} className="px-1 py-0.5 bg-slate-100 rounded text-xs font-mono text-slate-700">{part.slice(1, -1)}</code>
        }
        return <span key={i}>{part}</span>
      })}
    </>
  )
}
