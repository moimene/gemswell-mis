import { describe, expect, it } from 'vitest'
import { isAbstentionText } from '../prompt-behavior-check'

describe('prompt behavior abstention detector', () => {
  it('recognizes English no-evidence abstentions', () => {
    expect(isAbstentionText('Based on a search of the document corpus, there is no evidence of a specific treasury or hedging policy related to crypto.')).toBe(true)
    expect(isAbstentionText('I found no documentary evidence for that policy.')).toBe(true)
  })

  it('does not classify ordinary positive answers as abstentions', () => {
    expect(isAbstentionText('The contract sets a margin of EURIBOR plus 4.00% and cites the financing agreement.')).toBe(false)
  })
})
