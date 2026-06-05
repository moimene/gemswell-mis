# Spec B — Adversarial-Review Fix Plan (4-reviewer swarm + 2nd pass)

Apply ALL fixes below on branch `agent/gestor-documental-b`. Keep `npm test`, `npm run lint`, `npm run build` green and the live e2e (`DO` blocks against `nqxhsjkcvfxygiajdxki`, self-cleaning) passing. Commit in logical groups. Do NOT push.

The crux is **F1: a transactional governance RPC** — the route must stop doing 3 separate writes. Everything else layers on top.

---

## F1 (HIGH) — Atomic governance writes via RPC `apply_document_governance` + double-supersede guard + optimistic version

### New migration `sql/010_governance_rpcs.sql` — apply it via Supabase MCP `apply_migration` (name `governance_action_and_health_rpcs`) AND save the file.

```sql
-- Atomic application of a governance action: primary patch + optional related (superseded) patch + events,
-- in ONE transaction, with an optimistic version check and a double-supersede guard.
create or replace function apply_document_governance(
  p_doc_id uuid,
  p_patch jsonb default '{}'::jsonb,
  p_expected_version integer default null,
  p_related_id uuid default null,
  p_related_patch jsonb default '{}'::jsonb,
  p_events jsonb default '[]'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cur_version integer;
  v_existing uuid;
begin
  select current_version into v_cur_version from rag_documents where id = p_doc_id for update;
  if not found then
    raise exception 'document % not found', p_doc_id using errcode = 'P0002';
  end if;
  if p_expected_version is not null and v_cur_version is distinct from p_expected_version then
    raise exception 'version conflict on % (expected %, found %)', p_doc_id, p_expected_version, v_cur_version using errcode = '40001';
  end if;

  if p_related_id is not null then
    if p_related_id = p_doc_id then
      raise exception 'a document cannot supersede itself' using errcode = '22023';
    end if;
    perform 1 from rag_documents where id = p_related_id for update;
    if not found then
      raise exception 'superseded document % not found', p_related_id using errcode = 'P0002';
    end if;
    select id into v_existing from rag_documents where supersedes_document_id = p_related_id and id <> p_doc_id limit 1;
    if v_existing is not null then
      raise exception 'document % already superseded by %', p_related_id, v_existing using errcode = '23505';
    end if;
  end if;

  -- primary patch (absent jsonb key => keep current; our patches never set a column to null)
  update rag_documents set
    review_status          = coalesce((p_patch->>'review_status')::review_status_enum, review_status),
    classification_source  = coalesce((p_patch->>'classification_source')::classification_source_enum, classification_source),
    status                 = coalesce(p_patch->>'status', status),
    doc_type               = coalesce(p_patch->>'doc_type', doc_type),
    project_id             = coalesce(p_patch->>'project_id', project_id),
    period                 = coalesce(p_patch->>'period', period),
    lifecycle              = coalesce((p_patch->>'lifecycle')::lifecycle_enum, lifecycle),
    authority_tier         = coalesce((p_patch->>'authority_tier')::authority_tier_enum, authority_tier),
    authority_score        = coalesce((p_patch->>'authority_score')::integer, authority_score),
    supersedes_document_id = coalesce((p_patch->>'supersedes_document_id')::uuid, supersedes_document_id),
    current_version        = coalesce((p_patch->>'current_version')::integer, current_version)
  where id = p_doc_id;

  if p_related_id is not null and p_related_patch is not null and p_related_patch <> '{}'::jsonb then
    update rag_documents set
      status    = coalesce(p_related_patch->>'status', status),
      lifecycle = coalesce((p_related_patch->>'lifecycle')::lifecycle_enum, lifecycle)
    where id = p_related_id;
  end if;

  if p_events is not null and jsonb_array_length(p_events) > 0 then
    insert into rag_document_events (document_id, action, field, old_value, new_value, actor, reason)
    select (e->>'document_id')::uuid, e->>'action', e->>'field', e->>'old_value', e->>'new_value',
           coalesce(e->>'actor','admin:console'), e->>'reason'
    from jsonb_array_elements(p_events) as e;
  end if;

  return jsonb_build_object('ok', true, 'document_id', p_doc_id,
    'version', (select current_version from rag_documents where id = p_doc_id));
end $$;

-- Single-query corpus health (replaces 9 head-counts + a full 5.5k authority scan + a full ingest_queue scan).
-- source_of_record + governance counts are status='indexed'-scoped to match retrieval reality.
create or replace function knowledge_corpus_health()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'docs', (select jsonb_build_object(
      'total', count(*),
      'approved', count(*) filter (where review_status='approved' and status='indexed'),
      'needs_review', count(*) filter (where review_status='needs_review' and status='indexed'),
      'rejected', count(*) filter (where review_status='rejected'),
      'pending', count(*) filter (where review_status='pending'),
      'retired', count(*) filter (where status='retired'),
      'source_of_record', count(*) filter (where status='indexed' and authority_score>=90 and review_status='approved'
                                            and classification_source in ('human','agent_reviewed','agent_corrected')),
      'authority_sum', coalesce(sum(authority_score) filter (where status='indexed'), 0),
      'authority_count', count(*) filter (where status='indexed'),
      'with_markdown', count(*) filter (where md_path is not null),
      'with_source_hash', count(*) filter (where source_hash is not null)
    ) from rag_documents),
    'queue', (select jsonb_build_object(
      'total', count(*),
      'queued', count(*) filter (where status='queued'),
      'processing', count(*) filter (where status='processing'),
      'done', count(*) filter (where status='done'),
      'error', count(*) filter (where status='error')
    ) from ingest_queue)
  );
$$;
```

### Route `src/app/api/knowledge/documents/[id]/route.ts` PATCH — replace the 3 separate writes with the RPC:
Replace the block that does `supabase.from('rag_documents').update(result.patch)` + related update + events insert with:
```ts
    const { error: rpcErr } = await supabase.rpc('apply_document_governance', {
      p_doc_id: id,
      p_patch: result.patch,
      p_expected_version: (current as { current_version: number }).current_version,
      p_related_id: result.related?.id ?? null,
      p_related_patch: result.related?.patch ?? {},
      p_events: result.events,
    })
    if (rpcErr) {
      const code = (rpcErr as { code?: string }).code
      if (code === 'P0002') return NextResponse.json({ error: 'document not found' }, { status: 404 })
      if (code === '40001' || code === '23505' || code === '22023')
        return NextResponse.json({ error: rpcErr.message }, { status: 409 })
      if (code === '22P02' || code === '23514') return NextResponse.json({ error: 'invalid field value' }, { status: 400 })
      return NextResponse.json({ error: rpcErr.message }, { status: 500 })
    }
```
Keep passing `p_expected_version` from `current.current_version` (GOV_COLS already includes `current_version`).

**Acceptance:** the self-cleaning live e2e (Part 1 + Part 2 from the verify gate) still passes; additionally a `DO` block proving that calling the RPC twice with a stale `p_expected_version` raises `40001`, and that double-supersede raises `23505`.

---

## F2 (HIGH) — Validate reclassify fields in the engine (fail loud, not silent-corrupt or 500)

### `src/lib/knowledge/contracts.ts` — add a project-id allow-list near DOC_TYPES:
```ts
export const PROJECT_IDS = ['MAD', 'BHX', 'KLP', 'PHILAE', 'GVF', 'ETP'] as const
export type ProjectId = typeof PROJECT_IDS[number]
export const LIFECYCLES = ['draft','signed','executed','filed','audited','working_paper','superseded','unknown'] as const
export const AUTHORITY_TIERS = ['audited','executed','controller','board_pack','dd_memo','internal','narrative','unverified'] as const
```
Also extend `DocGovernanceState` to carry the fields needed for old-value audit + restore guard:
```ts
export type DocGovernanceState = {
  review_status: ReviewStatus
  classification_source: ClassificationSource
  status: string
  authority_score: number
  authority_tier: AuthorityTier
  current_version: number
  supersedes_document_id?: string | null
  doc_type?: DocType | null
  project_id?: string | null
  period?: string | null
  lifecycle?: Lifecycle | null
}
```

### `src/lib/knowledge/governance-actions.ts` reclassify — validate before building the patch:
```ts
import { DOC_TYPES, PROJECT_IDS, LIFECYCLES, AUTHORITY_TIERS } from '@/lib/knowledge/contracts'
// inside reclassify, after the empty-fields guard:
if (fields.doc_type !== undefined && !(DOC_TYPES as readonly string[]).includes(fields.doc_type))
  throw new InvalidTransitionError(`invalid doc_type: ${fields.doc_type}`)
if (fields.project_id != null && !(PROJECT_IDS as readonly string[]).includes(fields.project_id))
  throw new InvalidTransitionError(`invalid project_id: ${fields.project_id}`)
if (fields.lifecycle !== undefined && !(LIFECYCLES as readonly string[]).includes(fields.lifecycle))
  throw new InvalidTransitionError(`invalid lifecycle: ${fields.lifecycle}`)
if (fields.authority_tier !== undefined && !(AUTHORITY_TIERS as readonly string[]).includes(fields.authority_tier))
  throw new InvalidTransitionError(`invalid authority_tier: ${fields.authority_tier}`)
```
Route already maps `InvalidTransitionError` → 409. Add tests for each invalid value.

---

## F3 (HIGH) — `approve` must not resurrect a sticky `agent_rejected` doc
In `governance-actions.ts` `approve`, at the very top of the case:
```ts
if (current.classification_source === 'agent_rejected')
  throw new InvalidTransitionError('document was auto-rejected (agent_rejected); reclassify or restore it explicitly before approving')
```
Add a test: approve on an `agent_rejected` doc throws `InvalidTransitionError`.

---

## F4 (HIGH) — `restore` must not resurrect a superseded doc
Requires `lifecycle` on `DocGovernanceState` (added in F2) and `GOV_COLS` (below). In `restore`:
```ts
if (current.lifecycle === 'superseded')
  throw new InvalidTransitionError('document was superseded; restore its successor relationship explicitly')
```
Add a test: restore on a `{status:'retired', lifecycle:'superseded'}` doc throws.

---

## F5 (MED) — Faithful audit: real old values for reclassify + supersede lifecycle event
- `route.ts` `GOV_COLS`: add `doc_type, project_id, period, lifecycle` so `current` carries them.
- `governance-actions.ts` reclassify: use the real prior values as `old_value` (now available on `current`):
  `ev(documentId, 'reclassify', 'doc_type', current.doc_type ?? null, fields.doc_type, actor, reason)` etc. for project_id/period/lifecycle.
- `supersede`: add a second event on the OLD doc logging the lifecycle change:
  `ev(supersede.oldId, 'superseded_by', 'lifecycle', supersede.oldDoc.lifecycle ?? null, 'superseded', actor, reason)`.
- Update the supersede test to expect events on both docs incl. the lifecycle event.

---

## F6 (MED) — Corpus health via the new RPC (fixes count fidelity + perf)
`src/app/api/knowledge/corpus/health/route.ts`: replace ALL the per-count queries + the 5.5k authority scan + the ingest_queue scan with a single `supabase.rpc('knowledge_corpus_health')` call, then map its `{docs, queue}` jsonb into `buildCorpusHealth(...)`. `buildCorpusHealth` and its test stay as-is (map `docs.authority_sum`→authoritySum, `docs.authority_count`→authorityCount, `docs.with_markdown`→withMarkdown, etc.).

---

## F7 (MED) — `includeRetired` means indexed-or-retired, not "all statuses"
`src/app/api/knowledge/documents/route.ts`: replace
`if (!p.includeRetired) query = query.eq('status','indexed')`
with:
```ts
query = p.includeRetired ? query.in('status', ['indexed', 'retired']) : query.eq('status', 'indexed')
```

## F8 (MED) — Cap chunk fetch in detail route
`route.ts` GET: limit the chunk query (`.order('chunk_index').limit(1200)`) and reconstruct markdown from those; add a `chunks_truncated: boolean` flag in the response (`chunk_count > fetched`). The panel already only previews 240 chars/chunk; nothing else to change UI-side except optionally showing "(mostrando primeros N chunks)".

## F9 (MED) — Replace `prompt()` reject with an inline reason form
`DocumentPanel.tsx`: add `rejectOpen` state + a small inline form (like the reclassify form) with a required reason input and Confirm/Cancel. Cancel does NOT dispatch. Reject only fires on Confirm with a non-empty reason. Remove the `prompt()` call.

## F10 (MED) — Show the authority_score that a tier change will write
`DocumentPanel.tsx` reclassify form: when `authority_tier` is selected, render `→ authority_score = {AUTHORITY_TIER_SCORE[tier]}` next to the select (import `AUTHORITY_TIER_SCORE` from contracts) so the operator sees the numeric consequence.

## F11 (MED) — Single source of truth for the verification badge
`source-reference.ts`: `export` the `verificationFromGovernance` function. `badges.tsx`: delete its local `verification()` + `HUMAN_VALIDATED` copy and import `verificationFromGovernance` from `@/lib/knowledge/source-reference`, calling it with `(score ?? undefined, review as ReviewStatus, source as ClassificationSource)`. Keep the badge's label/style mapping.

## F12 (LOW) — Escape LIKE wildcards in list search
`documents/route.ts`: `const safeQ = p.q.replace(/[%_\\]/g, m => '\\' + m)` then `.ilike('title', \`%${safeQ}%\`)`.

## F13 (LOW) — Bad JSON body → 400
`route.ts` PATCH: wrap `await request.json()` in its own try/catch returning `400 { error: 'invalid JSON body' }`.

## F14 (LOW) — Health header shows all spec metrics
`CorpusHealth.tsx`: add Stat tiles for `retired`, `rejected`, `pct_markdown` (as %), `pct_source_hash` (as %). Data is already in the payload.

## F15 (LOW) — Reset panel state per document
`page.tsx`: add `key={selected}` to `<DocumentPanel ... />` so it remounts per doc (clears stale reclassify selections).

---

## Verification after fixes
1. `npm test` (extend governance-actions tests for F2/F3/F4/F5) — all green.
2. `npm run lint` + `npm run build` — green.
3. Live e2e: re-run the Part 1 + Part 2 self-cleaning `DO` blocks **and** add: RPC double-supersede → 23505; stale version → 40001; reclassify invalid project_id → engine throws (unit). Confirm `select count(*) from rag_documents` = 5498, 0 leftover `ZZZ %` rows.
4. Commit in groups: migration+RPC+route(F1/F6/F8/F13), engine+contracts+tests(F2/F3/F4/F5/F12), UI(F9/F10/F11/F14/F15/F7).
