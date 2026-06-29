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
    const documentIngestE2e = readFileSync(resolve(root, 'scripts/e2e/document-ingest.ts'), 'utf8')

    for (const id of criticalAnswerIds) {
      expect(workflow, id).toContain(id)
    }

    for (const step of [
      'Smart document search eval',
      'Retrieval eval',
      'Prompt behavior eval',
      'OCR fallback smoke',
      'OpenAI quota health',
      'Critical answer eval',
      'Governance eval',
      'Documentary browser E2E - chat/search',
      'Documentary browser E2E - ingest/governance',
      'Validate live gate outcomes',
      'E2E_SUMMARY_DIR',
      'E2E_SERVER_MODE: start',
    ]) {
      expect(workflow).toContain(step)
    }

    for (const script of [
      'npm run eval:smart-search',
      'npm run eval:retrieval',
      'npm run eval:prompt-behavior',
      'npm run eval:ocr-smoke',
      'npm run eval:openai-health',
      'npm run eval:answers',
      'npm run eval:governance',
      'npm run e2e:doc-chat',
      'npm run e2e:doc-ingest',
    ]) {
      expect(workflow).toContain(script)
    }

    expect(workflow).toContain('continue-on-error: true')
    expect(workflow).toContain('steps.openai_health.outcome')
    expect(workflow).toContain('live-rag-e2e collected available artifacts')
    expect(workflow.indexOf('name: OpenAI quota health')).toBeLessThan(workflow.indexOf('name: Documentary browser E2E - chat/search'))
    expect(workflow.indexOf('name: Upload eval and E2E artifacts')).toBeLessThan(workflow.indexOf('name: Validate live gate outcomes'))
    expect(workflow).not.toContain('E2E_ALLOW_SMART_MODEL_FALLBACK')
    expect(documentChatE2e).toContain('chat-source-link-opens-santander-bbva-document')
    expect(documentChatE2e).toContain('chat-history-source-link-opens-santander-bbva-document')
    expect(documentChatE2e).toContain('chat-source-link-opens-buenavista-document')
    expect(documentChatE2e).toContain('/api/chat/conversations/')
    expect(documentChatE2e).toContain('becaff10-41f7-4175-950d-d70e9a1d3b6b')
    expect(documentChatE2e).toContain('502705bf-da6d-44bd-9871-38b1e1a8ab73')
    expect(documentChatE2e).toContain('a[href*="/admin/documents?doc="]')
    expect(documentChatE2e).toContain('E2E_ALLOW_SMART_MODEL_FALLBACK')
    expect(documentChatE2e).toContain('E2E_SERVER_MODE')
    expect(documentChatE2e).toContain('document-chat-summary.json')
    expect(documentChatE2e).toContain('Ranking local')
    expect(documentChatE2e).toContain('acceptableRankingMode')
    expect(documentIngestE2e).toContain('chat-source-link-opens-newly-ingested-document')
    expect(documentIngestE2e).toContain('urlHasDocumentId')
    expect(documentIngestE2e).toContain('E2E_SERVER_MODE')
    expect(documentIngestE2e).toContain('document-ingest-summary.json')
  })

  it('keeps the documentary release checklist aligned with the live gates', () => {
    const readiness = readFileSync(resolve(root, 'docs/release-readiness-chat-documental-2026-06-29.md'), 'utf8')
    const packageJson = readFileSync(resolve(root, 'package.json'), 'utf8')

    for (const required of [
      'npm run eval:openai-health -- release-openai-health',
      'npm run eval:release-readiness',
      '--e2e-dir /tmp/gemswell-e2e-documents-prod',
      '--smart-search-eval scripts/eval/results/smart-search-<label>.json',
      '--retrieval-eval scripts/eval/results/retrieval-<label>.json',
      'document-chat-summary.json',
      'document-ingest-summary.json',
      'summary.documentary.cross.recallAt1: 1',
      'gh api -X POST repos/moimene/gemswell-mis/actions/workflows/303814927/dispatches -f ref=main',
      'E2E_BASE_URL=http://localhost:3127',
      'E2E_SUMMARY_DIR=/tmp/gemswell-e2e-documents-prod',
      'npm run e2e:documents',
      'E2E_ALLOW_SMART_MODEL_FALLBACK=true',
      'rerankOrModelUsed: true',
      'acceptableRankingMode: true',
      'Ranking local',
      'quota_or_billing',
      'no investigar RAG primero',
      '28380967059',
      '28385163901',
      '28388533419',
    ]) {
      expect(readiness).toContain(required)
    }
    expect(packageJson).toContain('"eval:release-readiness"')
  })

  it('keeps governance gates wired to deterministic cited-source checks', () => {
    const runner = readFileSync(resolve(root, 'scripts/eval/run-governance.ts'), 'utf8')

    expect(runner).toContain('governance.superseded_never_cited')
    expect(runner).toContain('governance.unreviewed_disclosed')
    expect(runner).toContain('lifecycle=superseded')
    expect(runner).toContain('status=retired')
    expect(runner).toContain('review_status=rejected')
    expect(runner).toContain('classification_source=agent_rejected')
    expect(runner).toContain('missing_document_metadata')
  })

  it('keeps outage-vs-governance behavior covered by forced retrieval failures', () => {
    const retrieve = readFileSync(resolve(root, 'src/lib/rag/retrieve.ts'), 'utf8')
    const tests = readFileSync(resolve(root, 'src/lib/rag/__tests__/retrieve.test.ts'), 'utf8')
    const targets = readFileSync(resolve(root, 'scripts/eval/targets.ts'), 'utf8')

    expect(targets).toContain('governance.outage_not_governance')
    expect(retrieve).toContain('RAG_FORCE_VECTOR_FAIL')
    expect(retrieve).toContain('RAG_FORCE_KEYWORD_FAIL')
    expect(tests).toContain('supports RAG_FORCE_*_FAIL flags for outage governance regression tests')
    expect(tests).toContain('transient retrieval failure')
    expect(tests).toContain('not.toMatch(/governance|rejected|withheld/i)')
  })

  it('keeps prompt-behavior adversarial cases in the live checker', () => {
    const checker = readFileSync(resolve(root, 'scripts/eval/prompt-behavior-check.ts'), 'utf8')

    for (const id of criticalPromptBehaviorIds) {
      expect(checker, id).toContain(id)
    }

    expect(checker).toContain('found\\s+no\\s+(?:documentary\\s+)?evidence')
    expect(checker).toContain('no\\s+documentary\\s+evidence')
    expect(checker).toContain('(?:do|did)\\s+not\\s+find(?:\\s+\\w+){0,4}\\s+evidence')
    expect(checker).toContain('(?:do|did)\\s+not\\s+find(?:\\s+\\w+){0,10}\\s+(?:policy|treasury|hedging)')
    expect(checker).toContain('te\\s+refieres')
  })
})
