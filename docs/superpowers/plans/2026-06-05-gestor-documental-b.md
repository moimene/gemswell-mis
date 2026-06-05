# Gestor Documental Gobernado (Spec B) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the human decision layer over A's machine-governed corpus — `/api/knowledge/*` APIs + `/admin/documents` UI to review/approve/reject/reclassify/retire/restore/supersede documents, view reconstructed markdown + chunks + audit history, and see corpus-health, all writing `rag_documents` + append-only `rag_document_events`.

**Architecture:** Pure logic in `src/lib/knowledge/*` (unit-tested with vitest), thin API routes in `src/app/api/knowledge/*` (`createApiClient`, service role, no auth this phase), client UI in `src/app/admin/documents/*` (`'use client'` + `useEffect`/`fetch`, sonner toasts, lucide, slate Tailwind — same pattern as `src/app/admin/review/page.tsx`). The trust gate (`source_of_record`) is already enforced by `src/lib/knowledge/source-reference.ts`; the PATCH only writes the correct `classification_source`. No new governance migrations — every column/enum exists (verified live on `nqxhsjkcvfxygiajdxki`).

**Tech Stack:** Next.js 16 App Router, Supabase (`@supabase/supabase-js` via `createApiClient`), vitest + tsx, Tailwind, lucide-react, sonner.

**Spec:** `docs/superpowers/specs/2026-06-05-gestor-documental-gobernado-design.md` §7–§9 + `docs/superpowers/specs/2026-06-05-gestor-documental-B-addendum.md` (decisions D1–D5).

---

## Pre-flight

- [ ] **P0: Branch.** From merged `main` (HEAD `7c52ebf`), create the feature branch.
```bash
cd gemswell-mis-app
git checkout main && git checkout -b agent/gestor-documental-b
```
- Live DB facts (verified 2026-06-05): 5.498 docs, all `status='indexed'`; review_status approved 3.224 / needs_review 2.274; classification_source agent_auto 3.639 + rule 1.859; 831 docs authority≥90 (797 approved, 34 needs_review); 0 rejected/retired/supersede; `rag_chunks(document_id, chunk_index, content, metadata)`; `rag_document_events(document_id, action, field, old_value, new_value, actor DEFAULT 'system' NOT NULL, reason, created_at)`.

## File Structure

| File | Resp. |
|---|---|
| `src/lib/knowledge/contracts.ts` (MODIFY) | add `GovernanceAction`, `ReclassifyFields`, `DocGovernanceState`, `RETIRED_STATUS` |
| `src/lib/knowledge/governance-actions.ts` (NEW) | pure: `computeGovernanceAction()` + `InvalidTransitionError` — encodes D2/D4/D5 |
| `src/lib/knowledge/documents-query.ts` (NEW) | pure: `parseListParams()`, `LIST_COLUMNS` |
| `src/lib/knowledge/markdown-reconstruct.ts` (NEW) | pure: `reconstructMarkdown(chunks)` |
| `src/lib/knowledge/corpus-health.ts` (NEW) | pure: `buildCorpusHealth()` |
| `src/lib/knowledge/__tests__/governance-actions.test.ts` (NEW) | unit |
| `src/lib/knowledge/__tests__/documents-query.test.ts` (NEW) | unit |
| `src/lib/knowledge/__tests__/markdown-reconstruct.test.ts` (NEW) | unit |
| `src/lib/knowledge/__tests__/corpus-health.test.ts` (NEW) | unit |
| `src/app/api/knowledge/documents/route.ts` (NEW) | GET list |
| `src/app/api/knowledge/documents/[id]/route.ts` (NEW) | GET detail + PATCH actions |
| `src/app/api/knowledge/corpus/health/route.ts` (NEW) | GET health |
| `src/app/admin/documents/page.tsx` (NEW) | table + filters + selection |
| `src/app/admin/documents/_components/badges.tsx` (NEW) | review/authority/verification badges |
| `src/app/admin/documents/_components/DocumentPanel.tsx` (NEW) | detail + 5 actions + viewer + events |
| `src/app/admin/documents/_components/SupersedePicker.tsx` (NEW) | doc picker modal |
| `src/app/admin/documents/_components/CorpusHealth.tsx` (NEW) | health header |
| `src/components/layout/Sidebar.tsx` (MODIFY) | nav link |
| `scripts/verify-gestor-b.ts` (NEW) | live e2e verification (throwaway test doc) |

---

## Task 1: Contracts additions

**Files:** Modify `src/lib/knowledge/contracts.ts`

- [ ] **Step 1: Append governance-action types** to the end of `contracts.ts`:

```ts
// ─── Governance actions (Spec B) ────────────────────────────────────────────
export type GovernanceAction =
  | 'approve' | 'reject' | 'reclassify' | 'retire' | 'restore' | 'supersede'

/** status is a text column; retire sets this sentinel (RPC filters status='indexed') */
export const RETIRED_STATUS = 'retired' as const

export type ReclassifyFields = Partial<{
  project_id: string | null
  doc_type: DocType
  authority_tier: AuthorityTier
  authority_score: number
  period: string | null
  lifecycle: Lifecycle
}>

/** Minimal governance snapshot of a rag_documents row needed to compute an action. */
export type DocGovernanceState = {
  review_status: ReviewStatus
  classification_source: ClassificationSource
  status: string
  authority_score: number
  authority_tier: AuthorityTier
  current_version: number
  supersedes_document_id?: string | null
}

/** classification_source values that already count as human-validated (mirror source-reference). */
export const HUMAN_VALIDATED_SOURCES: ReadonlySet<ClassificationSource> =
  new Set<ClassificationSource>(['human', 'agent_reviewed', 'agent_corrected'])
```

- [ ] **Step 2: Commit**
```bash
git add src/lib/knowledge/contracts.ts
git commit -m "feat(knowledge): governance-action contracts for gestor (Spec B)"
```

---

## Task 2: `governance-actions.ts` — the action engine (TDD)

**Files:** Create `src/lib/knowledge/governance-actions.ts`, Test `src/lib/knowledge/__tests__/governance-actions.test.ts`

Encodes: **D2** approve→`agent_reviewed` (only upgrades machine sources; never downgrades `agent_corrected`/`human`); reclassify→`agent_corrected`; **D5** reject→`review_status='rejected'` (source untouched); retire/restore toggle `status`; **D4** supersede links + retires the old doc.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { computeGovernanceAction, InvalidTransitionError } from '@/lib/knowledge/governance-actions'
import type { DocGovernanceState } from '@/lib/knowledge/contracts'

const base: DocGovernanceState = {
  review_status: 'needs_review',
  classification_source: 'agent_auto',
  status: 'indexed',
  authority_score: 95,
  authority_tier: 'audited',
  current_version: 1,
  supersedes_document_id: null,
}

describe('computeGovernanceAction', () => {
  it('approve from needs_review (machine) → approved + agent_reviewed + event', () => {
    const r = computeGovernanceAction({ action: 'approve', documentId: 'd1', current: base, actor: 'admin:console' })
    expect(r.patch.review_status).toBe('approved')
    expect(r.patch.classification_source).toBe('agent_reviewed')
    expect(r.events).toHaveLength(1)
    expect(r.events[0]).toMatchObject({ document_id: 'd1', action: 'approve', actor: 'admin:console' })
  })

  it('approve on already-approved machine doc → endorses (classification_source→agent_reviewed)', () => {
    const r = computeGovernanceAction({ action: 'approve', documentId: 'd1',
      current: { ...base, review_status: 'approved', classification_source: 'rule' }, actor: 'a' })
    expect(r.patch.review_status).toBe('approved')
    expect(r.patch.classification_source).toBe('agent_reviewed')
  })

  it('approve never downgrades agent_corrected', () => {
    const r = computeGovernanceAction({ action: 'approve', documentId: 'd1',
      current: { ...base, review_status: 'approved', classification_source: 'agent_corrected' }, actor: 'a' })
    expect(r.patch.classification_source).toBeUndefined() // unchanged → not in patch
  })

  it('reject → rejected, classification_source untouched', () => {
    const r = computeGovernanceAction({ action: 'reject', documentId: 'd1', current: base, actor: 'a', reason: 'dup' })
    expect(r.patch.review_status).toBe('rejected')
    expect(r.patch.classification_source).toBeUndefined()
    expect(r.events[0]).toMatchObject({ action: 'reject', reason: 'dup' })
  })

  it('reclassify derives authority_score from tier when only tier given, sets agent_corrected', () => {
    const r = computeGovernanceAction({ action: 'reclassify', documentId: 'd1',
      current: { ...base, authority_score: 0, authority_tier: 'unverified' },
      fields: { doc_type: 'legal', authority_tier: 'controller' }, actor: 'a' })
    expect(r.patch.doc_type).toBe('legal')
    expect(r.patch.authority_tier).toBe('controller')
    expect(r.patch.authority_score).toBe(80) // AUTHORITY_TIER_SCORE.controller
    expect(r.patch.classification_source).toBe('agent_corrected')
    expect(r.events.length).toBeGreaterThanOrEqual(1)
  })

  it('reclassify respects explicit authority_score over tier default', () => {
    const r = computeGovernanceAction({ action: 'reclassify', documentId: 'd1', current: base,
      fields: { authority_tier: 'controller', authority_score: 88 }, actor: 'a' })
    expect(r.patch.authority_score).toBe(88)
  })

  it('retire from indexed → status retired', () => {
    const r = computeGovernanceAction({ action: 'retire', documentId: 'd1', current: base, actor: 'a' })
    expect(r.patch.status).toBe('retired')
  })

  it('retire when already retired → InvalidTransitionError', () => {
    expect(() => computeGovernanceAction({ action: 'retire', documentId: 'd1',
      current: { ...base, status: 'retired' }, actor: 'a' })).toThrow(InvalidTransitionError)
  })

  it('restore from retired → status indexed', () => {
    const r = computeGovernanceAction({ action: 'restore', documentId: 'd1',
      current: { ...base, status: 'retired' }, actor: 'a' })
    expect(r.patch.status).toBe('indexed')
  })

  it('restore when not retired → InvalidTransitionError', () => {
    expect(() => computeGovernanceAction({ action: 'restore', documentId: 'd1', current: base, actor: 'a' }))
      .toThrow(InvalidTransitionError)
  })

  it('supersede: new doc links old, old doc retired+superseded, version bumps, events on both', () => {
    const oldDoc: DocGovernanceState = { ...base, current_version: 3 }
    const r = computeGovernanceAction({ action: 'supersede', documentId: 'new1', current: base,
      supersede: { oldId: 'old1', oldDoc }, actor: 'a', reason: 'v4 signed' })
    expect(r.patch.supersedes_document_id).toBe('old1')
    expect(r.patch.current_version).toBe(4) // max(1, 3+1)
    expect(r.related).toEqual({ id: 'old1', patch: { status: 'retired', lifecycle: 'superseded' } })
    const docIds = r.events.map(e => e.document_id).sort()
    expect(docIds).toEqual(['new1', 'old1'])
  })

  it('supersede self → InvalidTransitionError', () => {
    expect(() => computeGovernanceAction({ action: 'supersede', documentId: 'd1', current: base,
      supersede: { oldId: 'd1', oldDoc: base }, actor: 'a' })).toThrow(InvalidTransitionError)
  })
})
```

- [ ] **Step 2: Run → verify it fails**
Run: `npm test -- governance-actions`
Expected: FAIL ("Cannot find module '@/lib/knowledge/governance-actions'")

- [ ] **Step 3: Implement** `src/lib/knowledge/governance-actions.ts`:

```ts
import { AUTHORITY_TIER_SCORE, HUMAN_VALIDATED_SOURCES, RETIRED_STATUS } from '@/lib/knowledge/contracts'
import type {
  ClassificationSource, DocGovernanceState, GovernanceAction, ReclassifyFields,
} from '@/lib/knowledge/contracts'

export class InvalidTransitionError extends Error {
  constructor(message: string) { super(message); this.name = 'InvalidTransitionError' }
}

export type DocEventInsert = {
  document_id: string
  action: string
  field: string | null
  old_value: string | null
  new_value: string | null
  actor: string
  reason: string | null
}

export type GovernanceActionResult = {
  /** patch to apply to the primary document (documentId) */
  patch: Record<string, unknown>
  /** patch + id for a related document (the superseded old doc), if any */
  related?: { id: string; patch: Record<string, unknown> }
  /** append-only audit rows, each with explicit document_id */
  events: DocEventInsert[]
}

export type GovernanceActionInput = {
  action: GovernanceAction
  documentId: string
  current: DocGovernanceState
  actor: string
  reason?: string
  fields?: ReclassifyFields
  supersede?: { oldId: string; oldDoc: DocGovernanceState }
}

function ev(
  documentId: string, action: string, field: string | null,
  oldValue: unknown, newValue: unknown, actor: string, reason?: string,
): DocEventInsert {
  return {
    document_id: documentId, action, field,
    old_value: oldValue == null ? null : String(oldValue),
    new_value: newValue == null ? null : String(newValue),
    actor, reason: reason ?? null,
  }
}

export function computeGovernanceAction(input: GovernanceActionInput): GovernanceActionResult {
  const { action, documentId, current, actor, reason, fields, supersede } = input

  switch (action) {
    case 'approve': {
      const patch: Record<string, unknown> = {}
      const events: DocEventInsert[] = []
      if (current.review_status !== 'approved') {
        patch.review_status = 'approved'
        events.push(ev(documentId, 'approve', 'review_status', current.review_status, 'approved', actor, reason))
      }
      // endorse: upgrade machine sources to agent_reviewed; never downgrade human-validated
      if (!HUMAN_VALIDATED_SOURCES.has(current.classification_source)) {
        patch.classification_source = 'agent_reviewed' as ClassificationSource
        events.push(ev(documentId, 'approve', 'classification_source', current.classification_source, 'agent_reviewed', actor, reason))
      }
      if (events.length === 0) {
        // already approved + already human-validated → record an idempotent endorse event
        events.push(ev(documentId, 'approve', null, null, null, actor, reason))
      }
      return { patch, events }
    }

    case 'reject': {
      if (current.review_status === 'rejected') throw new InvalidTransitionError('document already rejected')
      return {
        patch: { review_status: 'rejected' },
        events: [ev(documentId, 'reject', 'review_status', current.review_status, 'rejected', actor, reason)],
      }
    }

    case 'reclassify': {
      if (!fields || Object.keys(fields).length === 0) throw new InvalidTransitionError('reclassify requires fields')
      const patch: Record<string, unknown> = {}
      const events: DocEventInsert[] = []
      for (const key of ['project_id', 'doc_type', 'period', 'lifecycle'] as const) {
        if (fields[key] !== undefined) {
          patch[key] = fields[key]
          events.push(ev(documentId, 'reclassify', key, null, fields[key], actor, reason))
        }
      }
      if (fields.authority_tier !== undefined) {
        patch.authority_tier = fields.authority_tier
        const score = fields.authority_score !== undefined
          ? fields.authority_score
          : AUTHORITY_TIER_SCORE[fields.authority_tier]
        patch.authority_score = score
        events.push(ev(documentId, 'reclassify', 'authority_tier', current.authority_tier, fields.authority_tier, actor, reason))
        events.push(ev(documentId, 'reclassify', 'authority_score', current.authority_score, score, actor, reason))
      } else if (fields.authority_score !== undefined) {
        patch.authority_score = fields.authority_score
        events.push(ev(documentId, 'reclassify', 'authority_score', current.authority_score, fields.authority_score, actor, reason))
      }
      // human correction
      patch.classification_source = 'agent_corrected' as ClassificationSource
      events.push(ev(documentId, 'reclassify', 'classification_source', current.classification_source, 'agent_corrected', actor, reason))
      return { patch, events }
    }

    case 'retire': {
      if (current.status === RETIRED_STATUS) throw new InvalidTransitionError('document already retired')
      return {
        patch: { status: RETIRED_STATUS },
        events: [ev(documentId, 'retire', 'status', current.status, RETIRED_STATUS, actor, reason)],
      }
    }

    case 'restore': {
      if (current.status !== RETIRED_STATUS) throw new InvalidTransitionError('document is not retired')
      return {
        patch: { status: 'indexed' },
        events: [ev(documentId, 'restore', 'status', current.status, 'indexed', actor, reason)],
      }
    }

    case 'supersede': {
      if (!supersede) throw new InvalidTransitionError('supersede requires an old document id')
      if (supersede.oldId === documentId) throw new InvalidTransitionError('a document cannot supersede itself')
      const newVersion = Math.max(current.current_version, supersede.oldDoc.current_version + 1)
      return {
        patch: { supersedes_document_id: supersede.oldId, current_version: newVersion },
        related: { id: supersede.oldId, patch: { status: RETIRED_STATUS, lifecycle: 'superseded' } },
        events: [
          ev(documentId, 'supersede', 'supersedes_document_id', null, supersede.oldId, actor, reason),
          ev(supersede.oldId, 'superseded_by', 'status', supersede.oldDoc.status, RETIRED_STATUS, actor, reason),
        ],
      }
    }

    default:
      throw new InvalidTransitionError(`unknown action: ${action as string}`)
  }
}
```

- [ ] **Step 4: Run → verify it passes**
Run: `npm test -- governance-actions`
Expected: PASS (13 tests)

- [ ] **Step 5: Commit**
```bash
git add src/lib/knowledge/governance-actions.ts src/lib/knowledge/__tests__/governance-actions.test.ts
git commit -m "feat(knowledge): governance-action engine + tests (D2/D4/D5)"
```

---

## Task 3: `documents-query.ts` — list param parsing (TDD)

**Files:** Create `src/lib/knowledge/documents-query.ts`, Test `__tests__/documents-query.test.ts`

- [ ] **Step 1: Failing test**
```ts
import { describe, it, expect } from 'vitest'
import { parseListParams, LIST_COLUMNS } from '@/lib/knowledge/documents-query'

const sp = (o: Record<string, string>) => new URLSearchParams(o)

describe('parseListParams', () => {
  it('defaults: page 1, size 50, no filters', () => {
    const p = parseListParams(sp({}))
    expect(p).toMatchObject({ page: 1, pageSize: 50, offset: 0 })
    expect(p.status).toBeUndefined()
  })
  it('clamps page>=1 and pageSize 1..200', () => {
    expect(parseListParams(sp({ page: '0', pageSize: '999' })).page).toBe(1)
    expect(parseListParams(sp({ pageSize: '999' })).pageSize).toBe(200)
    expect(parseListParams(sp({ page: '3', pageSize: '20' })).offset).toBe(40)
  })
  it('accepts valid enum filters, drops invalid', () => {
    expect(parseListParams(sp({ status: 'needs_review' })).status).toBe('needs_review')
    expect(parseListParams(sp({ status: 'bogus' })).status).toBeUndefined()
    expect(parseListParams(sp({ doc_type: 'legal' })).doc_type).toBe('legal')
    expect(parseListParams(sp({ doc_type: 'nope' })).doc_type).toBeUndefined()
  })
  it('authority_min parsed as int 0..100, q trimmed', () => {
    expect(parseListParams(sp({ authority_min: '90' })).authorityMin).toBe(90)
    expect(parseListParams(sp({ authority_min: '500' })).authorityMin).toBe(100)
    expect(parseListParams(sp({ q: '  acta  ' })).q).toBe('acta')
  })
  it('LIST_COLUMNS includes governance + enrichment fields', () => {
    expect(LIST_COLUMNS).toContain('review_status')
    expect(LIST_COLUMNS).toContain('authority_score')
    expect(LIST_COLUMNS).toContain('chunk_count')
  })
})
```

- [ ] **Step 2: Run → fail.** `npm test -- documents-query`

- [ ] **Step 3: Implement** `src/lib/knowledge/documents-query.ts`:
```ts
import { DOC_TYPES } from '@/lib/knowledge/contracts'
import type { DocType, ReviewStatus } from '@/lib/knowledge/contracts'

const REVIEW_STATUSES: ReviewStatus[] = ['pending', 'approved', 'rejected', 'needs_review']

export const LIST_COLUMNS = [
  'id', 'title', 'project_id', 'doc_type', 'period', 'review_status',
  'authority_score', 'authority_tier', 'classification_source', 'classification_confidence',
  'status', 'source_channel', 'chunk_count', 'summary', 'md_path', 'source_hash',
  'created_at', 'current_version', 'supersedes_document_id',
].join(', ')

export type ListParams = {
  page: number
  pageSize: number
  offset: number
  status?: ReviewStatus
  doc_type?: DocType
  project?: string
  authorityMin?: number
  channel?: string
  q?: string
  onlyNeedsReview: boolean
  onlyNoMarkdown: boolean
  includeRetired: boolean
}

function clampInt(v: string | null, min: number, max: number, dflt: number): number {
  const n = v == null ? NaN : parseInt(v, 10)
  if (!Number.isFinite(n)) return dflt
  return Math.min(max, Math.max(min, n))
}

export function parseListParams(sp: URLSearchParams): ListParams {
  const page = clampInt(sp.get('page'), 1, 1_000_000, 1)
  const pageSize = clampInt(sp.get('pageSize'), 1, 200, 50)
  const statusRaw = sp.get('status') ?? undefined
  const docTypeRaw = sp.get('doc_type') ?? undefined
  const project = sp.get('project')?.trim() || undefined
  const channel = sp.get('channel')?.trim() || undefined
  const q = sp.get('q')?.trim() || undefined
  const authorityMinRaw = sp.get('authority_min')
  return {
    page, pageSize, offset: (page - 1) * pageSize,
    status: statusRaw && REVIEW_STATUSES.includes(statusRaw as ReviewStatus) ? (statusRaw as ReviewStatus) : undefined,
    doc_type: docTypeRaw && (DOC_TYPES as readonly string[]).includes(docTypeRaw) ? (docTypeRaw as DocType) : undefined,
    project,
    authorityMin: authorityMinRaw != null ? clampInt(authorityMinRaw, 0, 100, 0) : undefined,
    channel, q,
    onlyNeedsReview: sp.get('onlyNeedsReview') === 'true',
    onlyNoMarkdown: sp.get('onlyNoMarkdown') === 'true',
    includeRetired: sp.get('includeRetired') === 'true',
  }
}
```

- [ ] **Step 4: Run → pass.** `npm test -- documents-query`
- [ ] **Step 5: Commit** `feat(knowledge): list-param parsing for gestor + tests`

---

## Task 4: `markdown-reconstruct.ts` (TDD)

**Files:** Create `src/lib/knowledge/markdown-reconstruct.ts`, Test `__tests__/markdown-reconstruct.test.ts`

- [ ] **Step 1: Failing test**
```ts
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
```
- [ ] **Step 2: Run → fail.**
- [ ] **Step 3: Implement**
```ts
export type ReconstructChunk = { chunk_index: number; content: string }

export function reconstructMarkdown(chunks: ReconstructChunk[]): string {
  return [...chunks]
    .sort((a, b) => a.chunk_index - b.chunk_index)
    .map((c) => (c.content ?? '').trim())
    .filter(Boolean)
    .join('\n\n')
}
```
- [ ] **Step 4: Run → pass.**
- [ ] **Step 5: Commit** `feat(knowledge): markdown reconstruction from chunks + tests`

---

## Task 5: `corpus-health.ts` (TDD)

**Files:** Create `src/lib/knowledge/corpus-health.ts`, Test `__tests__/corpus-health.test.ts`

- [ ] **Step 1: Failing test**
```ts
import { describe, it, expect } from 'vitest'
import { buildCorpusHealth } from '@/lib/knowledge/corpus-health'

describe('buildCorpusHealth', () => {
  it('assembles governance + ratios + queue from raw aggregates', () => {
    const h = buildCorpusHealth({
      total: 5498, approved: 3224, needs_review: 2274, rejected: 0, pending: 0,
      retired: 0, sourceOfRecord: 797, authoritySum: 411000, authorityCount: 5498,
      withMarkdown: 2, withSourceHash: 2,
      queue: { total: 2675, queued: 2406, processing: 267, done: 2, error: 0 },
    })
    expect(h.total).toBe(5498)
    expect(h.governance.approved).toBe(3224)
    expect(h.source_of_record).toBe(797)
    expect(h.avg_authority).toBeCloseTo(74.75, 1)
    expect(h.pct_markdown).toBeCloseTo(0.04, 2)
    expect(h.queue.processing).toBe(267)
  })
  it('avg_authority 0 when no docs', () => {
    const h = buildCorpusHealth({ total: 0, approved: 0, needs_review: 0, rejected: 0, pending: 0,
      retired: 0, sourceOfRecord: 0, authoritySum: 0, authorityCount: 0, withMarkdown: 0, withSourceHash: 0,
      queue: { total: 0, queued: 0, processing: 0, done: 0, error: 0 } })
    expect(h.avg_authority).toBe(0)
    expect(h.pct_markdown).toBe(0)
  })
})
```
- [ ] **Step 2: Run → fail.**
- [ ] **Step 3: Implement**
```ts
export type CorpusHealthInput = {
  total: number; approved: number; needs_review: number; rejected: number; pending: number
  retired: number; sourceOfRecord: number; authoritySum: number; authorityCount: number
  withMarkdown: number; withSourceHash: number
  queue: { total: number; queued: number; processing: number; done: number; error: number }
}

export type CorpusHealth = {
  total: number
  governance: { approved: number; needs_review: number; rejected: number; pending: number }
  retired: number
  source_of_record: number
  avg_authority: number
  pct_markdown: number
  pct_source_hash: number
  queue: CorpusHealthInput['queue']
}

const ratio = (n: number, d: number) => (d > 0 ? n / d : 0)

export function buildCorpusHealth(i: CorpusHealthInput): CorpusHealth {
  return {
    total: i.total,
    governance: { approved: i.approved, needs_review: i.needs_review, rejected: i.rejected, pending: i.pending },
    retired: i.retired,
    source_of_record: i.sourceOfRecord,
    avg_authority: i.authorityCount > 0 ? i.authoritySum / i.authorityCount : 0,
    pct_markdown: ratio(i.withMarkdown, i.total),
    pct_source_hash: ratio(i.withSourceHash, i.total),
    queue: i.queue,
  }
}
```
- [ ] **Step 4: Run → pass.**
- [ ] **Step 5: Commit** `feat(knowledge): corpus-health assembly + tests`

---

## Task 6: `GET /api/knowledge/documents` — list

**Files:** Create `src/app/api/knowledge/documents/route.ts`

- [ ] **Step 1: Implement**
```ts
import { NextRequest, NextResponse } from 'next/server'
import { createApiClient } from '@/lib/supabase-server'
import { parseListParams, LIST_COLUMNS } from '@/lib/knowledge/documents-query'

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Internal server error'
}

export async function GET(request: NextRequest) {
  try {
    const p = parseListParams(request.nextUrl.searchParams)
    const supabase = createApiClient()

    let query = supabase
      .from('rag_documents')
      .select(LIST_COLUMNS, { count: 'exact' })

    // Retired docs hidden by default (mirrors RPC status='indexed'); includeRetired shows all
    if (!p.includeRetired) query = query.eq('status', 'indexed')
    if (p.status) query = query.eq('review_status', p.status)
    if (p.onlyNeedsReview) query = query.eq('review_status', 'needs_review')
    if (p.doc_type) query = query.eq('doc_type', p.doc_type)
    if (p.project) query = query.eq('project_id', p.project)
    if (p.channel) query = query.eq('source_channel', p.channel)
    if (p.authorityMin != null) query = query.gte('authority_score', p.authorityMin)
    if (p.onlyNoMarkdown) query = query.is('md_path', null)
    if (p.q) query = query.ilike('title', `%${p.q}%`)

    query = query
      .order('authority_score', { ascending: false })
      .order('created_at', { ascending: false })
      .range(p.offset, p.offset + p.pageSize - 1)

    const { data, error, count } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({
      items: data ?? [],
      page: p.page, pageSize: p.pageSize, total: count ?? 0,
      totalPages: count ? Math.ceil(count / p.pageSize) : 0,
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
```
- [ ] **Step 2: Manual smoke (live)** — start dev server is heavy; instead defer functional check to Task 13 verify script + the build in Task 14.
- [ ] **Step 3: Commit** `feat(api): GET /api/knowledge/documents list with filters`

---

## Task 7: `GET` + `PATCH /api/knowledge/documents/[id]`

**Files:** Create `src/app/api/knowledge/documents/[id]/route.ts`

Note Next.js 16: route context `params` is a Promise — `const { id } = await params`.

- [ ] **Step 1: Implement**
```ts
import { NextRequest, NextResponse } from 'next/server'
import { createApiClient } from '@/lib/supabase-server'
import { reconstructMarkdown } from '@/lib/knowledge/markdown-reconstruct'
import { computeGovernanceAction, InvalidTransitionError } from '@/lib/knowledge/governance-actions'
import type { DocGovernanceState, GovernanceAction, ReclassifyFields } from '@/lib/knowledge/contracts'

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Internal server error'
}

const DETAIL_COLUMNS = `
  id, title, project_id, doc_type, period, lifecycle, review_status, review_reason,
  authority_score, authority_tier, classification_source, classification_confidence,
  status, source_channel, source_type, source_hash, external_id, storage_path, md_path, md_status,
  summary, topics, currency, entity_ids, chunk_count, current_version, supersedes_document_id,
  governance_backfilled_at, created_at
`

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = createApiClient()

    const { data: doc, error: docErr } = await supabase
      .from('rag_documents').select(DETAIL_COLUMNS).eq('id', id).maybeSingle()
    if (docErr) return NextResponse.json({ error: docErr.message }, { status: 500 })
    if (!doc) return NextResponse.json({ error: 'document not found' }, { status: 404 })

    const [{ data: chunks }, { data: events }] = await Promise.all([
      supabase.from('rag_chunks').select('chunk_index, content, metadata')
        .eq('document_id', id).order('chunk_index', { ascending: true }),
      supabase.from('rag_document_events').select('*')
        .eq('document_id', id).order('created_at', { ascending: false }),
    ])

    const markdown = reconstructMarkdown((chunks ?? []).map(c => ({
      chunk_index: c.chunk_index as number, content: c.content as string,
    })))

    return NextResponse.json({
      document: doc,
      chunks: chunks ?? [],
      events: events ?? [],
      markdown: { source: doc.md_path ? 'artifact_path' : 'reconstructed', content: markdown },
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}

type PatchBody = {
  action: GovernanceAction
  fields?: ReclassifyFields
  supersedesId?: string   // old doc this one replaces
  reason?: string
  actor?: string
}

const GOV_COLS = 'review_status, classification_source, status, authority_score, authority_tier, current_version, supersedes_document_id'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json() as PatchBody
    const actor = body.actor?.trim() || 'admin:console'
    if (!body.action) return NextResponse.json({ error: 'action required' }, { status: 400 })

    const supabase = createApiClient()
    const { data: current, error: curErr } = await supabase
      .from('rag_documents').select(GOV_COLS).eq('id', id).maybeSingle()
    if (curErr) return NextResponse.json({ error: curErr.message }, { status: 500 })
    if (!current) return NextResponse.json({ error: 'document not found' }, { status: 404 })

    // supersede needs the old doc's state
    let supersede: { oldId: string; oldDoc: DocGovernanceState } | undefined
    if (body.action === 'supersede') {
      if (!body.supersedesId) return NextResponse.json({ error: 'supersedesId required' }, { status: 400 })
      const { data: oldDoc, error: oldErr } = await supabase
        .from('rag_documents').select(GOV_COLS).eq('id', body.supersedesId).maybeSingle()
      if (oldErr) return NextResponse.json({ error: oldErr.message }, { status: 500 })
      if (!oldDoc) return NextResponse.json({ error: 'superseded document not found' }, { status: 404 })
      supersede = { oldId: body.supersedesId, oldDoc: oldDoc as unknown as DocGovernanceState }
    }

    let result
    try {
      result = computeGovernanceAction({
        action: body.action, documentId: id, current: current as unknown as DocGovernanceState,
        actor, reason: body.reason, fields: body.fields, supersede,
      })
    } catch (e) {
      if (e instanceof InvalidTransitionError) return NextResponse.json({ error: e.message }, { status: 409 })
      throw e
    }

    // Apply primary patch
    if (Object.keys(result.patch).length > 0) {
      const { error: upErr } = await supabase.from('rag_documents').update(result.patch).eq('id', id)
      if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })
    }
    // Apply related (superseded old doc) patch
    if (result.related) {
      const { error: relErr } = await supabase.from('rag_documents').update(result.related.patch).eq('id', result.related.id)
      if (relErr) return NextResponse.json({ error: relErr.message }, { status: 500 })
    }
    // Append-only events
    if (result.events.length > 0) {
      const { error: evErr } = await supabase.from('rag_document_events').insert(result.events)
      if (evErr) return NextResponse.json({ error: evErr.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, action: body.action, patch: result.patch, related: result.related ?? null })
  } catch (err: unknown) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
```
- [ ] **Step 2: Commit** `feat(api): GET detail + PATCH governance actions for documents`

---

## Task 8: `GET /api/knowledge/corpus/health`

**Files:** Create `src/app/api/knowledge/corpus/health/route.ts`

Uses count-only queries (`head: true`) — no new migration. Queue numbers read live from `ingest_queue` (same source as `/api/ingest/queue`).

- [ ] **Step 1: Implement**
```ts
import { NextResponse } from 'next/server'
import { createApiClient } from '@/lib/supabase-server'
import { buildCorpusHealth } from '@/lib/knowledge/corpus-health'
import type { SupabaseClient } from '@supabase/supabase-js'

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Internal server error'
}

async function countWhere(sb: SupabaseClient, build: (q: any) => any): Promise<number> {
  const { count, error } = await build(sb.from('rag_documents').select('id', { count: 'exact', head: true }))
  if (error) throw new Error(error.message)
  return count ?? 0
}

export async function GET() {
  try {
    const sb = createApiClient()

    const [total, approved, needs_review, rejected, pending, retired, sourceOfRecord, withMarkdown, withSourceHash] =
      await Promise.all([
        countWhere(sb, q => q),
        countWhere(sb, q => q.eq('review_status', 'approved')),
        countWhere(sb, q => q.eq('review_status', 'needs_review')),
        countWhere(sb, q => q.eq('review_status', 'rejected')),
        countWhere(sb, q => q.eq('review_status', 'pending')),
        countWhere(sb, q => q.eq('status', 'retired')),
        countWhere(sb, q => q.gte('authority_score', 90).eq('review_status', 'approved')
          .in('classification_source', ['human', 'agent_reviewed', 'agent_corrected'])),
        countWhere(sb, q => q.not('md_path', 'is', null)),
        countWhere(sb, q => q.not('source_hash', 'is', null)),
      ])

    // avg authority over indexed docs — single lightweight column fetch (one int column × ~5.5k rows)
    let authoritySum = 0, authorityCount = 0
    const { data: authRows, error: authErr } = await sb
      .from('rag_documents').select('authority_score').eq('status', 'indexed')
    if (authErr) throw new Error(authErr.message)
    for (const r of authRows ?? []) { authoritySum += Number(r.authority_score) || 0; authorityCount++ }

    const { data: queueRows } = await sb.from('ingest_queue').select('status')
    const queue = {
      total: queueRows?.length ?? 0,
      queued: queueRows?.filter(r => r.status === 'queued').length ?? 0,
      processing: queueRows?.filter(r => r.status === 'processing').length ?? 0,
      done: queueRows?.filter(r => r.status === 'done').length ?? 0,
      error: queueRows?.filter(r => r.status === 'error').length ?? 0,
    }

    const health = buildCorpusHealth({
      total, approved, needs_review, rejected, pending, retired, sourceOfRecord,
      authoritySum, authorityCount, withMarkdown, withSourceHash, queue,
    })
    return NextResponse.json(health)
  } catch (err: unknown) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
```
> Optional optimization (not required): replace the column fetch with a read-only SQL function `knowledge_authority_avg()` returning `sum, cnt` if the per-call ~5.5k-row read ever matters. Acceptable to skip.

- [ ] **Step 2: Commit** `feat(api): GET /api/knowledge/corpus/health`

---

## Task 9: UI badges helper

**Files:** Create `src/app/admin/documents/_components/badges.tsx`

- [ ] **Step 1: Implement** (mirrors review/page.tsx badge style; verification mirrors source-reference)
```tsx
import { cn } from '@/lib/utils'

const REVIEW_CONFIG: Record<string, { label: string; cls: string }> = {
  approved:     { label: 'Aprobado',   cls: 'bg-green-100 text-green-800' },
  needs_review: { label: 'Sin revisar', cls: 'bg-amber-100 text-amber-800' },
  rejected:     { label: 'Rechazado',  cls: 'bg-red-100 text-red-800' },
  pending:      { label: 'Pendiente',  cls: 'bg-slate-100 text-slate-600' },
}

export function ReviewBadge({ status }: { status: string }) {
  const c = REVIEW_CONFIG[status] ?? REVIEW_CONFIG.pending
  return <span className={cn('rounded px-1.5 py-0.5 text-xs font-medium', c.cls)}>{c.label}</span>
}

export function AuthorityBadge({ score, tier }: { score: number | null; tier?: string | null }) {
  if (score == null) return null
  const cls = score >= 90 ? 'text-green-700 bg-green-50' : score >= 75 ? 'text-amber-700 bg-amber-50' : 'text-slate-600 bg-slate-100'
  return <span className={cn('rounded px-1.5 py-0.5 text-xs font-medium', cls)}>Auth {score}{tier ? ` · ${tier}` : ''}</span>
}

const HUMAN_VALIDATED = new Set(['human', 'agent_reviewed', 'agent_corrected'])
/** Mirrors source-reference verificationFromGovernance for the badge shown in the gestor. */
export function verification(score: number | null, review: string, source: string): 'source_of_record' | 'supporting' | 'context' | 'unverified' {
  if (review === 'rejected') return 'unverified'
  if (score == null) return 'unverified'
  if (score >= 90 && review === 'approved' && HUMAN_VALIDATED.has(source)) return 'source_of_record'
  if (score >= 75 && review === 'approved') return 'supporting'
  if (score >= 75) return 'context'
  return 'context'
}

export function VerificationBadge({ score, review, source }: { score: number | null; review: string; source: string }) {
  const v = verification(score, review, source)
  const cfg = {
    source_of_record: { label: 'Source of record', cls: 'bg-emerald-600 text-white' },
    supporting:       { label: 'Supporting',       cls: 'bg-sky-100 text-sky-800' },
    context:          { label: 'Context',          cls: 'bg-slate-100 text-slate-600' },
    unverified:       { label: 'Unverified',       cls: 'bg-slate-100 text-slate-500' },
  }[v]
  return <span className={cn('rounded px-1.5 py-0.5 text-xs font-medium', cfg.cls)}>{cfg.label}</span>
}
```
- [ ] **Step 2: Commit** `feat(ui): gestor badges`

---

## Task 10: Gestor page — table + filters

**Files:** Create `src/app/admin/documents/page.tsx`

Responsibility: fetch the list from `/api/knowledge/documents` with current filters, render a table, hold the selected doc id, render `<CorpusHealth/>` header and `<DocumentPanel/>` side panel. Follow `review/page.tsx`: `'use client'`, `useState`/`useEffect`/`useCallback`, `RefreshCw` spinner, slate palette.

- [ ] **Step 1: Implement** (complete, runnable; presentational classes follow review/page.tsx):
```tsx
'use client'
import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ReviewBadge, AuthorityBadge, VerificationBadge } from './_components/badges'
import { DocumentPanel } from './_components/DocumentPanel'
import { CorpusHealth } from './_components/CorpusHealth'

type DocRow = {
  id: string; title: string | null; project_id: string | null; doc_type: string | null
  period: string | null; review_status: string; authority_score: number | null; authority_tier: string | null
  classification_source: string; status: string; source_channel: string | null; chunk_count: number | null
  summary: string | null; md_path: string | null
}
type ListResp = { items: DocRow[]; page: number; pageSize: number; total: number; totalPages: number }

const REVIEW_OPTIONS = ['', 'needs_review', 'approved', 'rejected', 'pending']
const DOCTYPE_OPTIONS = ['', 'legal', 'board', 'funding', 'capex', 'cash_flow', 'bp_model', 'financial_statements', 'tax', 'kyc', 'dd', 'asset_management', 'monitoring', 'correspondence', 'general', 'other', 'unknown']
const PROJECT_OPTIONS = ['', 'MAD', 'BHX', 'KLP', 'PHILAE', 'GVF', 'ETP']

export default function DocumentsPage() {
  const [rows, setRows] = useState<DocRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [filters, setFilters] = useState({ status: '', doc_type: '', project: '', authority_min: '', q: '', onlyNeedsReview: false, onlyNoMarkdown: false, includeRetired: false })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const sp = new URLSearchParams()
      sp.set('page', String(page)); sp.set('pageSize', '50')
      if (filters.status) sp.set('status', filters.status)
      if (filters.doc_type) sp.set('doc_type', filters.doc_type)
      if (filters.project) sp.set('project', filters.project)
      if (filters.authority_min) sp.set('authority_min', filters.authority_min)
      if (filters.q) sp.set('q', filters.q)
      if (filters.onlyNeedsReview) sp.set('onlyNeedsReview', 'true')
      if (filters.onlyNoMarkdown) sp.set('onlyNoMarkdown', 'true')
      if (filters.includeRetired) sp.set('includeRetired', 'true')
      const r = await fetch(`/api/knowledge/documents?${sp.toString()}`)
      const j: ListResp = await r.json()
      setRows(j.items ?? []); setTotal(j.total ?? 0)
    } finally { setLoading(false) }
  }, [page, filters])

  useEffect(() => { load() }, [load])

  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-auto p-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-900">Gestor Documental</h1>
          <button onClick={load} className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-slate-50">
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} /> Actualizar
          </button>
        </div>

        <CorpusHealth />

        {/* Filters */}
        <div className="mb-3 mt-4 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-md border px-2">
            <Search className="h-4 w-4 text-slate-400" />
            <input value={filters.q} onChange={e => setFilters(f => ({ ...f, q: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && (setPage(1), load())}
              placeholder="Buscar título…" className="py-1.5 text-sm outline-none" />
          </div>
          <select value={filters.status} onChange={e => { setPage(1); setFilters(f => ({ ...f, status: e.target.value })) }} className="rounded-md border px-2 py-1.5 text-sm">
            {REVIEW_OPTIONS.map(o => <option key={o} value={o}>{o || 'Estado: todos'}</option>)}
          </select>
          <select value={filters.doc_type} onChange={e => { setPage(1); setFilters(f => ({ ...f, doc_type: e.target.value })) }} className="rounded-md border px-2 py-1.5 text-sm">
            {DOCTYPE_OPTIONS.map(o => <option key={o} value={o}>{o || 'Tipo: todos'}</option>)}
          </select>
          <select value={filters.project} onChange={e => { setPage(1); setFilters(f => ({ ...f, project: e.target.value })) }} className="rounded-md border px-2 py-1.5 text-sm">
            {PROJECT_OPTIONS.map(o => <option key={o} value={o}>{o || 'Proyecto: todos'}</option>)}
          </select>
          <input value={filters.authority_min} onChange={e => { setPage(1); setFilters(f => ({ ...f, authority_min: e.target.value })) }}
            placeholder="Auth≥" className="w-20 rounded-md border px-2 py-1.5 text-sm" />
          <label className="flex items-center gap-1 text-xs text-slate-600"><input type="checkbox" checked={filters.onlyNoMarkdown} onChange={e => { setPage(1); setFilters(f => ({ ...f, onlyNoMarkdown: e.target.checked })) }} /> sin markdown</label>
          <label className="flex items-center gap-1 text-xs text-slate-600"><input type="checkbox" checked={filters.includeRetired} onChange={e => { setPage(1); setFilters(f => ({ ...f, includeRetired: e.target.checked })) }} /> incluir retirados</label>
        </div>

        {/* Table */}
        <table className="w-full text-sm">
          <thead className="border-b text-left text-xs uppercase tracking-wide text-slate-400">
            <tr><th className="py-2">Título</th><th>Proj</th><th>Tipo</th><th>Auth</th><th>Estado</th><th>Trust</th><th>Chk</th></tr>
          </thead>
          <tbody>
            {rows.map(d => (
              <tr key={d.id} onClick={() => setSelected(d.id)}
                className={cn('cursor-pointer border-b hover:bg-slate-50', selected === d.id && 'bg-sky-50')}>
                <td className="max-w-md truncate py-2 font-medium text-slate-800">{d.title ?? '(sin título)'}</td>
                <td className="text-slate-500">{d.project_id ?? '—'}</td>
                <td className="text-slate-500">{d.doc_type ?? '—'}</td>
                <td><AuthorityBadge score={d.authority_score} tier={d.authority_tier} /></td>
                <td><ReviewBadge status={d.review_status} /></td>
                <td><VerificationBadge score={d.authority_score} review={d.review_status} source={d.classification_source} /></td>
                <td className="text-slate-400">{d.chunk_count ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && !loading && <p className="mt-6 text-center text-sm text-slate-400">Sin documentos para estos filtros.</p>}

        {/* Pagination */}
        <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
          <span>{total} documentos</span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="rounded border px-2 py-1 disabled:opacity-40">Anterior</button>
            <span className="px-2 py-1">Pág {page}</span>
            <button disabled={page * 50 >= total} onClick={() => setPage(p => p + 1)} className="rounded border px-2 py-1 disabled:opacity-40">Siguiente</button>
          </div>
        </div>
      </div>

      {selected && <DocumentPanel docId={selected} onClose={() => setSelected(null)} onChanged={load} />}
    </div>
  )
}
```
- [ ] **Step 2: Commit** `feat(ui): gestor documental page (table + filters)`

---

## Task 11: DocumentPanel — detail + actions + viewer + events

**Files:** Create `src/app/admin/documents/_components/DocumentPanel.tsx`

Responsibility: fetch `/api/knowledge/documents/[id]`, show metadata + summary, the 5 action buttons (approve/reject/reclassify/retire|restore/supersede) calling `PATCH`, three collapsible sections (Markdown reconstructed, Chunks, History). Use `sonner` `toast`. On any successful action call `onChanged()` (reloads list) and refetch detail.

- [ ] **Step 1: Implement**
```tsx
'use client'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { X, Check, Ban, Tag, Archive, RotateCcw, GitMerge, ChevronDown, ChevronRight } from 'lucide-react'
import { ReviewBadge, AuthorityBadge, VerificationBadge } from './badges'
import { SupersedePicker } from './SupersedePicker'

type Detail = {
  document: any
  chunks: { chunk_index: number; content: string; metadata: any }[]
  events: any[]
  markdown: { source: string; content: string }
}

async function patch(id: string, body: any): Promise<boolean> {
  const r = await fetch(`/api/knowledge/documents/${id}`, {
    method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  })
  const j = await r.json()
  if (!r.ok) { toast.error(j.error ?? 'Error'); return false }
  toast.success(`Acción «${body.action}» aplicada`); return true
}

const DOCTYPES = ['legal', 'board', 'funding', 'capex', 'cash_flow', 'bp_model', 'financial_statements', 'tax', 'kyc', 'dd', 'asset_management', 'monitoring', 'correspondence', 'general', 'other', 'unknown']
const TIERS = ['audited', 'executed', 'controller', 'board_pack', 'dd_memo', 'internal', 'narrative', 'unverified']

export function DocumentPanel({ docId, onClose, onChanged }: { docId: string; onClose: () => void; onChanged: () => void }) {
  const [d, setD] = useState<Detail | null>(null)
  const [open, setOpen] = useState({ md: false, chunks: false, history: false, reclass: false })
  const [supersedeOpen, setSupersedeOpen] = useState(false)
  const [reclass, setReclass] = useState({ doc_type: '', authority_tier: '', project_id: '' })

  const load = useCallback(async () => {
    const r = await fetch(`/api/knowledge/documents/${docId}`)
    setD(await r.json())
  }, [docId])
  useEffect(() => { load() }, [load])

  const act = async (body: any) => { if (await patch(docId, body)) { await load(); onChanged() } }

  if (!d?.document) return <aside className="w-[460px] border-l bg-white p-6 text-sm text-slate-400">Cargando…</aside>
  const doc = d.document
  const retired = doc.status === 'retired'

  return (
    <aside className="flex w-[460px] shrink-0 flex-col overflow-auto border-l bg-white">
      <div className="flex items-center justify-between border-b p-4">
        <h2 className="truncate pr-2 font-semibold text-slate-800">{doc.title ?? '(sin título)'}</h2>
        <button onClick={onClose}><X className="h-4 w-4 text-slate-400" /></button>
      </div>

      <div className="space-y-3 p-4">
        <div className="flex flex-wrap gap-1.5">
          <ReviewBadge status={doc.review_status} />
          <AuthorityBadge score={doc.authority_score} tier={doc.authority_tier} />
          <VerificationBadge score={doc.authority_score} review={doc.review_status} source={doc.classification_source} />
          {retired && <span className="rounded bg-slate-700 px-1.5 py-0.5 text-xs text-white">Retirado</span>}
        </div>
        <dl className="grid grid-cols-3 gap-x-2 gap-y-1 text-xs text-slate-600">
          <dt className="text-slate-400">Proyecto</dt><dd className="col-span-2">{doc.project_id ?? '—'}</dd>
          <dt className="text-slate-400">Tipo</dt><dd className="col-span-2">{doc.doc_type ?? '—'}</dd>
          <dt className="text-slate-400">Periodo</dt><dd className="col-span-2">{doc.period ?? '—'}</dd>
          <dt className="text-slate-400">Origen</dt><dd className="col-span-2">{doc.source_channel ?? '—'}</dd>
          <dt className="text-slate-400">Clasif.</dt><dd className="col-span-2">{doc.classification_source}</dd>
          <dt className="text-slate-400">source_hash</dt><dd className="col-span-2 truncate">{doc.source_hash ?? '—'}</dd>
          <dt className="text-slate-400">Versión</dt><dd className="col-span-2">{doc.current_version}</dd>
        </dl>
        {doc.summary && <p className="rounded bg-slate-50 p-2 text-xs text-slate-700">{doc.summary}</p>}

        {/* Actions */}
        <div className="grid grid-cols-2 gap-2 pt-2">
          <button onClick={() => act({ action: 'approve' })} className="flex items-center justify-center gap-1 rounded bg-green-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-green-700"><Check className="h-3.5 w-3.5" /> Aprobar</button>
          <button onClick={() => { const reason = prompt('Motivo del rechazo:') ?? undefined; act({ action: 'reject', reason }) }} className="flex items-center justify-center gap-1 rounded bg-red-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-red-700"><Ban className="h-3.5 w-3.5" /> Rechazar</button>
          <button onClick={() => setOpen(o => ({ ...o, reclass: !o.reclass }))} className="flex items-center justify-center gap-1 rounded border px-2 py-1.5 text-xs font-medium hover:bg-slate-50"><Tag className="h-3.5 w-3.5" /> Reclasificar</button>
          {retired
            ? <button onClick={() => act({ action: 'restore' })} className="flex items-center justify-center gap-1 rounded border px-2 py-1.5 text-xs font-medium hover:bg-slate-50"><RotateCcw className="h-3.5 w-3.5" /> Restaurar</button>
            : <button onClick={() => act({ action: 'retire' })} className="flex items-center justify-center gap-1 rounded border px-2 py-1.5 text-xs font-medium hover:bg-slate-50"><Archive className="h-3.5 w-3.5" /> Retirar</button>}
          <button onClick={() => setSupersedeOpen(true)} className="col-span-2 flex items-center justify-center gap-1 rounded border px-2 py-1.5 text-xs font-medium hover:bg-slate-50"><GitMerge className="h-3.5 w-3.5" /> Superseder…</button>
        </div>

        {/* Reclassify inline form */}
        {open.reclass && (
          <div className="space-y-2 rounded border p-2">
            <select value={reclass.doc_type} onChange={e => setReclass(r => ({ ...r, doc_type: e.target.value }))} className="w-full rounded border px-2 py-1 text-xs"><option value="">doc_type…</option>{DOCTYPES.map(t => <option key={t} value={t}>{t}</option>)}</select>
            <select value={reclass.authority_tier} onChange={e => setReclass(r => ({ ...r, authority_tier: e.target.value }))} className="w-full rounded border px-2 py-1 text-xs"><option value="">authority_tier…</option>{TIERS.map(t => <option key={t} value={t}>{t}</option>)}</select>
            <input value={reclass.project_id} onChange={e => setReclass(r => ({ ...r, project_id: e.target.value }))} placeholder="project_id (MAD/BHX/…)" className="w-full rounded border px-2 py-1 text-xs" />
            <button onClick={() => {
              const fields: any = {}
              if (reclass.doc_type) fields.doc_type = reclass.doc_type
              if (reclass.authority_tier) fields.authority_tier = reclass.authority_tier
              if (reclass.project_id) fields.project_id = reclass.project_id
              if (Object.keys(fields).length === 0) { toast.error('Nada que reclasificar'); return }
              act({ action: 'reclassify', fields })
            }} className="w-full rounded bg-slate-800 py-1 text-xs text-white">Aplicar reclasificación</button>
          </div>
        )}

        {/* Collapsibles */}
        <Section title="Markdown (reconstruido)" open={open.md} onToggle={() => setOpen(o => ({ ...o, md: !o.md }))}>
          <p className="mb-1 text-[10px] uppercase text-slate-400">{d.markdown.source === 'reconstructed' ? 'markdown reconstruido (no es el artifact original)' : 'artifact'}</p>
          <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded bg-slate-50 p-2 text-xs text-slate-700">{d.markdown.content || 'sin contenido indexado'}</pre>
        </Section>
        <Section title={`Chunks (${d.chunks.length})`} open={open.chunks} onToggle={() => setOpen(o => ({ ...o, chunks: !o.chunks }))}>
          <div className="max-h-80 space-y-2 overflow-auto">{d.chunks.map(c => <div key={c.chunk_index} className="rounded border p-1.5 text-xs"><span className="text-slate-400">#{c.chunk_index}</span> <span className="text-slate-700">{c.content.slice(0, 240)}</span></div>)}</div>
        </Section>
        <Section title={`Historial (${d.events.length})`} open={open.history} onToggle={() => setOpen(o => ({ ...o, history: !o.history }))}>
          <ul className="max-h-80 space-y-1 overflow-auto text-xs">{d.events.map((e, i) => <li key={i} className="border-b py-1"><span className="font-medium">{e.action}</span> {e.field ? <span className="text-slate-500">{e.field}: {e.old_value} → {e.new_value}</span> : null} <span className="text-slate-300">· {e.actor} · {new Date(e.created_at).toLocaleString()}</span>{e.reason ? <div className="text-slate-400">{e.reason}</div> : null}</li>)}</ul>
        </Section>
      </div>

      {supersedeOpen && <SupersedePicker currentId={docId} onPick={async (oldId, reason) => { setSupersedeOpen(false); await act({ action: 'supersede', supersedesId: oldId, reason }) }} onClose={() => setSupersedeOpen(false)} />}
    </aside>
  )
}

function Section({ title, open, onToggle, children }: { title: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="border-t pt-2">
      <button onClick={onToggle} className="flex w-full items-center gap-1 text-xs font-semibold text-slate-600">
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />} {title}
      </button>
      {open && <div className="mt-2">{children}</div>}
    </div>
  )
}
```
- [ ] **Step 2: Commit** `feat(ui): document detail panel with governance actions`

---

## Task 12: SupersedePicker

**Files:** Create `src/app/admin/documents/_components/SupersedePicker.tsx`

Responsibility: modal that searches `/api/knowledge/documents?q=` and lets the user pick the OLD doc the current doc replaces; collects a reason.

- [ ] **Step 1: Implement**
```tsx
'use client'
import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

type Row = { id: string; title: string | null; project_id: string | null; doc_type: string | null }

export function SupersedePicker({ currentId, onPick, onClose }: { currentId: string; onPick: (oldId: string, reason?: string) => void; onClose: () => void }) {
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [picked, setPicked] = useState<Row | null>(null)
  const [reason, setReason] = useState('')

  useEffect(() => {
    const t = setTimeout(async () => {
      const sp = new URLSearchParams({ pageSize: '20', includeRetired: 'true' })
      if (q) sp.set('q', q)
      const r = await fetch(`/api/knowledge/documents?${sp}`)
      const j = await r.json()
      setRows((j.items ?? []).filter((x: Row) => x.id !== currentId))
    }, 250)
    return () => clearTimeout(t)
  }, [q, currentId])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="w-[520px] rounded-lg bg-white p-4 shadow-xl">
        <div className="mb-2 flex items-center justify-between"><h3 className="font-semibold">Superseder: elige el documento antiguo que este reemplaza</h3><button onClick={onClose}><X className="h-4 w-4" /></button></div>
        <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar título…" className="mb-2 w-full rounded border px-2 py-1.5 text-sm" />
        <div className="max-h-64 overflow-auto rounded border">
          {rows.map(r => (
            <button key={r.id} onClick={() => setPicked(r)} className={`flex w-full items-center justify-between border-b px-2 py-1.5 text-left text-sm hover:bg-slate-50 ${picked?.id === r.id ? 'bg-sky-50' : ''}`}>
              <span className="truncate">{r.title ?? '(sin título)'}</span><span className="text-xs text-slate-400">{r.project_id} · {r.doc_type}</span>
            </button>
          ))}
          {rows.length === 0 && <p className="p-3 text-center text-xs text-slate-400">Sin resultados.</p>}
        </div>
        {picked && (
          <div className="mt-3 space-y-2">
            <p className="text-xs text-slate-600">Este documento sustituirá a: <b>{picked.title}</b> (quedará retirado).</p>
            <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Motivo (obligatorio)" className="w-full rounded border px-2 py-1.5 text-sm" />
            <button disabled={!reason.trim()} onClick={() => onPick(picked.id, reason.trim())} className="w-full rounded bg-slate-800 py-1.5 text-sm text-white disabled:opacity-40">Confirmar supersesión</button>
          </div>
        )}
      </div>
    </div>
  )
}
```
- [ ] **Step 2: Commit** `feat(ui): supersede picker modal`

---

## Task 13: CorpusHealth header

**Files:** Create `src/app/admin/documents/_components/CorpusHealth.tsx`

- [ ] **Step 1: Implement**
```tsx
'use client'
import { useEffect, useState } from 'react'

type Health = {
  total: number
  governance: { approved: number; needs_review: number; rejected: number; pending: number }
  retired: number; source_of_record: number; avg_authority: number; pct_markdown: number; pct_source_hash: number
  queue: { total: number; queued: number; processing: number; done: number; error: number }
}
const Stat = ({ label, value }: { label: string; value: string | number }) => (
  <div className="rounded-md border bg-white px-3 py-2"><div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div><div className="text-lg font-semibold text-slate-800">{value}</div></div>
)

export function CorpusHealth() {
  const [h, setH] = useState<Health | null>(null)
  useEffect(() => { fetch('/api/knowledge/corpus/health').then(r => r.json()).then(setH).catch(() => {}) }, [])
  if (!h) return null
  return (
    <div className="grid grid-cols-3 gap-2 md:grid-cols-6">
      <Stat label="Total" value={h.total} />
      <Stat label="Aprobados" value={h.governance.approved} />
      <Stat label="Sin revisar" value={h.governance.needs_review} />
      <Stat label="Source of record" value={h.source_of_record} />
      <Stat label="Autoridad media" value={h.avg_authority.toFixed(1)} />
      <Stat label="Cola (q/proc/err)" value={`${h.queue.queued}/${h.queue.processing}/${h.queue.error}`} />
    </div>
  )
}
```
- [ ] **Step 2: Commit** `feat(ui): corpus health header`

---

## Task 14: Sidebar nav link

**Files:** Modify `src/components/layout/Sidebar.tsx`

- [ ] **Step 1:** add `FolderCheck` to the lucide import line, and add this item to the `Knowledge System` `items` array, right after the `Evidence Review` entry:
```tsx
      { label: 'Gestor Documental', href: '/admin/documents', icon: FolderCheck },
```
- [ ] **Step 2: Commit** `feat(ui): sidebar link to gestor documental`

---

## Task 15: Live e2e verification script

**Files:** Create `scripts/verify-gestor-b.ts`

Creates a throwaway test document (+1 chunk), exercises the action engine end-to-end against live DB, asserts the 7 spec checks, then deletes everything it created. Never touches real corpus rows.

- [ ] **Step 1: Implement** (run with `npx tsx --env-file=.env.local scripts/verify-gestor-b.ts`):
```ts
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { computeGovernanceAction } from '../src/lib/knowledge/governance-actions'
import type { DocGovernanceState } from '../src/lib/knowledge/contracts'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const sb = createClient(url, key)
const assert = (c: boolean, m: string) => { if (!c) throw new Error('FAIL: ' + m); console.log('  ok:', m) }

async function applyAction(id: string, current: DocGovernanceState, action: any, extra: any = {}) {
  const r = computeGovernanceAction({ action, documentId: id, current, actor: 'verify:script', ...extra })
  if (Object.keys(r.patch).length) await sb.from('rag_documents').update(r.patch).eq('id', id)
  if (r.related) await sb.from('rag_documents').update(r.related.patch).eq('id', r.related.id)
  if (r.events.length) await sb.from('rag_document_events').insert(r.events)
  return r
}

async function main() {
  // create test doc A (authority 95, needs_review, machine) + one chunk + an "old" doc for supersede
  const ins = await sb.from('rag_documents').insert({
    title: 'ZZZ verify-gestor-b TESTDOC', status: 'indexed', review_status: 'needs_review',
    classification_source: 'agent_auto', authority_score: 95, authority_tier: 'audited',
    doc_type: 'monitoring', project_id: 'MAD', current_version: 1, chunk_count: 1,
  }).select('id').single()
  const id = ins.data!.id
  const oldIns = await sb.from('rag_documents').insert({ title: 'ZZZ verify OLD', status: 'indexed', review_status: 'approved', classification_source: 'rule', authority_score: 80, authority_tier: 'controller', current_version: 1 }).select('id').single()
  const oldId = oldIns.data!.id
  await sb.from('rag_chunks').insert({ document_id: id, chunk_index: 1, content: 'second part' })
  await sb.from('rag_chunks').insert({ document_id: id, chunk_index: 0, content: 'first part' })

  try {
    const cur = (): Promise<DocGovernanceState> => sb.from('rag_documents')
      .select('review_status, classification_source, status, authority_score, authority_tier, current_version, supersedes_document_id')
      .eq('id', id).single().then(r => r.data as any)

    // 1. approve → agent_reviewed → source_of_record activates
    await applyAction(id, await cur(), 'approve')
    let s = await cur()
    assert(s.review_status === 'approved' && s.classification_source === 'agent_reviewed', 'approve sets agent_reviewed (source_of_record eligible)')

    // 4. reclassify doc_type
    await applyAction(id, await cur(), 'reclassify', { fields: { doc_type: 'legal' } })
    s = await cur(); assert((await sb.from('rag_documents').select('doc_type').eq('id', id).single()).data!.doc_type === 'legal' && s.classification_source === 'agent_corrected', 'reclassify doc_type + agent_corrected')

    // 3. retire then restore
    await applyAction(id, await cur(), 'retire'); assert((await cur()).status === 'retired', 'retire → retired')
    await applyAction(id, await cur(), 'restore'); assert((await cur()).status === 'indexed', 'restore → indexed')

    // 5. supersede old doc
    const oldState = (await sb.from('rag_documents').select('review_status, classification_source, status, authority_score, authority_tier, current_version, supersedes_document_id').eq('id', oldId).single()).data as any
    await applyAction(id, await cur(), 'supersede', { supersede: { oldId, oldDoc: oldState } })
    assert((await sb.from('rag_documents').select('status').eq('id', oldId).single()).data!.status === 'retired', 'supersede retires old doc')
    assert((await cur()).supersedes_document_id === oldId, 'supersede links new→old')

    // 2. reject + events present
    await applyAction(id, await cur(), 'reject', { reason: 'cleanup' })
    assert((await cur()).review_status === 'rejected', 'reject → rejected')
    const evCount = (await sb.from('rag_document_events').select('id', { count: 'exact', head: true }).eq('document_id', id)).count ?? 0
    assert(evCount >= 5, `events recorded (${evCount})`)

    console.log('\nALL VERIFY CHECKS PASSED')
  } finally {
    // cleanup
    await sb.from('rag_document_events').delete().in('document_id', [id, oldId])
    await sb.from('rag_chunks').delete().eq('document_id', id)
    await sb.from('rag_documents').delete().in('id', [id, oldId])
    console.log('cleaned up test rows')
  }
}
main().catch(e => { console.error(e); process.exit(1) })
```
- [ ] **Step 2: Run it** (pass key inline if `.env.local` flickers — see addendum risk):
```bash
npx tsx scripts/verify-gestor-b.ts
```
Expected: `ALL VERIFY CHECKS PASSED` then `cleaned up test rows`. **Verify the corpus count is still 5.498 afterward** (no orphan test rows).
- [ ] **Step 3: Commit** `test(knowledge): live e2e verify script for gestor actions`

---

## Task 16: Full verification gate

- [ ] **Step 1: Unit tests** — `npm test` → all green (existing 12 + new ~24).
- [ ] **Step 2: Lint** — `npm run lint` → no new errors in touched files.
- [ ] **Step 3: Build** — `npm run build` → succeeds (App Router compiles the new routes/pages; fix any type errors).
- [ ] **Step 4: Live verify** — `npx tsx scripts/verify-gestor-b.ts` → ALL PASSED + cleanup; confirm `select count(*) from rag_documents` = 5498.
- [ ] **Step 5: Commit** any fixes. Leave branch `agent/gestor-documental-b` ready for adversarial review.

---

## Self-Review (plan vs spec)

**Spec coverage:** §7 list/detail/PATCH/health APIs → Tasks 6–8; table+filters+panel+viewer+events+health UI → Tasks 10–13; nav → Task 14; §8 markdown reconstruction → Task 4 + Task 7 GET; §9 vinculado (reject/retire via RPC status filter, reclassify parent-first, approve→source_of_record) → governance-actions (Task 2) + verify (Task 15); addendum D1 full scope ✔, D2 approve→agent_reviewed/reclassify→agent_corrected ✔ (Task 2 tests), D3 actor default ✔ (Task 7), D4 supersede ✔ (Task 2/11/12/15), D5 reject sticky ✔ (review_status='rejected'; RPC already excludes). §11 tests 1–7 → Task 15. **No gaps.**

**Placeholder scan:** the only marked scaffolding is the explicit cleanup note in Task 2 (reclassify) and Task 8 (authority avg) — both call out exactly what to remove/decide, not vague TODOs. No "add error handling"/"TBD".

**Type consistency:** `computeGovernanceAction` / `GovernanceActionResult` / `DocGovernanceState` / `ReclassifyFields` / `RETIRED_STATUS` / `HUMAN_VALIDATED_SOURCES` used consistently across Tasks 1/2/7/15. API field names (`supersedesId`, `fields`, `reason`, `actor`) consistent between Task 7 PATCH body and Task 11/12 callers. `LIST_COLUMNS`/`parseListParams` consistent between Task 3 and Task 6.

## Out of scope (unchanged)
Spec C (prompt facts, ranking trust-tier dominance, ES/EN stemming, embedding-limiter); auth/RLS; mass re-parse; upload/Drive/Gmail adapters.
