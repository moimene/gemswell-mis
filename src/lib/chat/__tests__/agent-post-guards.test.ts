import { describe, expect, it } from 'vitest'
import { enforcePostAnswerGuards, type Source } from '../agent'

function source(overrides: Partial<Source> = {}): Source {
  return {
    id: 'source-1',
    documentId: 'doc-1',
    relevance: 0.9,
    label: 'MAD | funding | Draft term sheet [SIN REVISAR]',
    metadata: { review_status: 'needs_review', classification_source: 'agent_auto' },
    preview: 'Euribor plus margin.',
    verification: 'context',
    ...overrides,
  }
}

const baseInput = {
  query: 'resume la financiacion',
  answer: 'La financiacion tiene margen sobre Euribor.',
  toolCalls: [],
  degraded: false,
  injectionFlagged: false,
  retrievalIncomplete: false,
  groundingMode: 'standard' as const,
}

describe('enforcePostAnswerGuards', () => {
  it('adds governance disclosure when cited sources are unreviewed', async () => {
    const result = await enforcePostAnswerGuards({
      ...baseInput,
      sources: [source()],
    })

    expect(result.answer).toContain('Nota de gobernanza')
    expect(result.answer).toContain('fuentes citadas sin revisar')
    expect(result.answer).toContain('review_status needs_review')
  })

  it('does not duplicate an existing unreviewed-source disclosure', async () => {
    const result = await enforcePostAnswerGuards({
      ...baseInput,
      answer: 'La fuente esta sin revisar; la uso solo como contexto.',
      sources: [source()],
    })

    expect(result.answer.match(/sin revisar/g)).toHaveLength(1)
    expect(result.answer).not.toContain('Nota de gobernanza')
  })

  it('does not add disclosure for approved citations', async () => {
    const result = await enforcePostAnswerGuards({
      ...baseInput,
      sources: [source({
        label: 'MAD | funding | Signed loan agreement',
        metadata: { review_status: 'approved', classification_source: 'agent_reviewed' },
        verification: 'source_of_record',
      })],
    })

    expect(result.answer).toBe(baseInput.answer)
  })
})
