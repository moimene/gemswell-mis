# Sub-project A — Implementation & Adversarial-Hardening Outcome

Date: 2026-06-05
Branch: `agent/corpus-gobernado-foundation`
Spec: `2026-06-05-gestor-documental-gobernado-design.md`
Plan: `../plans/2026-06-05-corpus-gobernado-foundation.md`

## What shipped (commits on the branch)

| Task | Commit | Result |
|---|---|---|
| A0 vitest + tsx tooling | `da12d6e` | test runner online |
| A1 `authority.ts` (score↔tier) | `549e0e2` | pure, TDD |
| A2 `classify.ts` lift-up + review decision | `e0e0989` | pure, TDD |
| A3 Haiku classifier (prompt/parse/wrapper) | `ca9e860` | zod-validated |
| A4 migration 005 + match_chunks unify | `d4a9c96` | applied; **chat RPC restored** |
| A5 backfill script | `0bc8b8d` → `0fb85cc` | resumable drain |
| A6 classify-on-ingest in queue-processor | `260f2a2` | drops trusted-by-default |
| A7 quarantine legacy ingest writers | `d93355d` | single governed writer |
| Adversarial fixes F2/F4/F5/F7/F8 | `cccc186` | trust-boundary hardening |
| Adversarial fixes F1/F3 (migration 006) | `2ecbc26` | RPC parent-first |
| Adversarial fix F6 (migration 007 + drain) | `0fb85cc` | backfill convergence |
| Codex pass-2 fixes CX-1..CX-5 (migration 008) | `8d69d9a` | strict gov override + sticky agent_rejected + final-update guard + transient retry |

## Mid-flight incidents handled
- **Concurrent session collision**: another session added a 5-arg `match_chunks(... match_threshold)` overload via raw SQL while this work ran, making the chat's RPC call ambiguous ("function is not unique") → chat broken. Resolved by unifying into a single 5-arg function that merges their threshold(0.18)+authority-ordering with this work's `NULLIF` un-shadow + `status='indexed'` exclusion (migration `unify_match_chunks_threshold_governance`). Their `5b048af "Sanitize chat RAG quality governance"` is a legitimate ancestor of this branch (integrated via git history).
- **`.env.local` flickering**: the `ANTHROPIC_API_KEY` was intermittently emptied by an external editor during the run. Worked around by passing the key inline for the backfill (immune to the file race). **Open risk**: if this persists, the deployed/local chat will fail Anthropic calls when the var is empty.

## Adversarial review (ruflo-coordinated swarm + Codex second pass)
Swarm `swarm-1780667905126-o389nh` (hierarchical-mesh, 4 reviewer agents registered). Four deep adversarial reviewers (opus) verified against the live DB and found 8 real, cross-validated issues — all fixed:

- **F1 (CRITICAL)** `match_chunks` was chunk-first → parent-level reclassification was a no-op for vector search (44,839 chunks already divergent). Fixed: both RPCs parent-first. Verified: a doc with parent `doc_type='dd'` and chunks `asset_management` now returns `dd`.
- **F2 (HIGH)** chat rerank defaulted missing `review_status` to `'approved'` (fail-open) + keyword RPC emitted `null` (no `jsonb_strip_nulls`). Fixed: `?? 'needs_review'` + strip_nulls.
- **F3 (HIGH)** `NULLIF(authority_score,0)` resurrected stale chunk authority (26,682 chunks). Fixed: trust parent authority.
- **F4 (HIGH)** Haiku self-graded confidence could auto-mint `source_of_record`. Fixed: `source_of_record` requires a human-validated `classification_source`.
- **F5 (HIGH)** re-ingest of a human-`rejected` doc auto-flipped it back to approved. Fixed: sticky rejection (skip re-ingest of rejected docs).
- **F6 (MED)** backfill `summary`-sentinel never converged (reprocess + duplicate events). Fixed: `governance_backfilled_at` drain loop.
- **F7 (MED)** ingest classify had no timeout/retry, client per-doc. Fixed: memoized client, `timeout:30s, maxRetries:3`.
- **F8 (MED)** `doc_type` enum drift between classify and contracts. Fixed: single `DOC_TYPES` source of truth.

Deferred to spec C (chat consolidation): rerank `reviewPenalty` vs additive `authorityBoost` can let an unreviewed high-authority doc outrank an approved one; `match_threshold 0.18` is below the corpus cosine floor (inert knob); minor `liftUpFromChunks` garbage-coercion guards.

## Codex pass-2 (independent second-opinion review, 2026-06-05)
After ruflo-swarm fixes landed, Codex (gpt-5.5, medium reasoning, scope limited to the 5 changed files) found 5 additional real issues — all fixed in commit `8d69d9a` + migration 008:

- **CX-1 (HIGH, latent)** `sql/006` `jsonb_strip_nulls(...)` dropped null governance overrides, leaving stale chunk-side metadata visible. Fixed in `sql/008`: two-stage merge — `strip_nulls` only on reconcilable fields (`project_id/doc_type/period`); governance is always parent-only, even when null (NULL→fail-closed via `source-reference.ts`).
- **CX-2 (HIGH, preventive)** backfill could overwrite human/agent_reviewed/agent_corrected decisions. Fixed: pool excludes those + rejected.
- **CX-3 (MED)** sticky-rejection only fired on `review_status='rejected'`, not on `classification_source='agent_rejected'`. Fixed: both signals now sticky.
- **CX-4 (CRITICAL)** final `rag_documents.update()` error was silently ignored — queue could be marked `done` while doc stayed `processing` (invisible to chat). Fixed: capture + throw, outer catch marks both `error`.
- **CX-5 (MED)** transient Haiku failures marked `governance_backfilled_at` → never retried. Fixed: leave NULL on classifier failure so next drain run picks it up.

Codex's first pass with `high` reasoning hung >50 min (known issue per `/codex` skill — OpenAI #8545/#8402/#6931); retried with `medium` reasoning + acotated scope produced these 5 in <30s. Pattern lesson: prefer `medium` for diff-heavy reviews.

## Final state
- match_chunks / keyword_search_chunks: single overload each, parent-first, trust-parent authority, exclude rejected + retired + agent_rejected.
- Governance is no longer vacuous: real authority surfaces (95 verified), distribution is a real spread (~59% approved / ~41% needs_review), source_of_record reserved for human-validated docs.
- Backfill: resumable drain on `governance_backfilled_at`.
- One governed writer (`queue-processor.ts`); legacy scripts quarantined.

## Still out of scope (next specs)
- Spec B: document-manager UI (`/admin/documents`, review/approve/reject/reclassify/retire/supersede, markdown viewer, corpus health) — now sits on real governance data.
- Spec C: chat consolidation (neutralize hardcoded prompt facts, ranking trust-tier dominance, ES/EN stemming, embedding-limiter decoupling).
- Security/RLS: pre-publication (per user direction).
