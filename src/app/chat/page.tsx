'use client'
import { useState, useRef, useEffect } from 'react'

type Message = {
  role: 'user' | 'assistant'
  content: string
  sources?: {
    id: string
    relevance: number
    metadata: Record<string, unknown>
    preview: string
    label?: string
    verification?: 'source_of_record' | 'supporting' | 'context' | 'unverified'
  }[]
  entities?: { type: string; value: string }[]
}

const SUGGESTED_QUERIES = [
  '¿Cuál es el estado actual del CapEx de Madrid?',
  'Compara la utilización de financiación entre MAD y BHX',
  '¿Cuánto queda de CESCE sin disponer?',
  '¿Cuál es la desviación del EAC en Birmingham?',
  'Resumen de flujo de caja de ambos proyectos',
  '¿Cuál es el presupuesto total del portfolio?',
]

const LOADING_STAGES = ['Buscando documentos…', 'Analizando cifras…', 'Verificando fuentes…']

const VERIFICATION_LABELS = {
  source_of_record: 'fuente oficial',
  supporting: 'respaldo',
  context: 'contexto',
  unverified: 'sin verificar',
} as const

function sourceText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function sourceHref(src: NonNullable<Message['sources']>[number]): string | undefined {
  return sourceText(src.metadata?.public_url)
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  // collapsed-set: sources show by default (UAT is about citations); clicking COLLAPSES a message's sources
  const [collapsedSources, setCollapsedSources] = useState<Set<number>>(new Set())
  const [stage, setStage] = useState(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // cycle the loading status text so a long multi-tool query reads as progress, not a hang
  useEffect(() => {
    if (!loading) return
    const id = setInterval(() => setStage(s => (s + 1) % LOADING_STAGES.length), 4000)
    return () => clearInterval(id)
  }, [loading])

  function toggleSources(i: number) {
    setCollapsedSources(prev => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i); else next.add(i)
      return next
    })
  }

  async function sendMessage(text?: string) {
    const query = text || input.trim()
    if (!query || loading) return

    const userMsg: Message = { role: 'user', content: query }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setStage(0)
    setLoading(true)

    // client-side timeout so a stalled agent loop never spins forever with no recovery.
    // Generous (4.5 min) because the reasoning path uses Opus + a verifier pass and can produce
    // long analytical answers; the server route allows up to 800s.
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 270_000)

    try {
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

      const data = await res.json().catch(() => ({}))

      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)

      if (data.conversationId) setConversationId(data.conversationId)

      setMessages([...newMessages, {
        role: 'assistant',
        content: data.message,
        sources: data.sources,
        entities: data.entities,
      }])
    } catch (err: unknown) {
      console.error('[chat] request failed', err)
      const aborted = err instanceof DOMException && err.name === 'AbortError'
      setMessages([...newMessages, {
        role: 'assistant',
        content: aborted
          ? 'La consulta tardó demasiado y se canceló. Inténtalo de nuevo o reformúlala.'
          : 'No se pudo completar la consulta. Inténtalo de nuevo.',
      }])
    } finally {
      clearTimeout(timeout)
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
                      {msg.sources.map((src, j) => (
                        <div key={j} className="text-xs bg-slate-50 rounded-md p-2.5 border border-slate-100">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`h-1.5 w-1.5 rounded-full ${
                              typeof src.relevance !== 'number' ? 'bg-slate-300' :
                              src.relevance > 0.7 ? 'bg-green-500' :
                              src.relevance > 0.4 ? 'bg-amber-500' : 'bg-slate-300'
                            }`} />
                            {sourceHref(src) ? (
                              <a
                                href={sourceHref(src)}
                                target="_blank"
                                rel="noreferrer"
                                className="font-medium text-slate-700 hover:underline"
                              >
                                {src.label || sourceText(src.metadata?.source_label) || sourceText(src.metadata?.source_file) || 'documento'}
                              </a>
                            ) : (
                              <span className="font-medium text-slate-600">
                                {src.label || sourceText(src.metadata?.source_label) || sourceText(src.metadata?.source_file) || 'documento'}
                              </span>
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
                      ))}
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
                <div className="flex items-center gap-2 font-mono text-xs text-slate-600">
                  <div className="flex gap-1">
                    <span className="h-2 w-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="h-2 w-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="h-2 w-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  {LOADING_STAGES[stage]}
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

/** Simple markdown-ish formatter for assistant responses */
function FormattedMessage({ content }: { content: string }) {
  const lines = content.split('\n')
  const elements: React.ReactNode[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

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
    } else if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      // Table row. A separator row is one where every cell matches ---, :--, --: or :--:
      const isSeparatorRow = (l?: string) =>
        !!l && l.trim().startsWith('|') &&
        l.split('|').slice(1, -1).every(c => /^\s*:?-{1,}:?\s*$/.test(c))
      if (isSeparatorRow(line)) continue // skip alignment/separator rows
      const cells = line.split('|').slice(1, -1).map(c => c.trim())
      const isHeader = isSeparatorRow(lines[i + 1])
      elements.push(
        <div key={i} className={`grid gap-2 text-xs font-mono py-1 px-2 ${isHeader ? 'font-semibold bg-slate-50 rounded' : ''}`}
          style={{ gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))` }}>
          {cells.map((cell, j) => (
            <span key={j} className={j === 0 ? 'text-slate-700' : 'text-right text-slate-600'}>{cell}</span>
          ))}
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
