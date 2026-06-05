# Corpus Gobernado — Foundation (Sub-proyecto A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Gemswell's document governance real — lift the classification that already exists at chunk level up to the document level, classify the ambiguous tail with Haiku, fix the RPCs so they stop shadowing real authority, and route all ingestion through one governed writer.

**Architecture:** Pure-TS classification helpers (`src/lib/knowledge/authority.ts`, `classify.ts`) unit-tested with vitest. A DDL-only migration (`sql/005`) changes defaults, adds enrichment columns + an append-only audit table, and rewrites `match_chunks`/`keyword_search_chunks` to COALESCE real chunk authority (guarding the `authority_score=0` default with `NULLIF`) and to exclude `rejected`/`retired`. A one-time `tsx` backfill script applies lift-up + Haiku enrichment over the 5,498 docs. `queue-processor.ts` adopts the classifier; the two legacy ingest scripts are quarantined.

**Tech Stack:** TypeScript, Next 16 (not touched here), Supabase Postgres + pgvector (project `nqxhsjkcvfxygiajdxki`), `@anthropic-ai/sdk` (Haiku `claude-haiku-4-5-20251001`), vitest + tsx (added in Task 0). Scripts: `.mjs`/`.ts` with `dotenv.config({ path: '.env.local' })` and `NEXT_PUBLIC_SUPABASE_*` (anon key; RLS is open in test).

**Out of scope (other plans):** the document-manager UI/APIs (Plan 2 = sub-project B); chat prompt/retrieval consolidation, similarity threshold, ES/EN stemming (spec C); auth/RLS (pre-publication).

**Spec:** `docs/superpowers/specs/2026-06-05-gestor-documental-gobernado-design.md`

---

## File Structure

- Create `src/lib/knowledge/authority.ts` — pure score↔tier mapping. Imports: `AuthorityTier` from `contracts.ts`.
- Create `src/lib/knowledge/classify.ts` — `liftUpFromChunks`, `decideReviewStatus` (pure) + `buildClassifyPrompt`, `parseClassifyResponse` (pure) + `classifyDocument` (Haiku wrapper).
- Create `src/lib/knowledge/__tests__/authority.test.ts`, `classify.test.ts` — vitest unit tests.
- Create `sql/005_governance_lift_and_fix.sql` — DDL: defaults, enrichment columns, `rag_document_events`, RPC rewrites.
- Create `scripts/backfill-governance.ts` — one-time lift-up + Haiku backfill (run via `tsx`).
- Modify `src/lib/ingest/queue-processor.ts` — use the classifier in `reserveRagDocument`/processing instead of hardcoded `approved`/authority-0 defaults.
- Modify `package.json` — add `vitest`, `tsx` devDeps + `test` script.
- Create `vitest.config.ts`.
- Move `scripts/ingest-dms.mjs`, `scripts/ingest-key-docs.mjs` → `scripts/_archive/` with a NO-RUN header.

---

## Task 0: Test & script tooling

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `src/lib/knowledge/__tests__/smoke.test.ts`

- [ ] **Step 1: Install dev tooling**

Run:
```bash
npm i -D vitest tsx
```
Expected: `vitest` and `tsx` added to devDependencies.

- [ ] **Step 2: Add the test script**

Edit `package.json` `"scripts"` to add:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Create vitest config**

Create `vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

export default defineConfig({
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
  resolve: { alias: { '@': resolve(__dirname, 'src') } },
})
```

- [ ] **Step 4: Write a smoke test**

Create `src/lib/knowledge/__tests__/smoke.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
describe('tooling', () => {
  it('runs', () => { expect(1 + 1).toBe(2) })
})
```

- [ ] **Step 5: Run and verify it passes**

Run: `npm test`
Expected: PASS, 1 test passed.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/lib/knowledge/__tests__/smoke.test.ts
git commit -m "chore: add vitest + tsx for governance foundation"
```

---

## Task 1: Authority score↔tier mapping

**Files:**
- Create: `src/lib/knowledge/authority.ts`
- Test: `src/lib/knowledge/__tests__/authority.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/knowledge/__tests__/authority.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { scoreToTier, tierToScore } from '@/lib/knowledge/authority'

describe('scoreToTier', () => {
  it('maps the real chunk authority values', () => {
    expect(scoreToTier(95)).toBe('audited')
    expect(scoreToTier(90)).toBe('executed')
    expect(scoreToTier(85)).toBe('controller')
    expect(scoreToTier(80)).toBe('controller')
    expect(scoreToTier(75)).toBe('board_pack')
    expect(scoreToTier(0)).toBe('unverified')
  })
})

describe('tierToScore', () => {
  it('is the canonical AUTHORITY_TIER_SCORE', () => {
    expect(tierToScore('audited')).toBe(100)
    expect(tierToScore('unverified')).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot find module `@/lib/knowledge/authority`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/knowledge/authority.ts`:
```ts
import { AUTHORITY_TIER_SCORE, type AuthorityTier } from '@/lib/knowledge/contracts'

export function tierToScore(tier: AuthorityTier): number {
  return AUTHORITY_TIER_SCORE[tier]
}

export function scoreToTier(score: number): AuthorityTier {
  if (score >= 95) return 'audited'
  if (score >= 90) return 'executed'
  if (score >= 80) return 'controller'
  if (score >= 70) return 'board_pack'
  if (score >= 60) return 'dd_memo'
  if (score >= 40) return 'internal'
  if (score >= 10) return 'narrative'
  return 'unverified'
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/knowledge/authority.ts src/lib/knowledge/__tests__/authority.test.ts
git commit -m "feat(knowledge): authority score<->tier mapping"
```

---

## Task 2: Lift-up + review-status decision (pure)

**Files:**
- Create: `src/lib/knowledge/classify.ts`
- Test: `src/lib/knowledge/__tests__/classify.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/knowledge/__tests__/classify.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { liftUpFromChunks, decideReviewStatus } from '@/lib/knowledge/classify'

describe('liftUpFromChunks', () => {
  it('takes max authority and modal doc_type/project', () => {
    const r = liftUpFromChunks([
      { authority: '95', doc_type: 'legal', project_id: 'MAD' },
      { authority: '95', doc_type: 'legal', project_id: 'MAD' },
      { authority: 80, doc_type: 'board', project_id: 'MAD' },
    ])
    expect(r.authority_score).toBe(95)
    expect(r.authority_tier).toBe('audited')
    expect(r.doc_type).toBe('legal')
    expect(r.project_id).toBe('MAD')
    expect(r.confidence).toBeCloseTo(2 / 3, 5)
  })

  it('returns nulls and zero confidence for empty/sparse metadata', () => {
    const r = liftUpFromChunks([{ doc_type: 'other' }, {}])
    expect(r.authority_score).toBeNull()
    expect(r.authority_tier).toBe('unverified')
    expect(r.doc_type).toBe('other')
  })
})

describe('decideReviewStatus', () => {
  it('approves confident, fully-classified docs (threshold 0.5)', () => {
    expect(decideReviewStatus({ doc_type: 'legal', authority_tier: 'audited', confidence: 0.6 })).toBe('approved')
  })
  it('sends ambiguous docs to needs_review', () => {
    expect(decideReviewStatus({ doc_type: 'other', authority_tier: 'controller', confidence: 0.9 })).toBe('needs_review')
    expect(decideReviewStatus({ doc_type: 'legal', authority_tier: 'unverified', confidence: 0.9 })).toBe('needs_review')
    expect(decideReviewStatus({ doc_type: 'legal', authority_tier: 'audited', confidence: 0.4 })).toBe('needs_review')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `liftUpFromChunks` / `decideReviewStatus` not exported.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/knowledge/classify.ts`:
```ts
import { scoreToTier } from '@/lib/knowledge/authority'
import type { AuthorityTier, ReviewStatus } from '@/lib/knowledge/contracts'

export type ChunkMetaLite = {
  authority?: number | string | null
  doc_type?: string | null
  project_id?: string | null
  period?: string | null
  dms_folder?: string | null
}

export type LiftedLabels = {
  authority_score: number | null
  authority_tier: AuthorityTier
  doc_type: string | null
  project_id: string | null
  period: string | null
  dms_folder: string | null
  confidence: number
}

function mode(values: (string | null | undefined)[]): { value: string | null; share: number } {
  const counts = new Map<string, number>()
  let total = 0
  for (const v of values) {
    if (!v) continue
    counts.set(v, (counts.get(v) ?? 0) + 1)
    total++
  }
  if (total === 0) return { value: null, share: 0 }
  let best: string | null = null
  let bestN = 0
  for (const [v, n] of counts) if (n > bestN) { best = v; bestN = n }
  return { value: best, share: bestN / total }
}

export function liftUpFromChunks(metas: ChunkMetaLite[]): LiftedLabels {
  const authorities = metas
    .map(m => (m.authority == null ? NaN : Number(m.authority)))
    .filter(n => Number.isFinite(n)) as number[]
  const authority_score = authorities.length ? Math.max(...authorities) : null
  const docTypeMode = mode(metas.map(m => m.doc_type))
  const projectMode = mode(metas.map(m => m.project_id))
  const periodMode = mode(metas.map(m => m.period))
  const folderMode = mode(metas.map(m => m.dms_folder))
  return {
    authority_score,
    authority_tier: authority_score == null ? 'unverified' : scoreToTier(authority_score),
    doc_type: docTypeMode.value,
    project_id: projectMode.value,
    period: periodMode.value,
    dms_folder: folderMode.value,
    confidence: docTypeMode.share,
  }
}

export function decideReviewStatus(labels: {
  doc_type: string | null
  authority_tier: AuthorityTier
  confidence: number
}): ReviewStatus {
  const classified =
    labels.confidence >= 0.5 &&
    !!labels.doc_type &&
    labels.doc_type !== 'other' &&
    labels.authority_tier !== 'unverified'
  return classified ? 'approved' : 'needs_review'
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/knowledge/classify.ts src/lib/knowledge/__tests__/classify.test.ts
git commit -m "feat(knowledge): chunk-metadata lift-up + review-status decision"
```

---

## Task 3: Haiku enrichment (prompt build + response parse + wrapper)

**Files:**
- Modify: `src/lib/knowledge/classify.ts`
- Test: `src/lib/knowledge/__tests__/classify.test.ts`

- [ ] **Step 1: Add failing tests for the pure parts**

Append to `src/lib/knowledge/__tests__/classify.test.ts`:
```ts
import { buildClassifyPrompt, parseClassifyResponse } from '@/lib/knowledge/classify'

describe('buildClassifyPrompt', () => {
  it('includes title and sample text and asks for JSON', () => {
    const p = buildClassifyPrompt({ title: 'Acta JG', sample: 'aumento de capital', dmsFolder: '03. Legal' })
    expect(p).toContain('Acta JG')
    expect(p).toContain('aumento de capital')
    expect(p).toContain('JSON')
  })
})

describe('parseClassifyResponse', () => {
  it('parses valid JSON (even with prose/code fences around it)', () => {
    const r = parseClassifyResponse('Here:\n```json\n{"doc_type":"legal","authority_tier":"executed","lifecycle":"signed","period":"2026","currency":"EUR","topics":["capital"],"summary":"Acta de aumento de capital","confidence":0.8}\n```')
    expect(r).not.toBeNull()
    expect(r!.doc_type).toBe('legal')
    expect(r!.authority_tier).toBe('executed')
    expect(r!.confidence).toBe(0.8)
  })
  it('returns null on garbage', () => {
    expect(parseClassifyResponse('no json here')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `buildClassifyPrompt` / `parseClassifyResponse` not exported.

- [ ] **Step 3: Implement the pure helpers + the wrapper**

Append to `src/lib/knowledge/classify.ts`:
```ts
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { tierToScore } from '@/lib/knowledge/authority'
import type { DocType, Lifecycle } from '@/lib/knowledge/contracts'

const DOC_TYPES = ['legal','board','funding','capex','cash_flow','bp_model','financial_statements','tax','kyc','dd','asset_management','monitoring','correspondence','general','other'] as const
const TIERS = ['audited','executed','controller','board_pack','dd_memo','internal','narrative','unverified'] as const
const LIFECYCLES = ['draft','signed','executed','filed','audited','working_paper','superseded','unknown'] as const

export const classifyResultSchema = z.object({
  doc_type: z.enum(DOC_TYPES),
  authority_tier: z.enum(TIERS),
  lifecycle: z.enum(LIFECYCLES).default('unknown'),
  period: z.string().nullable().default(null),
  currency: z.enum(['EUR','GBP','USD']).nullable().default(null),
  topics: z.array(z.string()).default([]),
  summary: z.string().default(''),
  confidence: z.number().min(0).max(1),
})
export type ClassifyResult = z.infer<typeof classifyResultSchema>

export function buildClassifyPrompt(doc: { title: string; sample: string; dmsFolder?: string | null }): string {
  return [
    'Clasifica este documento financiero/legal de un grupo de parques de olas (Gemswell).',
    `Título: ${doc.title}`,
    doc.dmsFolder ? `Carpeta DMS: ${doc.dmsFolder}` : '',
    `Extracto:\n${doc.sample.slice(0, 4000)}`,
    '',
    'Responde SOLO con un objeto JSON con estas claves:',
    `doc_type (${DOC_TYPES.join('|')}), authority_tier (${TIERS.join('|')}), lifecycle (${LIFECYCLES.join('|')}), period (string|null), currency (EUR|GBP|USD|null), topics (string[]), summary (1 frase), confidence (0..1).`,
  ].filter(Boolean).join('\n')
}

export function parseClassifyResponse(text: string): ClassifyResult | null {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return null
  try {
    const parsed = classifyResultSchema.safeParse(JSON.parse(match[0]))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

const HAIKU_MODEL = 'claude-haiku-4-5-20251001'

export async function classifyDocument(
  doc: { title: string; sample: string; dmsFolder?: string | null },
  anthropic: Anthropic
): Promise<{ result: ClassifyResult; authority_score: number } | null> {
  const resp = await anthropic.messages.create({
    model: HAIKU_MODEL,
    max_tokens: 512,
    temperature: 0,
    messages: [{ role: 'user', content: buildClassifyPrompt(doc) }],
  })
  const text = resp.content.find(b => b.type === 'text')?.text ?? ''
  const result = parseClassifyResponse(text)
  if (!result) return null
  return { result, authority_score: tierToScore(result.authority_tier) }
}
```
Note: if `DocType`/`Lifecycle` imports are unused after this, remove the import line to satisfy lint. Confirm `contracts.ts` exports the `DocType` union; if its members differ from `DOC_TYPES` above, prefer the `contracts.ts` union and align `DOC_TYPES` to it.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS (all classify tests).

- [ ] **Step 5: Lint**

Run: `npm run lint`
Expected: no errors in `src/lib/knowledge/*`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/knowledge/classify.ts src/lib/knowledge/__tests__/classify.test.ts
git commit -m "feat(knowledge): Haiku document classifier (prompt/parse/wrapper)"
```

---

## Task 4: Migration 005 — defaults, enrichment columns, audit table, RPC fix

**Files:**
- Create: `sql/005_governance_lift_and_fix.sql`

- [ ] **Step 1: Write the migration**

Create `sql/005_governance_lift_and_fix.sql`:
```sql
-- 005_governance_lift_and_fix.sql — DDL only, idempotent.
-- Data backfill lives in scripts/backfill-governance.ts.

-- 1. New defaults for FUTURE inserts (existing rows untouched).
ALTER TABLE public.rag_documents ALTER COLUMN review_status SET DEFAULT 'needs_review';
ALTER TABLE public.rag_documents ALTER COLUMN classification_source SET DEFAULT 'agent_auto';

-- 2. Enrichment columns (maximize info surfaced to the chat).
ALTER TABLE public.rag_documents
  ADD COLUMN IF NOT EXISTS summary text,
  ADD COLUMN IF NOT EXISTS topics text[],
  ADD COLUMN IF NOT EXISTS currency text,
  ADD COLUMN IF NOT EXISTS entity_ids text[];

-- 3. Append-only governance audit trail.
CREATE TABLE IF NOT EXISTS public.rag_document_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.rag_documents(id) ON DELETE CASCADE,
  action text NOT NULL,
  field text,
  old_value text,
  new_value text,
  actor text NOT NULL DEFAULT 'system',
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rag_document_events_document_id
  ON public.rag_document_events(document_id);
ALTER TABLE public.rag_document_events ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY open_all ON public.rag_document_events FOR ALL TO public USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4. Rewrite match_chunks: do NOT shadow real chunk authority; exclude rejected/retired.
--    authority_score has DEFAULT 0, so guard with NULLIF before falling back to chunk authority.
CREATE OR REPLACE FUNCTION public.match_chunks(
  query_embedding vector,
  match_count integer DEFAULT 25,
  filter_project text DEFAULT NULL,
  filter_doc_type text DEFAULT NULL
)
RETURNS TABLE (id uuid, document_id uuid, content text, metadata jsonb, similarity double precision)
LANGUAGE sql STABLE AS $$
  SELECT
    c.id, c.document_id, c.content,
    COALESCE(c.metadata, '{}'::jsonb) || jsonb_build_object(
      'review_status', d.review_status,
      'classification_source', d.classification_source,
      'authority_tier', COALESCE(NULLIF(d.authority_tier::text,'unverified'), c.metadata->>'authority_tier'),
      'authority_score', COALESCE(NULLIF(d.authority_score,0), NULLIF(c.metadata->>'authority','')::int),
      'lifecycle', d.lifecycle,
      'doc_type', COALESCE(d.doc_type, c.metadata->>'doc_type'),
      'project_id', COALESCE(d.project_id, c.metadata->>'project_id'),
      'source_channel', d.source_channel,
      'md_path', d.md_path,
      'document_source_hash', d.source_hash
    ) AS metadata,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM public.rag_chunks c
  JOIN public.rag_documents d ON d.id = c.document_id
  WHERE d.review_status <> 'rejected'
    AND d.status = 'indexed'
    AND (filter_project IS NULL OR COALESCE(d.project_id, c.metadata->>'project_id', '') = filter_project)
    AND (filter_doc_type IS NULL OR COALESCE(d.doc_type, c.metadata->>'doc_type', '') = filter_doc_type)
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- 5. Same governance + exclusion for keyword search.
CREATE OR REPLACE FUNCTION public.keyword_search_chunks(
  query_text text,
  filter_project text DEFAULT NULL,
  match_count integer DEFAULT 15
)
RETURNS TABLE (id uuid, document_id uuid, content text, metadata jsonb, rank real)
LANGUAGE sql STABLE AS $$
  SELECT
    c.id, c.document_id, c.content,
    COALESCE(c.metadata, '{}'::jsonb) || jsonb_build_object(
      'review_status', d.review_status,
      'classification_source', d.classification_source,
      'authority_tier', COALESCE(NULLIF(d.authority_tier::text,'unverified'), c.metadata->>'authority_tier'),
      'authority_score', COALESCE(NULLIF(d.authority_score,0), NULLIF(c.metadata->>'authority','')::int),
      'lifecycle', d.lifecycle,
      'doc_type', COALESCE(d.doc_type, c.metadata->>'doc_type'),
      'project_id', COALESCE(d.project_id, c.metadata->>'project_id'),
      'source_channel', d.source_channel,
      'md_path', d.md_path,
      'document_source_hash', d.source_hash
    ) AS metadata,
    ts_rank_cd(to_tsvector('simple', c.content), plainto_tsquery('simple', query_text)) AS rank
  FROM public.rag_chunks c
  JOIN public.rag_documents d ON d.id = c.document_id
  WHERE d.review_status <> 'rejected'
    AND d.status = 'indexed'
    AND to_tsvector('simple', c.content) @@ plainto_tsquery('simple', query_text)
    AND (filter_project IS NULL OR COALESCE(d.project_id, c.metadata->>'project_id', '') = filter_project)
  ORDER BY rank DESC
  LIMIT match_count;
$$;
```

- [ ] **Step 2: Apply the migration to Supabase**

Apply `sql/005_governance_lift_and_fix.sql` to project `nqxhsjkcvfxygiajdxki` (Supabase SQL editor, the Supabase MCP `apply_migration`/`execute_sql`, or `psql`).
Expected: no errors.

- [ ] **Step 3: Verify schema changes**

Run (SQL editor / MCP):
```sql
SELECT column_default FROM information_schema.columns
WHERE table_name='rag_documents' AND column_name='review_status';        -- expect 'needs_review'::review_status_enum
SELECT to_regclass('public.rag_document_events');                          -- expect not null
SELECT array_agg(column_name) FROM information_schema.columns
WHERE table_name='rag_documents' AND column_name IN ('summary','topics','currency','entity_ids'); -- expect all four
```
Expected: default is `needs_review`, table exists, four columns present.

- [ ] **Step 4: Verify the RPC fix surfaces real authority (before any backfill)**

Run:
```sql
SELECT (metadata->>'authority_score')::int AS auth
FROM match_chunks(
  (SELECT embedding FROM rag_chunks WHERE metadata->>'authority' = '95' LIMIT 1),
  5, NULL, NULL)
LIMIT 5;
```
Expected: at least one row with `auth = 95` (was `0` before the fix — proves the chunk authority is no longer shadowed).

- [ ] **Step 5: Commit**

```bash
git add sql/005_governance_lift_and_fix.sql
git commit -m "feat(sql): 005 governance defaults, audit table, RPC authority un-shadow + retired/rejected exclusion"
```

---

## Task 5: Backfill script (lift-up + Haiku tail, dry-run first)

**Files:**
- Create: `scripts/backfill-governance.ts`

- [ ] **Step 1: Write the script**

Create `scripts/backfill-governance.ts`:
```ts
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { liftUpFromChunks, decideReviewStatus, classifyDocument, type ChunkMetaLite } from '../src/lib/knowledge/classify'

const DRY_RUN = process.argv.includes('--dry-run')
const LIMIT = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || '0', 10)
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(url, key)
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

type DocRow = { id: string; title: string | null; doc_type: string | null; authority_score: number | null }

async function main() {
  let from = 0
  const page = 200
  const dist: Record<string, number> = {}
  let processed = 0
  for (;;) {
    const { data, error } = await supabase
      .from('rag_documents')
      .select('id, title, doc_type, authority_score')
      .order('id', { ascending: true })
      .range(from, from + page - 1)
    if (error) throw new Error(error.message)
    const docs = (data ?? []) as DocRow[]
    if (!docs.length) break

    for (const doc of docs) {
      if (LIMIT && processed >= LIMIT) { from = Number.MAX_SAFE_INTEGER; break }
      const { data: chunks } = await supabase
        .from('rag_chunks')
        .select('metadata, content')
        .eq('document_id', doc.id)
        .order('chunk_index', { ascending: true })
        .limit(60)
      const metas: ChunkMetaLite[] = (chunks ?? []).map(c => (c.metadata ?? {}) as ChunkMetaLite)
      const lifted = liftUpFromChunks(metas)

      let docType = lifted.doc_type
      let tier = lifted.authority_tier
      let score = lifted.authority_score
      let confidence = lifted.confidence
      let summary: string | null = null
      let topics: string[] = []
      let currency: string | null = null
      let lifecycle: string | null = null
      let period: string | null = lifted.period
      let source = 'rule'

      const ambiguous = !docType || docType === 'other' || tier === 'unverified'
      if (ambiguous) {
        const sample = (chunks ?? []).slice(0, 6).map(c => (c as { content?: string }).content ?? '').join('\n').slice(0, 4000)
        const cls = await classifyDocument({ title: doc.title ?? '', sample, dmsFolder: lifted.dms_folder }, anthropic)
        if (cls) {
          docType = cls.result.doc_type
          tier = cls.result.authority_tier
          score = cls.authority_score
          confidence = cls.result.confidence
          summary = cls.result.summary || null
          topics = cls.result.topics
          currency = cls.result.currency
          lifecycle = cls.result.lifecycle
          period = cls.result.period ?? period
          source = 'agent_auto'
        }
      }

      const review = decideReviewStatus({ doc_type: docType, authority_tier: tier, confidence })
      dist[review] = (dist[review] ?? 0) + 1
      processed++

      if (!DRY_RUN) {
        await supabase.from('rag_documents').update({
          doc_type: docType,
          authority_tier: tier,
          authority_score: score ?? 0,
          classification_source: source,
          classification_confidence: confidence,
          review_status: review,
          summary, topics, currency, lifecycle, period,
        }).eq('id', doc.id)
        await supabase.from('rag_document_events').insert({
          document_id: doc.id, action: 'backfill_classify', field: 'review_status',
          old_value: 'approved', new_value: review, actor: 'backfill', reason: source,
        })
      }
      if (processed % 100 === 0) console.log(`[backfill] ${processed} processed — dist ${JSON.stringify(dist)}`)
    }
    from += page
  }
  console.log(`[backfill] DONE ${DRY_RUN ? '(dry-run)' : ''} — processed ${processed}, distribution ${JSON.stringify(dist)}`)
}
main().catch(e => { console.error(e); process.exit(1) })
```

- [ ] **Step 2: Dry-run on a small sample**

Run:
```bash
npx tsx scripts/backfill-governance.ts --dry-run --limit=50
```
Expected: prints a distribution with BOTH `approved` and `needs_review` (no longer a single bucket), no writes.

- [ ] **Step 3: Verify nothing was written**

Run (SQL): `SELECT count(*) FROM rag_documents WHERE authority_score <> 0;`
Expected: `0` (dry-run wrote nothing).

- [ ] **Step 4: Real run, batched**

Run:
```bash
npx tsx scripts/backfill-governance.ts --limit=200   # first batch
```
Expected: ~200 docs updated; distribution printed.

- [ ] **Step 5: Verify governance is no longer uniform**

Run (SQL):
```sql
SELECT review_status, count(*), count(*) FILTER (WHERE authority_score >= 75) AS auth75plus
FROM rag_documents GROUP BY 1;
```
Expected: more than one `review_status`; a non-zero `auth75plus`.

- [ ] **Step 6: Full run**

Run: `npx tsx scripts/backfill-governance.ts`
Expected: ~5,498 processed (minus the 200 already done; re-running is safe — it recomputes idempotently).

- [ ] **Step 7: Commit**

```bash
git add scripts/backfill-governance.ts
git commit -m "feat(scripts): governance backfill (lift-up + Haiku tail, dry-run)"
```

---

## Task 6: Route ingestion through the classifier (one governed writer)

**Files:**
- Modify: `src/lib/ingest/queue-processor.ts:53-60,272-309` (defaults → classifier-derived governance)

- [ ] **Step 1: Replace the hardcoded governance defaults with classifier output**

In `src/lib/ingest/queue-processor.ts`, after the document is parsed (the `parsed.content` is available, ~line 264) and before building `mdFrontmatter`/`baseMetadata`, derive governance from the parsed content + queue hints instead of the `DEFAULT_*` constants:

Add import at top:
```ts
import Anthropic from '@anthropic-ai/sdk'
import { classifyDocument, decideReviewStatus } from '@/lib/knowledge/classify'
import { scoreToTier } from '@/lib/knowledge/authority'
```

Replace the use of `DEFAULT_REVIEW_STATUS`/`DEFAULT_AUTHORITY_TIER`/`DEFAULT_AUTHORITY_SCORE`/`DEFAULT_CLASSIFICATION_SOURCE` inside `processIngestQueueItem` with a classify step:
```ts
    // Classify the freshly-parsed document (one governed writer).
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
    const cls = await classifyDocument(
      { title: item.file_name, sample: parsed.content.slice(0, 4000), dmsFolder: item.category ?? null },
      anthropic
    )
    const govDocType = cls?.result.doc_type ?? item.category ?? null
    const govTier = cls?.result.authority_tier ?? 'unverified'
    const govScore = cls?.authority_score ?? 0
    const govConfidence = cls?.result.confidence ?? 0
    const govReview = decideReviewStatus({ doc_type: govDocType, authority_tier: govTier, confidence: govConfidence })
    const govSource: ClassificationSource = cls ? 'agent_auto' : 'rule'
```
Then use `govReview`, `govTier`, `govScore`, `govSource`, `govDocType` in `mdFrontmatter` and `baseMetadata` (replacing the `DEFAULT_*` references), and pass them to `reserveRagDocument` (extend its signature to accept a `governance` object and write those columns instead of the hardcoded `DEFAULT_*`). Keep `reserveRagDocument`'s `hasMissingColumnError` fallback path intact.

- [ ] **Step 2: Verify build + lint**

Run: `npm run lint && npm run build`
Expected: passes.

- [ ] **Step 3: End-to-end single-doc ingest check**

Run (dev server up):
```bash
curl -s -X POST http://localhost:3000/api/ingest/process -H 'Content-Type: application/json' -d '{"batchSize":1}'
```
Then (SQL): `SELECT review_status, authority_score, classification_source FROM rag_documents ORDER BY created_at DESC LIMIT 1;`
Expected: the new doc has classifier-derived governance (NOT `approved`/`0`/`human` by default; `agent_auto` or `rule`).

- [ ] **Step 4: Commit**

```bash
git add src/lib/ingest/queue-processor.ts
git commit -m "feat(ingest): classify on ingest — drop trusted-by-default governance"
```

---

## Task 7: Quarantine the legacy ingest writers

**Files:**
- Move: `scripts/ingest-dms.mjs` → `scripts/_archive/ingest-dms.mjs`
- Move: `scripts/ingest-key-docs.mjs` → `scripts/_archive/ingest-key-docs.mjs`

- [ ] **Step 1: Move and add a NO-RUN header**

```bash
mkdir -p scripts/_archive
git mv scripts/ingest-dms.mjs scripts/_archive/ingest-dms.mjs
git mv scripts/ingest-key-docs.mjs scripts/_archive/ingest-key-docs.mjs
```
Prepend to each moved file (line 1):
```js
// ⛔ ARCHIVED — DO NOT RUN. Writes ungoverned, un-hashed, duplicate rag_documents/rag_chunks
// outside the canonical pipeline (src/lib/ingest/queue-processor.ts). Kept for reference only.
```

- [ ] **Step 2: Confirm no live reference**

Run: `grep -rn "ingest-dms\|ingest-key-docs" src scripts package.json --include='*.ts' --include='*.mjs' --include='*.json' | grep -v _archive`
Expected: no output (nothing references them).

- [ ] **Step 3: Commit**

```bash
git add -A scripts/
git commit -m "chore(scripts): quarantine legacy ungoverned ingest writers"
```

---

## Self-Review

- **Spec coverage:** defaults flip (Task 4) ✓; RPC un-shadow + NULLIF (Task 4) ✓; status='retired' exclusion (Task 4, `status='indexed'`) ✓; `rag_document_events` (Task 4) ✓; enrichment columns (Task 4) ✓; lift-up + Haiku tail + confidence≥0.5 review (Tasks 2,3,5) ✓; single writer / classifier on ingest (Task 6) ✓; quarantine legacy (Task 7) ✓. The document-manager UI/APIs and markdown viewer are explicitly Plan 2. Chat prompt/threshold/stemming are spec C.
- **Type consistency:** `liftUpFromChunks`→`LiftedLabels.authority_tier` feeds `decideReviewStatus`/`scoreToTier`; `classifyDocument` returns `{result, authority_score}` consumed identically in Task 5 and Task 6; `ReviewStatus`/`AuthorityTier`/`ClassificationSource` come from `contracts.ts`. Confirm `contracts.ts` `DocType` members match `DOC_TYPES` in Task 3 — align if they differ (noted in Task 3 Step 3).
- **Placeholder scan:** every code step has complete code; verification steps have exact SQL/commands and expected output.
- **Risk note:** Task 6 edits `queue-processor.ts` by hand against line ranges that may shift — the executor must locate the `DEFAULT_*` usages rather than trust line numbers.

---

## Open verification (run once after Task 5 full run)
```sql
SELECT review_status, count(*) FROM rag_documents GROUP BY 1;                 -- expect a real spread
SELECT authority_tier, count(*) FROM rag_documents GROUP BY 1 ORDER BY 2 DESC; -- expect multiple tiers
SELECT count(*) FROM rag_documents WHERE classification_source='agent_auto';   -- expect the Haiku-classified tail
```
