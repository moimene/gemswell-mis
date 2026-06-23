// Gemini fallback for the chat agent (FULL PARITY: tool-use loop + verifier). When the primary Anthropic
// call is unavailable (workspace usage/spend cap, rate limit, overload, 5xx, connection error) the whole
// turn runs on Gemini instead, reusing the SAME tool executors, tool schemas, prompts and result shape as
// the Anthropic path (src/lib/chat/agent.ts). Reuses the existing GOOGLE_AI_API_KEY (already in prod for
// embeddings) — no new provider/key. Anthropic stays the primary; Gemini is only the degraded backstop.
import type Anthropic from '@anthropic-ai/sdk'
import { GoogleGenAI } from '@google/genai'
import type { GroundingMode } from '@/lib/rag/retrieve'
import {
  TOOLS, executeTool, buildAgentResult, buildVerifierSystemPrompt, buildVerifierUserContent,
  runAgentLoop, verifyAnswer, CHAT_MAX_TOKENS, CHAT_VERIFIER_ENABLED,
  systemPromptForGrounding, chooseChatModel, detectEntities, enforcePostAnswerGuards, TOOL_RESULT_PREVIEW_CHARS,
  type AgentLoopResult, type AgentAccumulators, type VerifierInput, type Source, type ChatTurnResult,
} from './agent'

// Gemini 2.5-pro/flash support function-calling (2.0-flash / 1.5-pro are retired — verified live 2026-06-14).
export const GEMINI_CHAT_MODEL = process.env.GEMINI_CHAT_MODEL || 'gemini-2.5-pro'
export const GEMINI_VERIFIER_MODEL = process.env.GEMINI_VERIFIER_MODEL || GEMINI_CHAT_MODEL
export const GEMINI_FALLBACK_ENABLED = process.env.GEMINI_FALLBACK_ENABLED !== 'false'

function geminiKey(): string {
  const k = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY
  if (!k) throw new Error('GOOGLE_AI_API_KEY not set (required for the Gemini chat fallback)')
  return k
}

type GeminiFunctionCall = { name?: string; args?: Record<string, unknown> }
type GeminiPart = { text?: string; functionCall?: { name: string; args: Record<string, unknown> }; functionResponse?: { name: string; response: Record<string, unknown> } }
type GeminiContent = { role: 'user' | 'model'; parts: GeminiPart[] }
type GeminiClient = { models: { generateContent: (req: unknown) => Promise<{ functionCalls?: GeminiFunctionCall[]; text?: string }> } }

/** Strip JSON-schema fields Gemini's function-declaration parser rejects (defensive — current TOOLS are
 *  clean). Anthropic input_schema (type/properties/required/enum) is otherwise directly compatible. */
function sanitizeSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(sanitizeSchema)
  if (node && typeof node === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (k === 'additionalProperties' || k === '$schema') continue
      out[k] = sanitizeSchema(v)
    }
    return out
  }
  return node
}

/** Translate Anthropic Tool[] → Gemini functionDeclarations[] (name/description/parameters). */
export function geminiToolDeclarations(): Array<{ name: string; description?: string; parameters: unknown }> {
  return (TOOLS as Anthropic.Tool[]).map((t) => ({
    name: t.name,
    description: t.description,
    parameters: sanitizeSchema(t.input_schema),
  }))
}

/** Convert the initial Anthropic message history (text turns) to Gemini contents. Tool-use parts are
 *  built inside the loop, so this only handles user/assistant text. */
export function anthropicHistoryToGeminiContents(messages: Anthropic.MessageParam[]): GeminiContent[] {
  return messages.map((m) => {
    const role: 'user' | 'model' = m.role === 'assistant' ? 'model' : 'user'
    let text = ''
    if (typeof m.content === 'string') text = m.content
    else if (Array.isArray(m.content)) {
      text = m.content.map((b) => (b as { type?: string; text?: string }).type === 'text' ? (b as { text?: string }).text ?? '' : '').filter(Boolean).join('\n')
    }
    return { role, parts: [{ text: text || ' ' }] } // Gemini rejects empty parts
  })
}

/** Gemini tool-use loop. Mirrors runAgentLoop (agent.ts) but with @google/genai function-calling, reusing
 *  executeTool + the shared result builder so the AgentLoopResult is byte-for-byte the same shape. */
export async function runGeminiAgentLoop(
  messages: Anthropic.MessageParam[],
  systemPrompt: string,
  opts: { model?: string; genai?: GeminiClient; onProgress?: (stage: string, detail?: string) => void; signal?: AbortSignal; groundingMode?: GroundingMode } = {}
): Promise<AgentLoopResult> {
  const ai = opts.genai ?? (new GoogleGenAI({ apiKey: geminiKey() }) as unknown as GeminiClient)
  const model = opts.model ?? GEMINI_CHAT_MODEL
  const groundingMode = opts.groundingMode ?? 'standard'
  const tools = [{ functionDeclarations: geminiToolDeclarations() }]
  const contents = anthropicHistoryToGeminiContents(messages)
  const acc: AgentAccumulators = { allSources: new Map<string, Source>(), toolCalls: [], degraded: false, injectionFlagged: false, retrievalIncomplete: false, searchEvidence: [] }

  for (let iteration = 0; iteration < 5; iteration++) {
    if (opts.signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    opts.onProgress?.('drafting')
    const resp = await ai.models.generateContent({
      model,
      contents,
      config: { systemInstruction: systemPrompt, tools, maxOutputTokens: CHAT_MAX_TOKENS },
    })
    const fcs = (resp.functionCalls ?? []).filter((f) => f.name)
    if (fcs.length === 0) {
      return buildAgentResult(resp.text?.trim() || 'No response generated.', false, acc)
    }
    opts.onProgress?.(fcs.some((f) => f.name === 'search_documents') ? 'searching' : 'analyzing', fcs.map((f) => f.name).join(', '))
    contents.push({ role: 'model', parts: fcs.map((fc) => ({ functionCall: { name: fc.name as string, args: fc.args ?? {} } })) })

    const parts: GeminiPart[] = await Promise.all(fcs.map(async (fc): Promise<GeminiPart> => {
      const name = fc.name as string
      const args = (fc.args ?? {}) as Record<string, unknown>
      try {
        const { result, sources, degraded: d, injectionFlagged: inj, retrievalIncomplete: ri } = await executeTool(name, args, { groundingMode })
        if (d) acc.degraded = true
        if (inj) acc.injectionFlagged = true
        if (ri) acc.retrievalIncomplete = true
        if (name === 'search_documents' && (sources?.length ?? 0) > 0) acc.searchEvidence.push(result)
        if (sources) for (const s of sources) if (!acc.allSources.has(s.id)) acc.allSources.set(s.id, s)
        acc.toolCalls.push({ iteration: iteration + 1, name, input: args, is_error: false, source_count: sources?.length ?? 0, result_preview: result.slice(0, TOOL_RESULT_PREVIEW_CHARS) })
        return { functionResponse: { name, response: { result } } }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown tool error'
        console.error(`Tool ${name} failed (gemini):`, err)
        acc.toolCalls.push({ iteration: iteration + 1, name, input: args, is_error: true, source_count: 0, result_preview: message.slice(0, TOOL_RESULT_PREVIEW_CHARS) })
        return { functionResponse: { name, response: { error: `Error executing ${name}: ${message}` } } }
      }
    }))
    contents.push({ role: 'user', parts })
  }
  return buildAgentResult('Maximum tool iterations reached. Please rephrase your question or ask about a specific aspect.', false, acc)
}

/** Gemini verifier — same prompt + user content as the Anthropic verifier; degrades to the draft on error. */
export async function verifyAnswerGemini(
  input: VerifierInput,
  opts: { genai?: GeminiClient; model?: string; onProgress?: (stage: string, detail?: string) => void } = {}
): Promise<{ text: string; verified: boolean }> {
  if (!CHAT_VERIFIER_ENABLED) return { text: input.draft, verified: false }
  opts.onProgress?.('verifying')
  try {
    const ai = opts.genai ?? (new GoogleGenAI({ apiKey: geminiKey() }) as unknown as GeminiClient)
    const resp = await ai.models.generateContent({
      model: opts.model ?? GEMINI_VERIFIER_MODEL,
      contents: [{ role: 'user', parts: [{ text: buildVerifierUserContent(input) }] }],
      config: { systemInstruction: buildVerifierSystemPrompt(input.groundingMode), maxOutputTokens: CHAT_MAX_TOKENS },
    })
    const text = resp.text?.trim()
    if (text) return { text, verified: true }
    return { text: input.draft, verified: false }
  } catch (err) {
    console.warn('Gemini verifier failed, returning draft (unverified):', err)
    return { text: input.draft, verified: false }
  }
}

/** Classify an Anthropic SDK error as "provider unavailable" (→ fall back) vs a genuine bad request (→
 *  surface). The workspace usage/spend cap surfaces as a 400 invalid_request with a usage-limit message,
 *  so a bare 400 is NOT enough — we match the quota wording explicitly to avoid masking real bugs. */
export function isAnthropicUnavailable(err: unknown): boolean {
  const e = err as { status?: number; name?: string; message?: string; error?: { message?: string }; constructor?: { name?: string } }
  const status = e?.status
  const name = `${e?.name ?? ''} ${e?.constructor?.name ?? ''}`.toLowerCase()
  const msg = (e?.error?.message || e?.message || '').toLowerCase()
  if (status === 400 && /(usage limit|credit balance|billing|quota|workspace|spend limit|rate.?limit)/.test(msg)) return true
  if (status === 401 && /(credit|billing|quota|usage)/.test(msg)) return true
  if (status === 429 || status === 529) return true
  if (typeof status === 'number' && status >= 500) return true
  if (/apiconnectionerror|apiconnectiontimeouterror/.test(name)) return true
  if (status === undefined && /(timeout|timed out|request timed out|connection error|econnreset|socket hang up|fetch failed|network|overloaded|econnrefused)/.test(msg)) return true
  return false
}

export type Provider = 'anthropic' | 'gemini'
export type ResilientAgentResult = AgentLoopResult & { provider: Provider }

/** Run the Anthropic agent loop; on an Anthropic-unavailable error, run the full Gemini loop instead.
 *  Genuine bad-request bugs are re-thrown (not masked). */
export async function runAgentLoopResilient(
  anthropic: Anthropic,
  messages: Anthropic.MessageParam[],
  systemPrompt: string,
  model: string,
  onProgress?: (stage: string, detail?: string) => void,
  signal?: AbortSignal,
  opts: { groundingMode?: GroundingMode } = {}
): Promise<ResilientAgentResult> {
  try {
    const r = await runAgentLoop(messages, systemPrompt, anthropic, model, onProgress, signal, opts)
    return { ...r, provider: 'anthropic' }
  } catch (err) {
    if (!GEMINI_FALLBACK_ENABLED || !isAnthropicUnavailable(err)) throw err
    const e = err as { error?: { message?: string }; message?: string }
    console.warn('[chat] Anthropic unavailable — falling back to Gemini:', e?.error?.message || e?.message)
    onProgress?.('fallback', GEMINI_CHAT_MODEL)
    const r = await runGeminiAgentLoop(messages, systemPrompt, { onProgress, signal, groundingMode: opts.groundingMode })
    return { ...r, provider: 'gemini' }
  }
}

/** Verify on the SAME provider the loop ran on (so a Gemini turn is verified by Gemini, not a dead Anthropic). */
export async function verifyAnswerResilient(
  anthropic: Anthropic,
  input: VerifierInput,
  provider: Provider,
  onProgress?: (stage: string, detail?: string) => void,
  signal?: AbortSignal
): Promise<{ text: string; verified: boolean }> {
  if (provider === 'gemini') return verifyAnswerGemini(input, { onProgress })
  return verifyAnswer(anthropic, input, onProgress, signal)
}

export type ResilientChatTurnResult = ChatTurnResult & { provider: Provider; fallback: boolean }

/** Full chat turn over the same resilient provider path used by /api/chat, without SSE/persistence. */
export async function runChatTurnResilient(
  anthropic: Anthropic,
  query: string,
  opts: { history?: Anthropic.MessageParam[]; model?: string; signal?: AbortSignal; groundingMode?: GroundingMode } = {}
): Promise<ResilientChatTurnResult> {
  const model = opts.model ?? chooseChatModel(query)
  const history: Anthropic.MessageParam[] = opts.history ?? [{ role: 'user', content: query }]
  const groundingMode = opts.groundingMode ?? 'standard'
  const loop = await runAgentLoopResilient(
    anthropic,
    history,
    systemPromptForGrounding(groundingMode),
    model,
    undefined,
    opts.signal,
    { groundingMode }
  )
  const { text: answer, verified } = await verifyAnswerResilient(
    anthropic,
    { query, draft: loop.message, sources: loop.sources, toolCalls: loop.toolCalls, evidence: loop.searchEvidence, groundingMode },
    loop.provider,
    undefined,
    opts.signal
  )
  const guarded = await enforcePostAnswerGuards({
    query,
    answer,
    sources: loop.sources,
    toolCalls: loop.toolCalls,
    degraded: loop.degraded,
    injectionFlagged: loop.injectionFlagged,
    retrievalIncomplete: loop.retrievalIncomplete,
    groundingMode,
  })
  return {
    answer: guarded.answer,
    verified,
    sources: guarded.sources,
    toolCalls: guarded.toolCalls,
    degraded: guarded.degraded,
    injectionFlagged: guarded.injectionFlagged,
    truncated: loop.truncated,
    retrievalIncomplete: guarded.retrievalIncomplete,
    unreviewedUsed: guarded.sources.filter((s) => {
      const rs = (s.metadata as Record<string, unknown> | undefined)?.review_status
      return rs === 'needs_review' || rs === 'pending'
    }).length,
    model: loop.provider === 'gemini' ? GEMINI_CHAT_MODEL : model,
    entities: detectEntities(query),
    provider: loop.provider,
    fallback: loop.provider === 'gemini',
  }
}
