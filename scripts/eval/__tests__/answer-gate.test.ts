import { describe, expect, it } from 'vitest'
import { answerGateFailure, deterministicWeakPass } from '../run-answers'

const weakVerdict = {
  faithfulness: 4,
  citation_precision: 5,
  completeness: 5,
  found_ground_truth: true,
  behavior_correct: true,
  verdict: 'weak' as const,
  notes: 'Mostly correct',
  judge_provider: 'gemini' as const,
  judge_model: 'gemini-2.5-flash',
}

const det = {
  citedExpectedDoc: true,
  answerHasMustContain: true,
  answerHasAllMustContain: true,
  usedExpectedTool: true,
  toolNames: ['search_documents'],
  citedProjects: ['MAD'],
  abstainedHeuristic: false,
}

describe('answer eval gate', () => {
  it('accepts weak judge verdicts only when deterministic documentary anchors are complete', () => {
    const row = {
      g: { expected_kind: 'documentary' as const, ground_truth: { must_contain: ['EURIBOR', '4,00'] } },
      det,
      verdict: weakVerdict,
    }

    expect(deterministicWeakPass(row)).toBe(true)
    expect(answerGateFailure(row)).toBeNull()
  })

  it('keeps weak verdicts failing when hard expected text is missing', () => {
    const row = {
      g: { expected_kind: 'documentary' as const, ground_truth: { must_contain: ['EURIBOR', '4,00'] } },
      det: { ...det, answerHasAllMustContain: false },
      verdict: weakVerdict,
    }

    expect(deterministicWeakPass(row)).toBe(false)
    expect(answerGateFailure(row)).toBe('verdict=weak')
  })

  it('does not override low-faithfulness weak verdicts', () => {
    const row = {
      g: { expected_kind: 'documentary' as const, ground_truth: { must_contain: ['EURIBOR'] } },
      det,
      verdict: { ...weakVerdict, faithfulness: 3 },
    }

    expect(deterministicWeakPass(row)).toBe(false)
  })
})
