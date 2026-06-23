import { describe, it, expect, vi } from 'vitest'

vi.mock('../agent', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../agent')>()
  return { ...actual, executeTool: vi.fn() }
})

import { executeTool } from '../agent'
import {
  anthropicHistoryToOpenAIInput,
  isOpenAIUnavailable,
  openAIToolDeclarations,
  runAgentLoopOpenAIPrimary,
  runOpenAIAgentLoop,
} from '../agent-openai'

function fakeOpenAI(responses: Array<{ output?: unknown[]; output_text?: string; status?: string }>) {
  let i = 0
  return {
    responses: {
      create: vi.fn(async () => ({
        output: [],
        output_text: '',
        status: 'completed',
        ...(responses[i++] ?? { output_text: 'fallthrough' }),
      })),
    },
  }
}

describe('isOpenAIUnavailable', () => {
  it('TRUE for quota, rate limit, server and network availability errors', () => {
    expect(isOpenAIUnavailable({ status: 400, error: { message: 'insufficient_quota' } })).toBe(true)
    expect(isOpenAIUnavailable({ status: 429, message: 'rate limit' })).toBe(true)
    expect(isOpenAIUnavailable({ status: 500 })).toBe(true)
    expect(isOpenAIUnavailable({ message: 'fetch failed' })).toBe(true)
    expect(isOpenAIUnavailable({ name: 'APIConnectionError', message: 'Connection error.' })).toBe(true)
    expect(isOpenAIUnavailable({ constructor: { name: 'APIConnectionTimeoutError' }, message: 'Request timed out.' })).toBe(true)
  })

  it('FALSE for bad request/config errors that should not be masked by fallback', () => {
    expect(isOpenAIUnavailable({ status: 400, error: { message: 'invalid model id' } })).toBe(false)
    expect(isOpenAIUnavailable({ status: 401, message: 'invalid api key' })).toBe(false)
    expect(isOpenAIUnavailable({ status: 404, message: 'not found' })).toBe(false)
  })
})

describe('openAIToolDeclarations', () => {
  const tools = openAIToolDeclarations()

  it('translates all chat tools to Responses function tools', () => {
    expect(tools).toHaveLength(10)
    expect(tools.map((t) => t.name)).toContain('search_documents')
    expect(tools.map((t) => t.name)).toContain('find_document')
    for (const t of tools) {
      expect(t.type).toBe('function')
      expect(t.parameters).toBeTruthy()
      expect(t.strict).toBe(false)
    }
  })

  it('preserves required and enum fields from the Anthropic schema', () => {
    const search = tools.find((t) => t.name === 'search_documents') as { parameters: { required?: string[] } }
    expect(search.parameters.required).toContain('query')
    const compare = tools.find((t) => t.name === 'compare_projects') as unknown as { parameters: { properties: { metric: { enum: string[] } } } }
    expect(compare.parameters.properties.metric.enum).toEqual(['capex', 'funding', 'cash_flow', 'covenant', 'risk'])
  })
})

describe('anthropicHistoryToOpenAIInput', () => {
  it('maps user and assistant text history and preserves assistant final phase', () => {
    const input = anthropicHistoryToOpenAIInput([
      { role: 'user', content: 'hola' },
      { role: 'assistant', content: [{ type: 'text', text: 'respuesta' }] as never },
      { role: 'user', content: '' },
    ]) as unknown as Array<Record<string, unknown>>

    expect(input[0]).toEqual({ role: 'user', content: 'hola' })
    expect(input[1]).toEqual({ role: 'assistant', content: 'respuesta', phase: 'final_answer' })
    expect(input[2]).toEqual({ role: 'user', content: ' ' })
  })
})

describe('runOpenAIAgentLoop', () => {
  it('returns output_text when there are no function calls', async () => {
    const client = fakeOpenAI([{ output_text: 'direct answer' }])
    const r = await runOpenAIAgentLoop([{ role: 'user', content: 'q' }], 'sys', { client: client as never })
    expect(r.message).toBe('direct answer')
    expect(r.toolCalls).toHaveLength(0)
    expect(client.responses.create).toHaveBeenCalledWith(expect.objectContaining({ model: 'gpt-5.5', instructions: 'sys' }), expect.any(Object))
  })

  it('executes function calls, preserves response output, accumulates sources and finishes', async () => {
    ;(executeTool as ReturnType<typeof vi.fn>).mockResolvedValue({
      result: 'CTX about MAD financing',
      sources: [{ id: 's1', label: 'Loan', metadata: { review_status: 'approved' }, preview: 'p' }],
    })
    const client = fakeOpenAI([
      { output: [{ type: 'function_call', call_id: 'call_1', name: 'search_documents', arguments: '{"query":"financiacion MAD"}' }] },
      { output_text: 'Los terminos son ...' },
    ])

    const r = await runOpenAIAgentLoop([{ role: 'user', content: 'terminos financiacion MAD' }], 'sys', { client: client as never })

    expect(executeTool).toHaveBeenCalledWith('search_documents', { query: 'financiacion MAD' }, expect.objectContaining({ groundingMode: 'standard' }))
    expect(r.message).toBe('Los terminos son ...')
    expect(r.toolCalls).toHaveLength(1)
    expect(r.sources.map((s) => s.id)).toEqual(['s1'])
    expect(r.searchEvidence).toContain('CTX about MAD financing')
    const secondInput = (client.responses.create as ReturnType<typeof vi.fn>).mock.calls[1][0].input as unknown[]
    expect(secondInput).toContainEqual({ type: 'function_call_output', call_id: 'call_1', output: 'CTX about MAD financing' })
  })
})

describe('runAgentLoopOpenAIPrimary', () => {
  it('uses OpenAI and tags provider=openai on success', async () => {
    const client = fakeOpenAI([{ output_text: 'ok from openai' }])
    const r = await runAgentLoopOpenAIPrimary(
      { messages: { create: vi.fn() } } as never,
      [{ role: 'user', content: 'q' }],
      'sys',
      'claude-sonnet-4-6',
      undefined,
      undefined,
      { groundingMode: 'standard', client: client as never },
    )
    expect(r.provider).toBe('openai')
    expect(r.message).toBe('ok from openai')
  })

  it('falls back to Anthropic/Gemini only for OpenAI availability errors', async () => {
    const client = { responses: { create: vi.fn(async () => { throw Object.assign(new Error('rate limit'), { status: 429 }) }) } }
    const anthropic = { messages: { create: vi.fn(async () => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'ok from claude' }] })) } } as never
    const r = await runAgentLoopOpenAIPrimary(anthropic, [{ role: 'user', content: 'q' }], 'sys', 'claude-sonnet-4-6', undefined, undefined, { client: client as never })
    expect(r.provider).toBe('anthropic')
    expect(r.message).toBe('ok from claude')
  })

  it('rethrows non-availability OpenAI errors instead of masking configuration bugs', async () => {
    const client = { responses: { create: vi.fn(async () => { throw Object.assign(new Error('invalid model id'), { status: 400 }) }) } }
    await expect(
      runAgentLoopOpenAIPrimary({ messages: { create: vi.fn() } } as never, [{ role: 'user', content: 'q' }], 'sys', 'claude-sonnet-4-6', undefined, undefined, { client: client as never }),
    ).rejects.toThrow('invalid model id')
  })
})
