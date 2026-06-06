# C1 CUTOVER RUNBOOK — turn on Auth + lock the corpus

**Audience:** the operator publishing Gemswell MIS (probably you, weeks from now).
**Goal:** flip the app from "anon-open, world-readable corpus" to "admin-only login + RLS-locked DB" **without** locking yourself out and **without** leaving a window where the corpus is exposed longer than necessary.
**Source of truth:** spec `2026-06-06-auth-rls-C1-design.md` §3, refined by adversarial rounds R1/R2 (see `…-C1-outcome.md`).

> ⚠️ **This is a coordinated, semi-destructive event on the SHARED live DB `nqxhsjkcvfxygiajdxki`.** The instant you apply `013`, **every anon-key client stops reading** — the deployed app, any other dev session, any script using `NEXT_PUBLIC_SUPABASE_ANON_KEY` against tables/views. That is the point. Just don't be surprised. Do it in a quiet window.

> ⚠️ **`013` is irreversible-ish.** It drops the existing `open_all` policies. Rollback means re-opening RLS by hand (§7). There is no "undo button". Read §7 before you start.

---

## What changed since the design (read this first)

The design said "any `authenticated` user = full access (`using(true)`)". The Codex round (CX-1) made it **stricter**: access requires the **admin claim** `app_metadata.role = 'admin'`, not bare `authenticated`. Net effect for you: a seeded admin works exactly the same; a *stray self-signup* (authenticated but no claim) gets **nothing**. Three things enforce the same claim, in lockstep — if you change one, change all three:

| Layer | File | Gate |
|---|---|---|
| Edge/proxy | `src/proxy.ts` (`isAdminUser`) | `app_metadata.role === 'admin'` |
| API routes | `src/lib/supabase-server.ts` (`requireUser`) | same, via `isAdminUser` |
| Database | `sql/013_rls_lockdown.sql` | `(auth.jwt() #>> '{app_metadata,role}') = 'admin'` |

Also: the middleware lives at **`src/proxy.ts`** (Next 16 rename — a root `middleware.ts` is silently ignored with this `src/app` layout).

---

## 0. Pre-flight (no live impact — do these first, any time)

- [ ] **Vercel production env vars set** (Project → Settings → Environment Variables, Production):
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY` ← **mandatory.** `createApiClient()` throws (lazily, on the first API route call — NOT at boot) if missing; with the proxy in front, an unauthenticated probe 401s before reaching it, so a missing key hides until an *authenticated* API call. See the authenticated smoke check in §3.
  - **App keys the code actually reads** (verified against `src/`): `ANTHROPIC_API_KEY` (chat LLM + verifier — `api/chat/route.ts`; **without it every `/api/chat` 500s**, breaking the whole RAG UAT path), `COHERE_API_KEY` (rerank), `GOOGLE_AI_API_KEY` (embeddings — `lib/rag/embeddings.ts`; `GEMINI_API_KEY` accepted as fallback). **Do NOT set `OPENAI_API_KEY`** — it is not used anywhere (the chat is Anthropic, not GPT-4o).
  - **VERIFY, don't just tick:** `vercel env ls production` and confirm `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `COHERE_API_KEY`, `GOOGLE_AI_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` are all present **in Production** (not only Preview).
- [ ] **Branch merged to `main`** and `main` builds clean (`npm run build` → `ƒ Proxy (Middleware)` present; 59 tests green; lint clean).
- [ ] **`013` MUST be re-proven via the §6 dry-run in THIS session, immediately before §4** — not just trusted from a prior run. The dry-run now also tests **function EXECUTE as `service_role`** and **SELECT/INSERT on every browser-page object as the admin claim** (see §6). The old `CLAIMTEST anon=-1 auth_noclaim=0 auth_admin=5498` only tested table reads as authenticated/anon — it could NOT catch the service_role-EXECUTE class of bug.
- [ ] **Local `.env.local` has `SUPABASE_SERVICE_ROLE_KEY`** (needed to run `seed-admins`). NB: the repo `.env.local` historically named this key `service_role_secret`; the canonical `SUPABASE_SERVICE_ROLE_KEY` (what `seed-admins.ts` and `supabase-server.ts` read) is now also present. If yours only has `service_role_secret`, add the `SUPABASE_SERVICE_ROLE_KEY` line (same value) or pass it inline: `SUPABASE_SERVICE_ROLE_KEY=… npx tsx scripts/seed-admins.ts …`.
- [ ] **Pick a quiet window.** Confirm no other agent/session is mid-write on the shared DB.

---

## 1. Disable public signups (Supabase dashboard)

Belt-and-suspenders with the code (`signInWithOtp({ shouldCreateUser: false })`). The dashboard switch is the project-level guarantee.

- [ ] Dashboard → **Authentication → Sign In / Providers → Email** → turn **OFF** "Allow new users to sign up" (and confirmations as you prefer; magic-link still works for existing users).
- [ ] (If present) disable any other enabled provider you don't intend to use.

Seeding (next step) uses the **admin API**, which bypasses this switch — so order is safe.

---

## 2. Seed the admins

Creates the admin accounts with the `app_metadata.role = 'admin'` claim and `email_confirm: true`, prints one-time temp passwords.

```bash
cd gemswell-mis-app
# Pass ALL admin emails explicitly. Seed AT LEAST TWO (one is your break-glass account):
# there is no password-reset UI (§8 defers it), so a single admin + a typo = permanent lockout.
npx tsx scripts/seed-admins.ts you@example.com second.admin@example.com tester1@example.com …
```

- [ ] **Seed ≥2 admins** (break-glass). **Capture the printed temp passwords** (shown once). Each admin can log in by password or request a magic link.
- [ ] Sanity check in dashboard → Authentication → Users: **each** user exists, **Confirmed**, and `app_metadata` shows `role: admin` (click the user → Raw app metadata). Verify the magic-link/SMTP email path actually delivers for at least one admin (it's the only recovery path).

> If you re-run and an email already exists, `createUser` errors for that one and continues — safe to re-run for new emails.

---

## 3. Deploy the auth-enabled app

- [ ] Push `main` (Vercel auto-deploys). **This is the one push** — dev sessions intentionally never pushed.
- [ ] Wait for the deployment to go **Ready**.
- [ ] Smoke test the live URL **before** locking the DB:
  - Logged-out → any page redirects to `/login`; `GET /api/intel/stats` returns **401 JSON** (not HTML).
  - Log in as a seeded admin (password) → dashboards load.
  - **Authenticated API check (catches a missing `SUPABASE_SERVICE_ROLE_KEY` in prod):** while logged in, `GET /api/intel/stats` (or `/api/knowledge/corpus/health`) must return **200 JSON with data**, not 500. This is the first call that exercises `createApiClient()` with the real prod env — a 500 here means the service-role key is missing/wrong; **fix it before §4**, do not lock the DB.
  - (Optional) magic-link → email arrives → `/auth/callback` → logged in.
  - **Keep a second seeded admin logged in on a separate browser** as a live fallback session through the flip.

At this point RLS is **still `open_all`** (anon can still read the DB directly via PostgREST). The proxy hides the UI, but the corpus is not yet DB-locked. **Run the §6 dry-run now (mandatory), then proceed to §4 promptly** to close that window.

---

## 4. Apply the RLS lockdown (`013`) — the flip

Run `sql/013_rls_lockdown.sql` against the **live** DB. Two ways:

**A — Supabase SQL Editor (simplest):** paste the full contents of `sql/013_rls_lockdown.sql`, run. It is one script with three `DO`/grant blocks (tables → views → functions).

**B — MCP `apply_migration`** (name it `013_rls_lockdown`) with the same SQL.

What it does (recap): for every public **table** → enable RLS + single policy `<t>_admin_all` gating on the admin claim + revoke anon; every **view** → `security_invoker = true` + revoke anon (so views honor the table RLS instead of bypassing it — R2-F1); every **function** → revoke EXECUTE from `anon` **and** `public` (CX-2) + default-privileges revoke, then grant back only the two read RPCs (`match_chunks`, `keyword_search_chunks`) to `authenticated`.

- [ ] Script runs with no error (it is idempotent on policies — it drops existing per-table policies first).

---

## 5. Verify (do all of these)

**5a. Admin can read (the app works).** In the live, logged-in app: open `/portfolio`, `/funding`, `/chat` (ask a question — RAG hits `match_chunks`). All return data.

**5b. Anon is denied — tables AND views AND functions.** From a shell (anon key is the public `NEXT_PUBLIC_SUPABASE_ANON_KEY`):

```bash
SUPA_URL="https://nqxhsjkcvfxygiajdxki.supabase.co"
ANON="<NEXT_PUBLIC_SUPABASE_ANON_KEY>"
# table → expect 0 rows / permission error, NOT data:
curl -s "$SUPA_URL/rest/v1/rag_documents?select=id&limit=1" -H "apikey: $ANON" -H "Authorization: Bearer $ANON"
# a view → expect the same (this is the R2-F1 regression guard). These two are real public views
# (verified anon-readable PRE-cutover) — both must flip to denied/empty POST-cutover:
curl -s "$SUPA_URL/rest/v1/v_intel_candidate_pipeline?select=*&limit=1" -H "apikey: $ANON" -H "Authorization: Bearer $ANON"
curl -s "$SUPA_URL/rest/v1/v_intel_contradictions_open?select=*&limit=1" -H "apikey: $ANON" -H "Authorization: Bearer $ANON"
# a read RPC → expect denied for anon:
curl -s -X POST "$SUPA_URL/rest/v1/rpc/keyword_search_chunks" -H "apikey: $ANON" -H "Authorization: Bearer $ANON" -H "Content-Type: application/json" -d '{"search_query":"madrid","filter_project":null,"match_count":5,"filter_doc_type":null}'
```

Each must return `[]` or a permission/`42501` error — **never** corpus rows. (List your views with the dashboard or `select relname from pg_class join pg_namespace n on n.oid=relnamespace where nspname='public' and relkind='v';`.)

**5c. Corpus intact (you didn't delete anything).** In the SQL editor (service-role):

```sql
select (select count(*) from rag_documents) as docs,
       (select count(*) from rag_chunks)    as chunks;
-- expect ≈ docs=5498, chunks=156898 (governance/audit baseline)
```

**5d. Every table has exactly one admin policy, none left open.**

```sql
select count(*) from pg_policies where schemaname='public' and policyname not like '%_admin_all';
-- expect 0  (no leftover open_all)
select count(*) from pg_tables t where schemaname='public'
  and not exists (select 1 from pg_policies p where p.schemaname='public' and p.tablename=t.tablename);
-- expect 0  (every table has a policy)
```

- [ ] 5a pass · [ ] 5b pass (table+view+rpc) · [ ] 5c pass · [ ] 5d pass

---

## 6. Dry-run the flip before doing it for real (MANDATORY, immediately before §4)

Re-prove `013` against live **without persisting** by wrapping it in a transaction and rolling back. Paste the **body** of `sql/013_rls_lockdown.sql` (the three `do`/grant blocks) **WITHOUT its own `begin`/`commit`** — the wrapper below provides the transaction. This must cover three things the old probe missed: **service_role function EXECUTE**, and **admin SELECT + INSERT on the browser-direct objects**.

```sql
begin;
  -- paste sql/013 body here (DO §1, DO §2, the revokes + grants of §3) — NOT its begin/commit

  -- (a) the original table probe
  set local role authenticated;
  set local request.jwt.claims = '{"app_metadata":{"role":"admin"}}';
  select count(*) as auth_admin from rag_documents;     -- expect 5498
  set local request.jwt.claims = '{"app_metadata":{"role":"user"}}';
  select count(*) as auth_noclaim from rag_documents;   -- expect 0
  reset role;
  set local role anon;
  select count(*) as anon from rag_documents;           -- expect 0 / permission error
  reset role;

  -- (b) SERVICE_ROLE function EXECUTE — the class of bug the old probe could NOT catch.
  -- The chat route calls these as service_role; without the service_role grant they 42501.
  set local role service_role;
  select count(*) as kw_ok  from keyword_search_chunks('madrid', null, 5, null);            -- expect a number, NO 42501
  select count(*) as vec_ok from match_chunks((select embedding from rag_chunks limit 1), 5, null, null, 0.18); -- expect a number, NO 42501
  reset role;

  -- (c) admin SELECT + INSERT on every object the browser pages hit directly (anon key + admin JWT).
  -- All must return rows / succeed for the admin claim; if any 42501s, that page breaks post-cutover.
  set local role authenticated;
  set local request.jwt.claims = '{"app_metadata":{"role":"admin"}}';
  select 'dim_project' t, count(*) from dim_project
   union all select 'fct_task_snapshot', count(*) from fct_task_snapshot
   union all select 'fct_capex_snapshot', count(*) from fct_capex_snapshot
   union all select 'fct_funding_snapshot', count(*) from fct_funding_snapshot
   union all select 'fct_cash_13w', count(*) from fct_cash_13w
   union all select 'fct_risk_snapshot', count(*) from fct_risk_snapshot
   union all select 'fct_action_snapshot', count(*) from fct_action_snapshot
   union all select 'fct_decision_log', count(*) from fct_decision_log
   union all select 'fct_pricing_slot', count(*) from fct_pricing_slot
   union all select 'fct_commercial', count(*) from fct_commercial
   union all select 'fct_readiness', count(*) from fct_readiness
   union all select 'rpt_pack', count(*) from rpt_pack;   -- every row count > 0 (or ≥0 without error)
  -- the /risks page writes directly; prove admin INSERT passes WITH CHECK:
  insert into fct_risk_snapshot (project_id, risk_title, severity_score, status_code)
    values ('MAD','__dryrun__',1,'IP');                    -- expect success, not 42501
  reset role;

  -- (d) confirm 013 only touched public tables (no extension tables like spatial_ref_sys got RLS):
  select tablename from pg_tables where schemaname='public'
    and tablename in ('spatial_ref_sys');                  -- expect 0 rows; if present, exclude from §1
rollback;  -- nothing persisted (incl. the dry INSERT)
```

Every assertion must pass **in the same transaction** before you apply `013` for real. A `42501` on (b) means the `service_role` grant is missing; a `42501` on (c) means a browser page would break. Adjust object names to match your live schema (some `fct_*` names vary).

---

## 7. Rollback (if §5 fails and you must reopen fast)

`013` dropped the old `open_all` policies; reverting = recreate permissive access. **Fastest safe revert** (reopens to anon — corpus world-readable again, i.e. pre-C1 state):

```sql
-- Reopen every table to anon+authenticated (UNDO of 013 section 1):
do $$ declare t record; begin
  for t in select tablename from pg_tables where schemaname='public' loop
    execute format('drop policy if exists %I on public.%I', t.tablename||'_admin_all', t.tablename);
    execute format('create policy %I on public.%I for all to public using (true) with check (true)',
                   t.tablename||'_open_all', t.tablename);
    execute format('grant all on public.%I to anon', t.tablename);
  end loop; end $$;
-- Reopen views + functions:
do $$ declare v record; begin
  for v in select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
           where n.nspname='public' and c.relkind in ('v','m') loop
    execute format('grant select on public.%I to anon', v.relname);
  end loop; end $$;
-- Re-grant EXECUTE ONLY on the two read RPCs (NOT `all functions` — that would re-expose the
-- SECURITY DEFINER write RPCs apply_document_governance / knowledge_corpus_health to anon):
grant execute on function public.match_chunks(vector, integer, text, text, double precision) to anon, authenticated, service_role;
grant execute on function public.keyword_search_chunks(text, text, integer, text) to anon, authenticated, service_role;
```

> This reopens the corpus to anon (pre-C1 state). **Prefer fixing forward** — e.g. if the only failure was the `service_role` EXECUTE grant, just run the two `grant … to service_role` statements from `013` §3 rather than rolling back the whole lockdown and re-exposing everything.

Then redeploy the previous (pre-auth) commit if the app itself is the problem. **Prefer fixing forward** (e.g. a missing grant) over full rollback — full rollback re-exposes the corpus.

---

## 8. Post-cutover

- [ ] Each admin changes their temp password (or just uses magic-link going forward).
- [ ] Note the cutover date + who was seeded in the project memory / handoff.
- [ ] (Future, out of scope for C1) password-reset UI, roles (viewer vs admin), invitation UI — Supabase covers reset by email for now.

---

### One-screen cheat sheet

```
0. pre-flight: Vercel env (incl. SERVICE_ROLE_KEY), main builds, 013 proven, quiet window
1. dashboard: disable signups
2. npx tsx scripts/seed-admins.ts <emails>   → save temp passwords
3. push main → wait Ready → smoke test (logged-out=401/redirect, admin login works)
4. run sql/013_rls_lockdown.sql on live DB        ← the flip (minimize gap after step 3)
5. verify: admin reads OK · anon denied on table+view+rpc · docs=5498/chunks=156898 · 0 open policies
   rollback only if needed (§7) — it re-exposes the corpus
```
