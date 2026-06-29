import { describe, expect, it } from 'vitest'
import { collectCitedDocumentIds, evaluateGovernanceRows, type GovernanceDocMeta } from '../run-governance'

const approvedMeta: GovernanceDocMeta = {
  id: 'doc-approved',
  title: 'Approved contract',
  review_status: 'approved',
  classification_source: 'agent_reviewed',
  lifecycle: null,
  status: 'active',
}

function meta(overrides: Partial<GovernanceDocMeta>): GovernanceDocMeta {
  return { ...approvedMeta, ...overrides }
}

describe('governance eval', () => {
  it('collects unique cited document ids from answer rows', () => {
    const ids = collectCitedDocumentIds([
      { r: { sources: [{ document_id: 'a' }, { documentId: 'b' }, { document_id: 'a' }, { label: 'no id' }] } },
      { r: { sources: [{ document_id: 'c' }] } },
    ])

    expect(ids).toEqual(['a', 'b', 'c'])
  })

  it('fails when a cited source is missing metadata or is governance-excluded', () => {
    const rows = [{
      g: { id: 'bank-cost' },
      r: {
        answer: 'Answer with sources.',
        sources: [
          { document_id: 'doc-superseded', title: 'Old contract' },
          { document_id: 'doc-retired', title: 'Retired contract' },
          { document_id: 'doc-rejected', title: 'Rejected contract' },
          { document_id: 'doc-agent-rejected', title: 'Agent rejected contract' },
          { document_id: 'doc-missing', title: 'Missing contract' },
        ],
      },
    }]
    const evaluation = evaluateGovernanceRows(rows, new Map([
      ['doc-superseded', meta({ id: 'doc-superseded', lifecycle: 'superseded' })],
      ['doc-retired', meta({ id: 'doc-retired', status: 'retired' })],
      ['doc-rejected', meta({ id: 'doc-rejected', review_status: 'rejected' })],
      ['doc-agent-rejected', meta({ id: 'doc-agent-rejected', classification_source: 'agent_rejected' })],
    ]))

    const invalid = evaluation.checks.find((check) => check.metric === 'governance.superseded_never_cited')!
    expect(invalid.ok).toBe(false)
    expect(invalid.failures.map((failure) => failure.reason)).toEqual([
      'lifecycle=superseded',
      'status=retired',
      'review_status=rejected',
      'classification_source=agent_rejected',
      'missing_document_metadata',
    ])
  })

  it('requires an explicit disclosure when unreviewed evidence is cited', () => {
    const rows = [{
      g: { id: 'unreviewed-answer' },
      r: {
        answer: 'El coste es Euribor mas margen segun el contrato.',
        sources: [{ document_id: 'doc-unreviewed', title: 'Draft financing terms' }],
      },
    }]
    const evaluation = evaluateGovernanceRows(rows, new Map([
      ['doc-unreviewed', meta({ id: 'doc-unreviewed', review_status: 'needs_review' })],
    ]))

    const disclosure = evaluation.checks.find((check) => check.metric === 'governance.unreviewed_disclosed')!
    expect(disclosure.ok).toBe(false)
    expect(disclosure.failures[0]).toMatchObject({
      row_id: 'unreviewed-answer',
      document_id: 'doc-unreviewed',
      reason: 'unreviewed_source_not_disclosed:needs_review',
    })
  })

  it('passes approved citations and disclosed unreviewed citations', () => {
    const rows = [{
      g: { id: 'disclosed-answer' },
      r: {
        answer: 'Uso una fuente sin revisar: el coste es Euribor mas margen.',
        sources: [{ document_id: 'doc-approved' }, { document_id: 'doc-needs-review' }],
      },
    }]
    const evaluation = evaluateGovernanceRows(rows, new Map([
      ['doc-approved', approvedMeta],
      ['doc-needs-review', meta({ id: 'doc-needs-review', review_status: 'needs_review' })],
    ]))

    expect(evaluation.failures).toEqual([])
    expect(evaluation.checks.every((check) => check.ok)).toBe(true)
  })
})
