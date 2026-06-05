import { describe, it, expect } from 'vitest'
import { reconstructMarkdown } from '@/lib/knowledge/markdown-reconstruct'

describe('reconstructMarkdown', () => {
  it('orders by chunk_index and joins with blank line', () => {
    const md = reconstructMarkdown([
      { chunk_index: 2, content: 'second' },
      { chunk_index: 0, content: 'first' },
      { chunk_index: 1, content: 'middle' },
    ])
    expect(md).toBe('first\n\nmiddle\n\nsecond')
  })
  it('drops empty/whitespace chunks', () => {
    expect(reconstructMarkdown([{ chunk_index: 0, content: '  ' }, { chunk_index: 1, content: 'x' }])).toBe('x')
  })
  it('empty input → empty string', () => {
    expect(reconstructMarkdown([])).toBe('')
  })
})
