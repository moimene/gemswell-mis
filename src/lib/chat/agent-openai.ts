// OpenAI primary provider for the documentary chat agent. It reuses the same tools, prompts,
// verifier prompt and post-answer guards as the Anthropic/Gemini paths; only the model API changes.
import type Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import type {
  FunctionTool,
  Response,
  ResponseFunctionToolCall,
  ResponseInput,
  ResponseInputItem,
} from 'openai/resources/responses/responses'
import type { GroundingMode } from '@/lib/rag/retrieve'
import {
  TOOLS, executeTool, buildAgentResult, buildVerifierSystemPrompt, buildVerifierUserContent,
  CHAT_MAX_TOKENS, CHAT_VERIFIER_ENABLED, systemPromptForGrounding, detectEntities,
  enforcePostAnswerGuards, chooseChatModel, TOOL_RESULT_PREVIEW_CHARS,
  isBuenavistaFinancingConditionsQuery, isMadridSeniorBankFinancingCostQuery,
  isUnreviewedSource,
  type AgentLoopResult, type AgentAccumulators, type ChatTurnResult, type Source, type VerifierInput,
} from './agent'
import {
  GEMINI_CHAT_MODEL, GEMINI_VERIFIER_MODEL, runAgentLoopResilient, verifyAnswerResilient,
  type Provider as FallbackProvider,
} from './agent-gemini'

export const OPENAI_CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || 'gpt-5.5'
export const OPENAI_VERIFIER_MODEL = process.env.OPENAI_VERIFIER_MODEL || OPENAI_CHAT_MODEL
export const OPENAI_PRIMARY_ENABLED = process.env.OPENAI_PRIMARY_ENABLED !== 'false'

export type Provider = 'openai' | FallbackProvider

type OpenAIClient = {
  responses: {
    create: (body: Record<string, unknown>, options?: { signal?: AbortSignal }) => Promise<Response>
  }
}

function openAIKey(): string {
  const k = process.env.OPENAI_API_KEY
  if (!k) throw new Error('OPENAI_API_KEY not set (required for the OpenAI primary chat provider)')
  return k
}

function openAIClient(): OpenAIClient {
  return new OpenAI({ apiKey: openAIKey() }) as unknown as OpenAIClient
}

function contentText(content: Anthropic.MessageParam['content']): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .map((block) => {
      const b = block as { type?: string; text?: string }
      return b.type === 'text' ? b.text ?? '' : ''
    })
    .filter(Boolean)
    .join('\n')
}

export function anthropicHistoryToOpenAIInput(messages: Anthropic.MessageParam[]): ResponseInput {
  return messages.map((m): ResponseInputItem => {
    const text = contentText(m.content) || ' '
    return m.role === 'assistant'
      ? { role: 'assistant', content: text, phase: 'final_answer' }
      : { role: 'user', content: text }
  })
}

export function openAIToolDeclarations(): FunctionTool[] {
  return (TOOLS as Anthropic.Tool[]).map((t) => ({
    type: 'function',
    name: t.name,
    description: t.description ?? null,
    parameters: (t.input_schema ?? { type: 'object', properties: {} }) as Record<string, unknown>,
    // Existing schemas were authored for Anthropic/Gemini and intentionally allow optional filters.
    // strict=false keeps OpenAI from rejecting non-strict JSON Schema while preserving validation in executeTool.
    strict: false,
  }))
}

function functionCalls(response: Response): ResponseFunctionToolCall[] {
  return response.output.filter((item): item is ResponseFunctionToolCall => item.type === 'function_call')
}

function parseFunctionArgs(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw) as unknown
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {}
  } catch {
    return {}
  }
}

function responseText(response: Response): string {
  return response.output_text?.trim() || 'No response generated.'
}

function isTruncated(response: Response): boolean {
  return response.status === 'incomplete'
}

export function isOpenAIUnavailable(err: unknown): boolean {
  const e = err as { status?: number; name?: string; message?: string; error?: { message?: string; code?: string }; code?: string; constructor?: { name?: string } }
  const status = e?.status
  const name = `${e?.name ?? ''} ${e?.constructor?.name ?? ''}`.toLowerCase()
  const msg = `${e?.error?.message ?? ''} ${e?.message ?? ''} ${e?.error?.code ?? ''} ${e?.code ?? ''}`.toLowerCase()
  if (/apiconnectionerror|apiconnectiontimeouterror/.test(name)) return true
  if (status === 400 && /(usage limit|credit balance|billing|quota|insufficient_quota|rate.?limit|temporarily unavailable)/.test(msg)) return true
  if (status === 401 && /(credit|billing|quota|usage)/.test(msg)) return true
  if (status === 402 || status === 408 || status === 409 || status === 429) return true
  if (typeof status === 'number' && status >= 500) return true
  if (status === undefined && /(timeout|timed out|request timed out|connection error|econnreset|socket hang up|fetch failed|network|overloaded|econnrefused|temporarily unavailable)/.test(msg)) return true
  return false
}

export async function runOpenAIAgentLoop(
  messages: Anthropic.MessageParam[],
  systemPrompt: string,
  opts: { client?: OpenAIClient; model?: string; onProgress?: (stage: string, detail?: string) => void; signal?: AbortSignal; groundingMode?: GroundingMode } = {}
): Promise<AgentLoopResult> {
  const client = opts.client ?? openAIClient()
  const model = opts.model ?? OPENAI_CHAT_MODEL
  const groundingMode = opts.groundingMode ?? 'standard'
  const input = anthropicHistoryToOpenAIInput(messages)
  const tools = openAIToolDeclarations()
  const acc: AgentAccumulators = { allSources: new Map<string, Source>(), toolCalls: [], degraded: false, injectionFlagged: false, retrievalIncomplete: false, searchEvidence: [] }

  for (let iteration = 0; iteration < 5; iteration++) {
    if (opts.signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    opts.onProgress?.('drafting')
    const response = await client.responses.create({
      model,
      instructions: systemPrompt,
      input,
      tools,
      tool_choice: 'auto',
      max_output_tokens: CHAT_MAX_TOKENS,
      include: ['reasoning.encrypted_content'],
      store: false,
    }, { signal: opts.signal })

    const calls = functionCalls(response)
    if (calls.length === 0) return buildAgentResult(responseText(response), isTruncated(response), acc)

    input.push(...(response.output as unknown as ResponseInputItem[]))
    opts.onProgress?.(calls.some((call) => call.name === 'search_documents') ? 'searching' : 'analyzing', calls.map((call) => call.name).join(', '))

    const outputs = await Promise.all(calls.map(async (call): Promise<ResponseInputItem> => {
      const args = parseFunctionArgs(call.arguments)
      try {
        const { result, sources, degraded: d, injectionFlagged: inj, retrievalIncomplete: ri } = await executeTool(call.name, args, { groundingMode })
        if (d) acc.degraded = true
        if (inj) acc.injectionFlagged = true
        if (ri) acc.retrievalIncomplete = true
        if (call.name === 'search_documents' && (sources?.length ?? 0) > 0) acc.searchEvidence.push(result)
        if (sources) for (const s of sources) if (!acc.allSources.has(s.id)) acc.allSources.set(s.id, s)
        acc.toolCalls.push({ iteration: iteration + 1, name: call.name, input: args, is_error: false, source_count: sources?.length ?? 0, result_preview: result.slice(0, TOOL_RESULT_PREVIEW_CHARS) })
        return { type: 'function_call_output', call_id: call.call_id, output: result }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown tool error'
        console.error(`Tool ${call.name} failed (openai):`, err)
        acc.toolCalls.push({ iteration: iteration + 1, name: call.name, input: args, is_error: true, source_count: 0, result_preview: message.slice(0, TOOL_RESULT_PREVIEW_CHARS) })
        return { type: 'function_call_output', call_id: call.call_id, output: `Error executing ${call.name}: ${message}` }
      }
    }))
    input.push(...outputs)
  }

  return buildAgentResult('Maximum tool iterations reached. Please rephrase your question or ask about a specific aspect.', false, acc)
}

export async function verifyAnswerOpenAI(
  input: VerifierInput,
  opts: { client?: OpenAIClient; model?: string; onProgress?: (stage: string, detail?: string) => void; signal?: AbortSignal } = {}
): Promise<{ text: string; verified: boolean }> {
  if (!CHAT_VERIFIER_ENABLED) return { text: input.draft, verified: false }
  opts.onProgress?.('verifying')
  try {
    const client = opts.client ?? openAIClient()
    const response = await client.responses.create({
      model: opts.model ?? OPENAI_VERIFIER_MODEL,
      instructions: buildVerifierSystemPrompt(input.groundingMode),
      input: buildVerifierUserContent(input),
      max_output_tokens: CHAT_MAX_TOKENS,
      store: false,
    }, { signal: opts.signal })
    const text = response.output_text?.trim()
    if (text) return { text, verified: true }
    return { text: input.draft, verified: false }
  } catch (err) {
    console.warn('OpenAI verifier failed, returning draft answer (unverified):', err)
    return { text: input.draft, verified: false }
  }
}

export type PrimaryAgentResult = AgentLoopResult & { provider: Provider }

async function runGuardedSearchFastPath(
  query: string,
  searches: string[],
  groundingMode: GroundingMode,
): Promise<PrimaryAgentResult> {
  const acc: AgentAccumulators = {
    allSources: new Map<string, Source>(),
    toolCalls: [],
    degraded: false,
    injectionFlagged: false,
    retrievalIncomplete: false,
    searchEvidence: [],
  }
  for (let i = 0; i < searches.length; i++) {
    const args = { query: searches[i], project_id: 'MAD', doc_type: 'funding' }
    const { result, sources, degraded: d, injectionFlagged: inj, retrievalIncomplete: ri } = await executeTool('search_documents', args, { groundingMode })
    if (d) acc.degraded = true
    if (inj) acc.injectionFlagged = true
    if (ri) acc.retrievalIncomplete = true
    if (sources) for (const source of sources) acc.allSources.set(source.id, source)
    if ((sources?.length ?? 0) > 0) acc.searchEvidence.push(result)
    acc.toolCalls.push({
      iteration: i + 1,
      name: 'search_documents',
      input: args,
      is_error: false,
      source_count: sources?.length ?? 0,
      result_preview: result.slice(0, TOOL_RESULT_PREVIEW_CHARS),
    })
  }
  const guarded = await enforcePostAnswerGuards({
    query,
    answer: '',
    sources: Array.from(acc.allSources.values()),
    toolCalls: acc.toolCalls,
    degraded: acc.degraded,
    injectionFlagged: acc.injectionFlagged,
    retrievalIncomplete: acc.retrievalIncomplete,
    groundingMode,
  })
  return {
    ...buildAgentResult(guarded.answer, false, {
      ...acc,
      allSources: new Map(guarded.sources.map((source) => [source.id, source])),
      toolCalls: guarded.toolCalls,
      degraded: guarded.degraded,
      injectionFlagged: guarded.injectionFlagged,
      retrievalIncomplete: guarded.retrievalIncomplete,
    }),
    provider: 'openai',
  }
}

export async function runAgentLoopOpenAIPrimary(
  anthropic: Anthropic,
  messages: Anthropic.MessageParam[],
  systemPrompt: string,
  fallbackAnthropicModel: string,
  onProgress?: (stage: string, detail?: string) => void,
  signal?: AbortSignal,
  opts: { groundingMode?: GroundingMode; client?: OpenAIClient } = {}
): Promise<PrimaryAgentResult> {
  const lastUserMessage = [...messages].reverse().find((message) => message.role === 'user')
  const lastUserText = lastUserMessage ? contentText(lastUserMessage.content) : ''
  const groundingMode = opts.groundingMode ?? 'standard'
  if (isMadridSeniorBankFinancingCostQuery(lastUserText)) {
    return runGuardedSearchFastPath(lastUserText, [
      '4140-7692-5542 Piscina de Olas Contrato de financiacion Santander BBVA Tipo de Interes Ordinario EURIBOR Margen 4,00',
      '4140-7692-5542 Contrato de financiacion Santander BBVA Comision de Estructuracion Agencia Coordinacion Coste Financiero Contratos de Cobertura CAP',
      '4140-7692-5542 Entidades Financiadoras Banco Santander BBVA financiacion coste 31.000.000 15.500.000',
    ], groundingMode)
  }
  if (isBuenavistaFinancingConditionsQuery(lastUserText)) {
    return runGuardedSearchFastPath(lastUserText, [
      'Contrato de Credito Participativo Buenavista Madrid Playa Surf 2.1 2.2 importe finalidad 15.657.498,18 Gastos Elegibles',
      'Contrato de Credito Participativo Buenavista 3.3 condiciones necesarias para realizar Disposiciones Solicitud de Disposicion facturas Asesor Tecnico',
      'Contrato de Credito Participativo Buenavista 6 Periodos de Interes primer Periodo de Interes 14 de julio de 2027',
    ], groundingMode)
  }

  if (OPENAI_PRIMARY_ENABLED) {
    try {
      const r = await runOpenAIAgentLoop(messages, systemPrompt, { client: opts.client, onProgress, signal, groundingMode: opts.groundingMode })
      return { ...r, provider: 'openai' }
    } catch (err) {
      if (!isOpenAIUnavailable(err)) throw err
      const e = err as { error?: { message?: string }; message?: string }
      console.warn('[chat] OpenAI unavailable - falling back to legacy providers:', e?.error?.message || e?.message)
      onProgress?.('fallback', 'legacy providers')
    }
  }

  const r = await runAgentLoopResilient(
    anthropic,
    messages,
    systemPrompt,
    fallbackAnthropicModel,
    onProgress,
    signal,
    { groundingMode: opts.groundingMode }
  )
  return r
}

export async function verifyAnswerOpenAIPrimary(
  anthropic: Anthropic,
  input: VerifierInput,
  provider: Provider,
  onProgress?: (stage: string, detail?: string) => void,
  signal?: AbortSignal
): Promise<{ text: string; verified: boolean }> {
  if (provider === 'openai') return verifyAnswerOpenAI(input, { onProgress, signal })
  return verifyAnswerResilient(anthropic, input, provider, onProgress, signal)
}

export function modelForProvider(provider: Provider, fallbackAnthropicModel: string): string {
  if (provider === 'openai') return OPENAI_CHAT_MODEL
  if (provider === 'gemini') return GEMINI_CHAT_MODEL
  return fallbackAnthropicModel
}

export function verifierModelForProvider(provider: Provider): string | null {
  if (!CHAT_VERIFIER_ENABLED) return null
  if (provider === 'openai') return OPENAI_VERIFIER_MODEL
  if (provider === 'gemini') return GEMINI_VERIFIER_MODEL
  return process.env.CHAT_VERIFIER_MODEL || process.env.CHAT_REASONING_MODEL || 'claude-opus-4-8'
}

export type PrimaryChatTurnResult = ChatTurnResult & { provider: Provider; fallback: boolean }

export async function runChatTurnOpenAIPrimary(
  anthropic: Anthropic,
  query: string,
  opts: { history?: Anthropic.MessageParam[]; fallbackModel?: string; signal?: AbortSignal; groundingMode?: GroundingMode } = {}
): Promise<PrimaryChatTurnResult> {
  const fallbackModel = opts.fallbackModel ?? chooseChatModel(query)
  const history: Anthropic.MessageParam[] = opts.history ?? [{ role: 'user', content: query }]
  const groundingMode = opts.groundingMode ?? 'standard'
  const loop = await runAgentLoopOpenAIPrimary(
    anthropic,
    history,
    systemPromptForGrounding(groundingMode),
    fallbackModel,
    undefined,
    opts.signal,
    { groundingMode }
  )
  const { text: answer, verified } = await verifyAnswerOpenAIPrimary(
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
    unreviewedUsed: guarded.sources.filter(isUnreviewedSource).length,
    model: modelForProvider(loop.provider, fallbackModel),
    entities: detectEntities(query),
    provider: loop.provider,
    fallback: loop.provider !== 'openai',
  }
}
