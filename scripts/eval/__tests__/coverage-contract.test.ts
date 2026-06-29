import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

type GoldenCase = {
  id: string
  expected_kind: string
  category?: string
  ground_truth?: {
    expected_doc_ids?: string[]
    tool?: string
    must_contain?: string[]
  }
}

type SmartGoldenCase = {
  id: string
  expected_doc_ids?: string[]
  must_snippet?: string[]
  must_entities?: string[]
}

const root = process.cwd()

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(resolve(root, path), 'utf8')) as T
}

const criticalAnswerIds = [
  'mad-dec-capitalcall',
  'cross-project-legal',
  'mad-buenavista-conditions',
  'mad-santander-bbva-bank-cost',
  'named-absent-abstain',
  'zero-ski',
  'ambiguous-cost',
] as const

const criticalPromptBehaviorIds = [
  'buenavista-find',
  'pacto-socios-doc',
  'bhx-loan-doc',
  'sukarrieta-abstain',
  'zero-ski-abstain',
  'zero-crypto-abstain',
  'ambiguous-clarify',
] as const

describe('critical eval coverage contract', () => {
  it('keeps the live answer-eval critical set pinned in golden.json', () => {
    const golden = readJson<GoldenCase[]>('scripts/eval/golden.json')
    const byId = new Map(golden.map((row) => [row.id, row]))

    for (const id of criticalAnswerIds) {
      expect(byId.has(id), id).toBe(true)
    }

    for (const id of ['mad-dec-capitalcall', 'cross-project-legal', 'mad-buenavista-conditions', 'mad-santander-bbva-bank-cost']) {
      const row = byId.get(id)!
      expect(row.expected_kind, id).toBe('documentary')
      expect(row.ground_truth?.expected_doc_ids?.length, id).toBeGreaterThan(0)
    }

    expect(byId.get('named-absent-abstain')?.ground_truth?.tool).toBe('search_documents')
    expect(byId.get('zero-ski')?.ground_truth?.tool).toBe('search_documents')
    expect(byId.get('ambiguous-cost')?.expected_kind).toBe('ambiguous')
  })

  it('keeps smart-search goldens tied to the same contract documents', () => {
    const smart = readJson<SmartGoldenCase[]>('scripts/eval/smart-search-golden.json')
    const byId = new Map(smart.map((row) => [row.id, row]))

    expect(byId.get('smart-mad-santander-bbva-cost')?.expected_doc_ids).toContain('becaff10-41f7-4175-950d-d70e9a1d3b6b')
    expect(byId.get('smart-mad-santander-bbva-cost')?.must_snippet).toEqual(expect.arrayContaining(['EURIBOR', 'Margen']))
    expect(byId.get('smart-mad-santander-bbva-cost')?.must_entities).toEqual(expect.arrayContaining(['Banco Santander', 'BBVA', 'MAD']))

    expect(byId.get('smart-mad-buenavista-conditions')?.expected_doc_ids).toContain('502705bf-da6d-44bd-9871-38b1e1a8ab73')
    expect(byId.get('smart-mad-buenavista-conditions')?.must_snippet).toEqual(expect.arrayContaining(['Buenavista', '15.657.498,18']))

    expect(byId.get('smart-klp-pacto-socios')?.expected_doc_ids).toContain('7346215e-1c19-4165-80ec-012aa4859aa5')
  })

  it('keeps live-rag-e2e wired to the critical eval and browser gates', () => {
    const workflow = readFileSync(resolve(root, '.github/workflows/live-rag-e2e.yml'), 'utf8')
    const documentChatE2e = readFileSync(resolve(root, 'scripts/e2e/document-chat.ts'), 'utf8')

    for (const id of criticalAnswerIds) {
      expect(workflow, id).toContain(id)
    }

    for (const step of [
      'Smart document search eval',
      'Retrieval eval',
      'Prompt behavior eval',
      'OCR fallback smoke',
      'Critical answer eval',
      'Documentary browser E2E - chat/search',
      'Documentary browser E2E - ingest/governance',
    ]) {
      expect(workflow).toContain(step)
    }

    for (const script of [
      'npm run eval:smart-search',
      'npm run eval:retrieval',
      'npm run eval:prompt-behavior',
      'npm run eval:ocr-smoke',
      'npm run eval:answers',
      'npm run e2e:doc-chat',
      'npm run e2e:doc-ingest',
    ]) {
      expect(workflow).toContain(script)
    }

    expect(documentChatE2e).toContain('chat-source-link-opens-santander-bbva-document')
    expect(documentChatE2e).toContain('becaff10-41f7-4175-950d-d70e9a1d3b6b')
    expect(documentChatE2e).toContain('a[href*="/admin/documents?doc="]')
  })

  it('keeps prompt-behavior adversarial cases in the live checker', () => {
    const checker = readFileSync(resolve(root, 'scripts/eval/prompt-behavior-check.ts'), 'utf8')

    for (const id of criticalPromptBehaviorIds) {
      expect(checker, id).toContain(id)
    }

    expect(checker).toContain('found\\s+no\\s+(?:documentary\\s+)?evidence')
    expect(checker).toContain('no\\s+documentary\\s+evidence')
    expect(checker).toContain('te\\s+refieres')
  })
})
