import { describe, it, expect } from 'vitest'
import { formatToolCall, type ToolCallDisplay } from '@/lib/chat/tool-call-display'

const base = { iteration: 1, is_error: false, source_count: 0, result_preview: '' }

describe('formatToolCall — M4: make structured-answer provenance inspectable in the chat UI', () => {
  it('maps each known tool name to a friendly Spanish label', () => {
    const names = [
      'search_documents', 'get_capex_summary', 'get_funding_status', 'get_cash_runway',
      'get_covenant_status', 'get_risk_register', 'get_contradictions', 'get_portfolio_context', 'compare_projects',
    ]
    for (const name of names) {
      const d = formatToolCall({ ...base, name, input: {} })
      expect(d.label, `label for ${name}`).toBeTruthy()
      expect(d.label).not.toBe(name) // a friendly label, not the raw tool id
    }
  })

  it('falls back to the raw name for an unknown tool (forward-compatible)', () => {
    const d = formatToolCall({ ...base, name: 'some_new_tool', input: {} })
    expect(d.label).toContain('some_new_tool')
  })

  it('summarizes the input compactly (project + query), ignoring noise', () => {
    const d = formatToolCall({ ...base, name: 'search_documents', input: { query: 'capex Madrid 2026', project_id: 'MAD' } })
    expect(d.detail).toContain('MAD')
    expect(d.detail).toContain('capex Madrid 2026')
  })

  it('flags an errored tool call', () => {
    const ok = formatToolCall({ ...base, name: 'get_capex_summary', input: { project_id: 'MAD' } })
    const bad = formatToolCall({ ...base, name: 'get_capex_summary', input: { project_id: 'MAD' }, is_error: true })
    expect(ok.isError).toBe(false)
    expect(bad.isError).toBe(true)
  })

  it('surfaces the source count for a documentary search', () => {
    const d = formatToolCall({ ...base, name: 'search_documents', input: { query: 'x' }, source_count: 7 })
    expect(d.sourceCount).toBe(7)
  })

  it('never throws on a malformed/empty input (defensive — input is unknown JSON)', () => {
    const cases: unknown[] = [null, undefined, 'a string', 42, [], { project_id: 123 }]
    for (const input of cases) {
      const d: ToolCallDisplay = formatToolCall({ ...base, name: 'search_documents', input })
      expect(typeof d.label).toBe('string')
      expect(typeof d.detail).toBe('string')
    }
  })
})
