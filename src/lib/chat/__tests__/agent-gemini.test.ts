import { describe, it, expect, vi } from 'vitest'

// Mock executeTool so the loop control-flow test never touches Supabase; keep everything else real.
vi.mock('../agent', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../agent')>()
  return { ...actual, executeTool: vi.fn() }
})

import { executeTool } from '../agent'
import {
  isAnthropicUnavailable, geminiToolDeclarations, anthropicHistoryToGeminiContents,
  runGeminiAgentLoop, runAgentLoopResilient,
} from '../agent-gemini'

describe('isAnthropicUnavailable (fallback trigger)', () => {
  it('TRUE for the workspace usage/spend cap (the live incident: a 400 with a usage-limit message)', () => {
    expect(isAnthropicUnavailable({ status: 400, error: { message: 'You have reached your specified workspace API usage limits. You will regain access on 2026-07-01.' } })).toBe(true)
  })
  it('TRUE for rate limit / overload / 5xx / connection errors', () => {
    expect(isAnthropicUnavailable({ status: 429, message: 'rate_limit' })).toBe(true)
    expect(isAnthropicUnavailable({ status: 529, message: 'overloaded' })).toBe(true)
    expect(isAnthropicUnavailable({ status: 500 })).toBe(true)
    expect(isAnthropicUnavailable({ status: 503 })).toBe(true)
    expect(isAnthropicUnavailable({ name: 'APIConnectionError', message: 'fetch failed' })).toBe(true)
  })
  it('FALSE for a genuine bad request — must NOT mask real bugs', () => {
    expect(isAnthropicUnavailable({ status: 400, error: { message: 'model: invalid model id "claude-foo"' } })).toBe(false)
    expect(isAnthropicUnavailable({ status: 404, message: 'not found' })).toBe(false)
    expect(isAnthropicUnavailable({ status: 401, message: 'invalid x-api-key' })).toBe(false)
    expect(isAnthropicUnavailable(new Error('some other thing'))).toBe(false)
  })
})

describe('geminiToolDeclarations (schema translation)', () => {
  const decls = geminiToolDeclarations()
  it('translates all 10 tools with name/description/parameters', () => {
    expect(decls).toHaveLength(10)
    expect(decls.map(d => d.name)).toContain('search_documents')
    expect(decls.map(d => d.name)).toContain('find_document')
    for (const d of decls) { expect(d.name).toBeTruthy(); expect(d.parameters).toBeTruthy() }
  })
  it('preserves required + enum from input_schema', () => {
    const search = decls.find(d => d.name === 'search_documents') as { parameters: { required?: string[]; properties: Record<string, unknown> } }
    expect(search.parameters.required).toContain('query')
    const compare = decls.find(d => d.name === 'compare_projects') as { parameters: { properties: { metric: { enum: string[] } } } }
    expect(compare.parameters.properties.metric.enum).toEqual(['capex', 'funding', 'cash_flow', 'covenant', 'risk'])
  })
  it('strips additionalProperties/$schema if present (defensive)', () => {
    // none of the current tools use them, but the sanitizer must not leak them through
    const json = JSON.stringify(decls)
    expect(json).not.toContain('additionalProperties')
    expect(json).not.toContain('$schema')
  })
})

describe('anthropicHistoryToGeminiContents', () => {
  it('maps user→user, assistant→model, string + text-block content; never emits empty parts', () => {
    const out = anthropicHistoryToGeminiContents([
      { role: 'user', content: 'hola' },
      { role: 'assistant', content: [{ type: 'text', text: 'respuesta' }] as never },
      { role: 'user', content: '' },
    ])
    expect(out[0]).toEqual({ role: 'user', parts: [{ text: 'hola' }] })
    expect(out[1]).toEqual({ role: 'model', parts: [{ text: 'respuesta' }] })
    expect(out[2].parts[0].text).toBe(' ') // empty → space, Gemini rejects empty parts
  })
})

function fakeGenai(responses: Array<{ functionCalls?: Array<{ name: string; args: Record<string, unknown> }>; text?: string }>) {
  let i = 0
  return { models: { generateContent: vi.fn(async () => responses[i++] ?? { text: 'fallthrough' }) } }
}

describe('runGeminiAgentLoop (tool-use loop)', () => {
  it('returns the model text when there are no function calls', async () => {
    const r = await runGeminiAgentLoop([{ role: 'user', content: 'q' }], 'sys', { genai: fakeGenai([{ text: 'direct answer' }]) as never })
    expect(r.message).toBe('direct answer')
    expect(r.toolCalls).toHaveLength(0)
    expect(r.sources).toHaveLength(0)
  })

  it('executes a function call, accumulates sources, then finishes on the next text turn', async () => {
    ;(executeTool as ReturnType<typeof vi.fn>).mockResolvedValue({
      result: 'CTX about MAD financing', sources: [{ id: 's1', label: 'Loan', metadata: { review_status: 'approved' }, preview: 'p' }],
    })
    const genai = fakeGenai([
      { functionCalls: [{ name: 'search_documents', args: { query: 'financiacion MAD' } }] },
      { text: 'Los términos son ...' },
    ])
    const r = await runGeminiAgentLoop([{ role: 'user', content: 'términos financiación MAD' }], 'sys', { genai: genai as never })
    expect(executeTool).toHaveBeenCalledWith('search_documents', { query: 'financiacion MAD' }, expect.objectContaining({ groundingMode: 'standard' }))
    expect(r.message).toBe('Los términos son ...')
    expect(r.toolCalls).toHaveLength(1)
    expect(r.toolCalls[0]).toMatchObject({ name: 'search_documents', is_error: false, source_count: 1 })
    expect(r.sources.map(s => s.id)).toEqual(['s1'])
    // searchEvidence retained for the verifier
    expect(r.searchEvidence).toContain('CTX about MAD financing')
  })

  it('stops after 5 tool iterations (no infinite loop)', async () => {
    ;(executeTool as ReturnType<typeof vi.fn>).mockResolvedValue({ result: 'x' })
    const genai = { models: { generateContent: vi.fn(async () => ({ functionCalls: [{ name: 'search_documents', args: { query: 'x' } }] })) } }
    const r = await runGeminiAgentLoop([{ role: 'user', content: 'q' }], 'sys', { genai: genai as never })
    expect(genai.models.generateContent).toHaveBeenCalledTimes(5)
    expect(r.message).toMatch(/Maximum tool iterations/)
  })
})

describe('runAgentLoopResilient (provider selection)', () => {
  const fakeAnthropic = {} as never
  it('uses Anthropic and tags provider=anthropic on success', async () => {
    const r = await runAgentLoopResilient(
      { messages: { create: vi.fn(async () => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'ok from claude' }] })) } } as never,
      [{ role: 'user', content: 'q' }], 'sys', 'claude-sonnet-4-6',
    )
    expect(r.provider).toBe('anthropic')
    expect(r.message).toBe('ok from claude')
  })
  it('re-throws a genuine (non-availability) error instead of falling back', async () => {
    const anthropic = { messages: { create: vi.fn(async () => { throw Object.assign(new Error('bad'), { status: 404 }) }) } } as never
    await expect(runAgentLoopResilient(anthropic, [{ role: 'user', content: 'q' }], 'sys', 'm')).rejects.toThrow('bad')
    void fakeAnthropic
  })
})
