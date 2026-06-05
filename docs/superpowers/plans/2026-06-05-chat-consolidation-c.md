# Spec C — Chat Retrieval Quality — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`).

**Goal:** Fix three chat-retrieval-quality defects: (1) trust-tier must dominate ranking, (2) ES/EN stemming + accent-insensitivity + index-backed keyword search, (3) decouple the interactive embedding path from the bulk-ingest rate limiter. Plus calibrate the inert match threshold.

**Architecture:** New pure `src/lib/rag/rank.ts` (unit-tested) replaces the inline rerank post-processing in the chat route. `src/lib/rag/embeddings.ts` gains a two-lane limiter. Migration `012` makes `rag_chunks.fts` a dual-language `unaccent`ed tsvector and rewrites `keyword_search_chunks` to use the GIN-indexed `fts` column. Branch `agent/chat-consolidation-c` (off `main` `1914c06`).

**Tech:** Next 16, Supabase (pgvector + tsvector/GIN + unaccent), vitest, Cohere rerank, Gemini embeddings.

**Spec:** `docs/superpowers/specs/2026-06-05-chat-consolidation-C-design.md`.

---

## Task 1: `rankBySourceTrust` — trust-tier-dominant ordering (TDD)

**Files:** Create `src/lib/rag/rank.ts`, Test `src/lib/rag/__tests__/rank.test.ts`

- [ ] **Step 1: Failing test**
```ts
import { describe, it, expect } from 'vitest'
import { rankBySourceTrust, trustTier } from '@/lib/rag/rank'

const md = (o: Record<string, unknown>) => o
const sor = md({ authority_score: 95, review_status: 'approved', classification_source: 'agent_reviewed' }) // source_of_record
const approved75 = md({ authority_score: 80, review_status: 'approved', classification_source: 'rule' })      // supporting
const needs95 = md({ authority_score: 95, review_status: 'needs_review', classification_source: 'agent_auto' }) // context

describe('trustTier', () => {
  it('ranks source_of_record > supporting > context', () => {
    expect(trustTier(sor)).toBeGreaterThan(trustTier(approved75))
    expect(trustTier(approved75)).toBeGreaterThan(trustTier(needs95))
  })
})

describe('rankBySourceTrust', () => {
  it('a needs_review authority-95 chunk never outranks an approved source_of_record one, even with higher relevance', () => {
    const ranked = rankBySourceTrust([
      { metadata: needs95, relevanceScore: 0.99 },
      { metadata: sor, relevanceScore: 0.40 },
    ])
    expect(ranked[0].metadata).toBe(sor)
  })
  it('within the same tier, higher Cohere relevance wins', () => {
    const ranked = rankBySourceTrust([
      { metadata: sor, relevanceScore: 0.5 },
      { metadata: sor, relevanceScore: 0.9 },
    ])
    expect(ranked[0].relevanceScore).toBe(0.9)
  })
  it('is stable for equal tier+relevance (preserves input order)', () => {
    const a = { metadata: approved75, relevanceScore: 0.5, id: 'a' }
    const b = { metadata: approved75, relevanceScore: 0.5, id: 'b' }
    expect(rankBySourceTrust([a, b]).map(x => (x as { id: string }).id)).toEqual(['a', 'b'])
  })
  it('missing metadata → unverified tier (lowest), still ordered by relevance', () => {
    const ranked = rankBySourceTrust([
      { metadata: undefined, relevanceScore: 0.9 },
      { metadata: approved75, relevanceScore: 0.1 },
    ])
    expect(ranked[0].metadata).toBe(approved75)
  })
})
```

- [ ] **Step 2: Run → fail.** `npm test -- rank`
- [ ] **Step 3: Implement** `src/lib/rag/rank.ts`:
```ts
import { verificationFromGovernance } from '@/lib/knowledge/source-reference'
import type { ClassificationSource, ReviewStatus } from '@/lib/knowledge/contracts'

const TIER_ORDER: Record<string, number> = { source_of_record: 3, supporting: 2, context: 1, unverified: 0 }
const REVIEW_VALUES = new Set(['pending', 'approved', 'rejected', 'needs_review'])
const SOURCE_VALUES = new Set(['human', 'rule', 'agent_auto', 'agent_reviewed', 'agent_corrected', 'agent_rejected'])

export type RankableChunk = { metadata?: Record<string, unknown>; relevanceScore: number }

function num(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim()) { const n = Number(v); if (Number.isFinite(n)) return n }
  return undefined
}
function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined
}

export function trustTier(metadata: Record<string, unknown> | undefined): number {
  const authority = num(metadata?.authority_score) ?? num(metadata?.authority)
  const rsRaw = str(metadata?.review_status)
  const csRaw = str(metadata?.classification_source)
  const reviewStatus = (rsRaw && REVIEW_VALUES.has(rsRaw) ? rsRaw : 'needs_review') as ReviewStatus
  const classificationSource = (csRaw && SOURCE_VALUES.has(csRaw) ? csRaw : 'unknown') as ClassificationSource | 'unknown'
  const verification = verificationFromGovernance(authority, reviewStatus, classificationSource)
  return TIER_ORDER[verification] ?? 0
}

/** Order by trust tier (desc), then Cohere relevance (desc); stable for ties. */
export function rankBySourceTrust<T extends RankableChunk>(chunks: T[]): T[] {
  return chunks
    .map((c, i) => ({ c, i, tier: trustTier(c.metadata) }))
    .sort((a, b) => (b.tier - a.tier) || (b.c.relevanceScore - a.c.relevanceScore) || (a.i - b.i))
    .map(x => x.c)
}
```
> Verify `verificationFromGovernance` is exported from `source-reference.ts` (it is, after Spec B F11). Its signature: `(authority: number | undefined, reviewStatus: ReviewStatus, classificationSource: ClassificationSource | 'unknown') => 'source_of_record' | 'supporting' | 'context' | 'unverified'`.

- [ ] **Step 4: Run → pass.** `npm test -- rank`
- [ ] **Step 5: Commit** `feat(rag): trust-tier-dominant ranking (rankBySourceTrust) + tests`

---

## Task 2: Wire `rankBySourceTrust` into the chat route

**Files:** Modify `src/app/api/chat/route.ts` (the `executeSearchDocuments` rerank block, ~lines 492–516)

- [ ] **Step 1:** Replace the post-rerank map+sort (the block computing `authorityBoost`/`reviewPenalty`/`relevanceScore` and `.sort(...)`) with:
```ts
  // Cohere rerank on combined pool, then order by source trust tier (tier dominates relevance).
  const reranked = (await rerankChunks(input.query, pool, 10))
    .filter(c => !isRejectedSource(c.metadata))
  const ranked = rankBySourceTrust(reranked)

  const sources: Source[] = ranked.map(c =>
    buildKnowledgeSource({
      id: c.id,
      relevance: c.relevanceScore,
      metadata: c.metadata,
      preview: c.content.slice(0, 200),
    })
  )

  const formatted = ranked
    .map((c, i) => {
      const header = sourceHeader(c.metadata ?? {}, c.relevanceScore, i)
      const warning = needsReviewWarning(c.metadata)
      return [header, warning, c.content].filter(Boolean).join('\n')
    })
    .join('\n\n---\n\n')
```
Add the import at the top: `import { rankBySourceTrust } from '@/lib/rag/rank'`.
- [ ] **Step 2:** `npm run build` (route still compiles; `rerankChunks` return type has `relevanceScore` + `metadata` + `content` + `id`).
- [ ] **Step 3: Commit** `feat(chat): order retrieval by source trust tier (drop additive authority boost)`

---

## Task 3: Decouple interactive embedding lane

**Files:** Modify `src/lib/rag/embeddings.ts`, Test `src/lib/rag/__tests__/embeddings-lane.test.ts`; Modify `src/app/api/chat/route.ts`

- [ ] **Step 1:** Replace the module-level limiter state + `waitForEmbeddingSlot` with a two-lane version:
```ts
type EmbedLane = 'bulk' | 'interactive'
type Limiter = { tail: Promise<void>; nextAt: number }
const limiters: Record<EmbedLane, Limiter> = {
  bulk: { tail: Promise.resolve(), nextAt: 0 },
  interactive: { tail: Promise.resolve(), nextAt: 0 },
}
export function laneIntervalMs(lane: EmbedLane): number {
  return lane === 'interactive'
    ? numberEnv('GEMINI_EMBEDDING_INTERACTIVE_MIN_INTERVAL_MS', 250)
    : numberEnv('GEMINI_EMBEDDING_MIN_INTERVAL_MS', 4000)
}
async function waitForEmbeddingSlot(lane: EmbedLane): Promise<void> {
  const lim = limiters[lane]
  const minIntervalMs = laneIntervalMs(lane)
  const run = lim.tail.then(async () => {
    const waitMs = lim.nextAt - Date.now()
    if (waitMs > 0) await sleep(waitMs)
    lim.nextAt = Date.now() + minIntervalMs
  })
  lim.tail = run.catch(() => undefined)
  return run
}
```
Thread `lane` through `withEmbeddingRetry(op, lane)` → `await waitForEmbeddingSlot(lane)`, and through `embedTextWithRest(text, lane)`, `embedTextsWithSdkBatch(texts, lane)`. Public API gains an options arg (default lane `'bulk'` so ingest is unchanged):
```ts
export type EmbedOpts = { lane?: EmbedLane }
export async function embedText(text: string, opts: EmbedOpts = {}): Promise<number[]> {
  return (await embedBatch([text], opts))[0] ?? []
}
export async function embedBatch(texts: string[], opts: EmbedOpts = {}): Promise<number[][]> {
  const lane = opts.lane ?? 'bulk'
  // ... existing body, passing `lane` to embedTextWithRest / embedTextsWithSdkBatch ...
}
```
- [ ] **Step 2:** In `src/app/api/chat/route.ts` `executeSearchDocuments`, change `const embedding = await embedText(input.query)` → `const embedding = await embedText(input.query, { lane: 'interactive' })`.
- [ ] **Step 3: Test** `src/lib/rag/__tests__/embeddings-lane.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { laneIntervalMs } from '@/lib/rag/embeddings'

describe('embedding lanes', () => {
  it('interactive lane default interval is much shorter than bulk', () => {
    expect(laneIntervalMs('interactive')).toBe(250)
    expect(laneIntervalMs('bulk')).toBe(4000)
    expect(laneIntervalMs('interactive')).toBeLessThan(laneIntervalMs('bulk'))
  })
})
```
- [ ] **Step 4: Run** `npm test -- embeddings-lane` → pass. (Behavioral decoupling — interactive query not queued behind bulk — is verified at runtime; lanes hold independent `tail`/`nextAt`.)
- [ ] **Step 5: Commit** `feat(rag): separate interactive embedding lane from bulk ingest limiter`

---

## Task 4: Migration 012 — dual-language, accent-insensitive, index-backed FTS

**Files:** Create `sql/012_dual_language_fts.sql`; apply via Supabase MCP `apply_migration` (name `dual_language_fts`).

- [ ] **Step 1: Apply** this migration (current `keyword_search_chunks` uses inline `to_tsvector('simple',...)` and does NOT use the `fts` column — this rewrite makes it use the GIN-indexed column):
```sql
create extension if not exists unaccent;

create or replace function rag_chunks_fts_update() returns trigger language plpgsql as $$
begin
  new.fts := to_tsvector('spanish', unaccent(coalesce(new.content, '')))
          || to_tsvector('english', unaccent(coalesce(new.content, '')));
  return new;
end;
$$;

create or replace function keyword_search_chunks(
  query_text text, filter_project text default null, match_count integer default 15, filter_doc_type text default null
) returns table(id uuid, document_id uuid, content text, metadata jsonb, rank real)
language sql stable as $$
  with q as (
    select (plainto_tsquery('spanish', unaccent(query_text))
         || plainto_tsquery('english', unaccent(query_text))) as tsq
  )
  select c.id, c.document_id, c.content,
    coalesce(c.metadata, '{}'::jsonb)
      || jsonb_strip_nulls(jsonb_build_object(
           'project_id', coalesce(d.project_id, c.metadata->>'project_id'),
           'doc_type',   coalesce(d.doc_type,   c.metadata->>'doc_type'),
           'period',     coalesce(d.period,     c.metadata->>'period')))
      || jsonb_build_object(
           'review_status', d.review_status, 'classification_source', d.classification_source,
           'authority_tier', d.authority_tier, 'authority_score', d.authority_score,
           'lifecycle', d.lifecycle, 'source_channel', d.source_channel,
           'md_path', d.md_path, 'document_source_hash', d.source_hash) as metadata,
    ts_rank_cd(c.fts, q.tsq) as rank
  from public.rag_chunks c
  join public.rag_documents d on d.id = c.document_id
  cross join q
  where d.review_status <> 'rejected'
    and d.classification_source is distinct from 'agent_rejected'
    and d.status = 'indexed'
    and c.fts @@ q.tsq
    and (filter_project is null or coalesce(d.project_id, c.metadata->>'project_id', '') = filter_project)
    and (filter_doc_type is null or coalesce(d.doc_type, c.metadata->>'doc_type', '') = filter_doc_type)
  order by rank desc
  limit match_count;
$$;
```
- [ ] **Step 2: Backfill** the 156,898 `fts` cells in batches (run via execute_sql; idempotent). Loop until no `content`-bearing row is stale. Pattern (repeat until `0 rows`):
```sql
with batch as (
  select id from rag_chunks
  where fts is null or fts <> (to_tsvector('spanish', unaccent(coalesce(content,''))) || to_tsvector('english', unaccent(coalesce(content,''))))
  limit 10000
)
update rag_chunks c set fts = to_tsvector('spanish', unaccent(coalesce(c.content,''))) || to_tsvector('english', unaccent(coalesce(c.content,'')))
from batch where c.id = batch.id;
```
Run repeatedly (≈16 batches). Confirm `select count(*) from rag_chunks where fts is null` = 0 and that a re-run of the batch query updates 0 rows.
- [ ] **Step 3: Live verify (self-cleaning DO block)** — Spanish stemming + accent + governance filter:
```sql
DO $$
DECLARE v_doc uuid; v_n int;
BEGIN
  INSERT INTO rag_documents (title,status,review_status,classification_source,authority_score,authority_tier,project_id)
    VALUES ('ZZZ fts TESTDOC','indexed','approved','rule',80,'controller','MAD') RETURNING id INTO v_doc;
  INSERT INTO rag_chunks (document_id, chunk_index, content) VALUES
    (v_doc, 0, 'El sistema de climatización y las instalaciones fueron auditadas en 2026.');
  -- accent-insensitive + spanish stem (auditadas ~ auditar)
  SELECT count(*) INTO v_n FROM keyword_search_chunks('climatizacion', 'MAD', 10, null);
  ASSERT v_n >= 1, format('accent/stem miss: %s', v_n);
  SELECT count(*) INTO v_n FROM keyword_search_chunks('auditar', 'MAD', 10, null);
  ASSERT v_n >= 1, format('spanish stem miss: %s', v_n);
  -- english still works
  INSERT INTO rag_chunks (document_id, chunk_index, content) VALUES (v_doc, 1, 'The facility was funded by the senior lenders.');
  SELECT count(*) INTO v_n FROM keyword_search_chunks('funding', 'MAD', 10, null);
  ASSERT v_n >= 1, format('english stem miss: %s', v_n);
  -- governance: reject the doc -> excluded
  UPDATE rag_documents SET review_status='rejected' WHERE id=v_doc;
  SELECT count(*) INTO v_n FROM keyword_search_chunks('climatizacion', 'MAD', 10, null);
  ASSERT v_n = 0, format('rejected still visible: %s', v_n);
  DELETE FROM rag_chunks WHERE document_id=v_doc;
  DELETE FROM rag_documents WHERE id=v_doc;
  RAISE NOTICE 'FTS DUAL-LANGUAGE VERIFIED';
END $$;
```
- [ ] **Step 4:** Save `sql/012_dual_language_fts.sql` + commit `feat(sql): 012 dual-language unaccent FTS + index-backed keyword_search_chunks`. Confirm `select count(*) from rag_chunks where fts is null` = 0 and corpus counts unchanged.

---

## Task 5: Calibrate `RAG_MATCH_THRESHOLD`

**Files:** verification only + a note in the spec/outcome.

- [ ] **Step 1:** Embed a representative query (interactive lane) and call `match_chunks` to inspect the similarity distribution of returned chunks (via a throwaway tsx snippet or by capturing `similarity` from a live chat call's tool audit). Determine the real floor.
- [ ] **Step 2:** Set `RAG_MATCH_THRESHOLD` env (and the `'0.18'` default in `route.ts:122`) to a value that trims genuine noise without hurting recall (gemini-embedding-001 relevant-chunk cosine typically ~0.4–0.7). If 0.18 turns out correct, document that and leave it.
- [ ] **Step 3: Commit** `chore(chat): calibrate RAG_MATCH_THRESHOLD to <value> (was inert at 0.18)`

---

## Task 6: Full verification gate
- [ ] `npm test` (existing 44 + new rank + embeddings-lane) — all green.
- [ ] `npm run lint` — clean. `npm run build` — succeeds.
- [ ] Live: re-run the Task 4 Step 3 DO block (passes); `select count(*) from rag_chunks where fts is null` = 0; corpus 5,498 docs unchanged.
- [ ] Commit any fixes. Branch `agent/chat-consolidation-c` ready for adversarial review.

---

## Self-Review (plan vs spec)
- **Spec coverage:** §2 ranking → Task 1+2; §3 stemming → Task 4; §4 limiter → Task 3; §5 threshold → Task 5. No gaps.
- **Placeholders:** none — all code/SQL is complete; Task 5 calibration value is determined live (documented).
- **Type consistency:** `rankBySourceTrust`/`trustTier`/`RankableChunk` consistent across Task 1/2; `EmbedOpts`/`EmbedLane`/`laneIntervalMs` consistent across Task 3; the migration matches the verified current RPC/trigger shape.

## Out of scope (unchanged)
C1 (auth/RLS, pre-publication); model swaps; mass re-parse; ingest adapters.
