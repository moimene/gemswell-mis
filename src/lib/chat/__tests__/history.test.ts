import { describe, it, expect } from 'vitest'
import { mapStoredMessage } from '../history'

describe('mapStoredMessage (conversation restore)', () => {
  it('maps a persisted assistant turn with sources + tool_calls', () => {
    const m = mapStoredMessage({
      role: 'assistant',
      content: 'Los términos son ...',
      sources: [{ chunk_id: 'c1', document_id: 'd1', relevance: 0.42, label: 'Loan Agreement', verification: 'source_of_record', metadata: { review_status: 'approved' }, preview: 'snippet' }],
      tool_calls: [{ name: 'search_documents', input: { query: 'x' } }],
    })
    expect(m.role).toBe('assistant')
    expect(m.persisted).toBe(true)
    expect(m.sources).toHaveLength(1)
    expect(m.sources![0]).toMatchObject({ id: 'c1', documentId: 'd1', relevance: 0.42, label: 'Loan Agreement', verification: 'source_of_record', preview: 'snippet' })
    expect(m.sources![0].metadata).toEqual({ review_status: 'approved' })
    expect(m.toolCalls).toHaveLength(1)
  })

  it('maps a user turn (no sources/tools)', () => {
    const m = mapStoredMessage({ role: 'user', content: 'hola' })
    expect(m.role).toBe('user')
    expect(m.content).toBe('hola')
    expect(m.sources).toBeUndefined()
    expect(m.toolCalls).toBeUndefined()
  })

  it('tolerates legacy rows missing preview / null fields', () => {
    const m = mapStoredMessage({ role: 'assistant', content: 'x', sources: [{ chunk_id: 'c2', document_id: null, relevance: null as unknown as number }] })
    expect(m.sources![0].preview).toBe('') // legacy rows pre-date preview
    expect(m.sources![0].documentId).toBeUndefined()
    expect(m.sources![0].relevance).toBe(0)
    expect(m.sources![0].metadata).toEqual({})
  })

  it('coerces an unexpected role to user and missing content to empty string', () => {
    const m = mapStoredMessage({ role: 'system' as unknown as string, content: null })
    expect(m.role).toBe('user')
    expect(m.content).toBe('')
  })
})
