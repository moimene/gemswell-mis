# Sub-project B — Gestor Documental Gobernado · Implementation & Adversarial-Hardening Outcome

Date: 2026-06-05
Branch: `agent/gestor-documental-b` (23 commits, **not merged, not pushed**)
Spec: `2026-06-05-gestor-documental-gobernado-design.md` §7–§9 + `2026-06-05-gestor-documental-B-addendum.md` (D1–D5)
Plan: `../plans/2026-06-05-gestor-documental-b.md` + fix plan `../plans/2026-06-05-gestor-documental-b-fixes.md`
Builds on: sub-project A (`7066969`, merged to local `main`).

## What shipped
The **human decision layer** over A's machine-governed corpus: `/admin/documents` UI + `/api/knowledge/*` APIs to approve / reject / reclassify / retire / restore / supersede documents, writing `rag_documents` + append-only `rag_document_events`, with chat retrieval staying in sync via A's parent-first RPCs.

- **Lib (pure, unit-tested):** `governance-actions.ts` (action engine, D2/D4/D5 + all review guards), `documents-query.ts`, `markdown-reconstruct.ts`, `corpus-health.ts`, contracts additions. 44 vitest tests.
- **APIs:** `GET /api/knowledge/documents` (filtered list), `GET/PATCH /api/knowledge/documents/[id]` (detail + governed mutation), `GET /api/knowledge/corpus/health`.
- **UI:** `/admin/documents` — table + 6 filters, detail panel with 5 actions + inline reject form + reclassify (with tier→score hint), markdown/chunks/events viewers, supersede picker, corpus-health header (10 tiles), sidebar nav.
- **Trust gate (D2):** approve → `classification_source='agent_reviewed'`, reclassify-with-edits → `agent_corrected`; an `authority≥90 + approved + human-validated` doc becomes `source_of_record` (logic reused from A's `source-reference.ts`, unchanged). ~831 docs (797 one-click) become eligible as they're reviewed.

## Migrations (applied to `nqxhsjkcvfxygiajdxki`)
- `009_status_allow_retired.sql` (`allow_retired_document_status`) — widen the `status` CHECK to allow `'retired'` (live verification revealed the original constraint blocked retire).
- `010_governance_rpcs.sql` (`governance_action_and_health_rpcs`) — `apply_document_governance()` (atomic action) + `knowledge_corpus_health()` (single-query health).
- `011_governance_rpc_hardening.sql` (`governance_rpc_hardening`) — Codex pass-2 fixes (see below).

## Review rounds (all with live-DB verification, no corpus mutated — self-cleaning tx)
**Round 1 — ruflo swarm `swarm-1780679296529-nyrkth` (4 opus reviewers) + Claude 2nd pass.** 17 findings, cross-validated. All fixed (F1–F15):
- F1 (HIGH): non-transactional PATCH (supersede split-brain) → **transactional RPC** `apply_document_governance` with optimistic-version + double-supersede guards.
- F2 (HIGH): unvalidated reclassify free-text/enum fields → engine validates against `DOC_TYPES`/`PROJECT_IDS`/enums (→ 409).
- F3 (HIGH): `approve` resurrected sticky `agent_rejected` → blocked.
- F4 (HIGH): `restore` resurrected a superseded doc → blocked on `lifecycle='superseded'`.
- F5–F15: faithful audit (real old values), health count scoping, chunk-fetch cap, `includeRetired` semantics, inline reject form, tier→score hint, shared verification badge, JSON-400, LIKE-escape, per-doc remount, health tiles.

**Round 2 — Codex (gpt, medium reasoning, scope=diff).** 7 findings, all real, the swarm missed them:
- CX-B1 (CRITICAL): the `SECURITY DEFINER` RPCs were `EXECUTE`-able by `PUBLIC`/`anon` → forgeable governance bypassing RLS. **Fixed:** revoked from public/anon/authenticated, granted only `service_role` (verified: anon/authenticated `EXECUTE=false`).
- CX-B3 (HIGH): optimistic lock inert for non-supersede actions → **bump `current_version` on every governed write** (verified: stale version now → 40001). Plus supersede always advances the version.
- CX-B4 (HIGH): `coalesce` couldn't tell intentional JSON null from absent key → nullable cols use `p_patch ? key` (verified: present-null clears the column).
- CX-B5 (HIGH): A↔B supersede deadlock → deterministic id-order lock; route maps `40P01` → 409.
- CX-B6 (MED): a retired/rejected doc could supersede a live one → engine guard (superseding doc must be indexed + non-rejected) + UI disables the button.
- CX-B7 (MED): health `rejected`/`pending` counts now `status='indexed'`-scoped like the rest.
- CX-B2 (CRITICAL, **DEFERRED**): the `/api/knowledge/*` routes have **no authn/authz** and use the RLS-bypassing service-role client; `actor` is client-supplied. This is the spec-deferred audit risk **C1 (auth/RLS), the top pre-publication blocker.** Not exploitable while unpushed; must be closed before any deploy.

## Final state
- 44 vitest tests green; `npm run lint` clean; `npm run build` succeeds.
- All governance writes atomic + audited + optimistic-locked; retire/reject/supersede correctly drop docs from chat retrieval (parent-first RPC, live-verified); reclassify propagates without touching 156k chunks.
- Corpus untouched: 5,498 docs, 0 retired, 0 leftover test rows after every e2e run.

## Still out of scope
- **Pre-publication (REQUIRED before deploy):** CX-B2 / audit C1 — auth + RLS lockdown on `/api/knowledge/*` and the corpus tables.
- **Spec C** (chat consolidation): hardcoded prompt facts (audit C2), trust-tier ranking dominance, ES/EN stemming, embedding-limiter decoupling.
- Mass re-parse of originals to real markdown; upload/Drive/Gmail ingest adapters.

## Merge
Branch is ancestrally clean off `main` (HEAD `7066969`). Merge is the user's call (per the A precedent). `--no-ff` recommended to preserve agent-branch attribution. **Do not push** (main auto-deploys, and CX-B2 must be closed first).
