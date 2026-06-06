# Spec C1 — Supabase Auth + RLS Lockdown · Implementation & Adversarial-Hardening Outcome

Date: 2026-06-06
Branch: `agent/auth-rls-c1` (merge status below)
Spec: `2026-06-06-auth-rls-C1-design.md` · Plan: `../plans/2026-06-06-auth-rls-c1.md` · Runbook: `2026-06-06-auth-rls-C1-cutover-runbook.md`
Builds on: A + B + C, all merged to `main`. Closes audit risk **C1** — the last pre-publication blocker ("anon key is NEXT_PUBLIC; RLS = open_all USING(true); entire confidential corpus world-readable").

## What shipped (code complete; DB flip is cutover-only)
A complete authentication layer + a tested-but-unapplied RLS lockdown migration + a seed script + a cutover runbook. The DB is **deliberately not locked during dev** — applying `013` would instantly break the currently-anon app on the shared live DB. C1 delivers everything needed to flip at publication.

1. **Admin-claim gate, single source of truth** (`src/lib/is-admin.ts`, new + tested). `isAdminUser(user)` is true **only** for `app_metadata.role === 'admin'` — bare `authenticated` is not enough. Pure (no `next/headers`), so the proxy can import it. The proxy, `requireUser`, and the SQL RLS policy all gate on this exact claim.
2. **Session proxy** (`src/proxy.ts`). The canonical `@supabase/ssr` session-refresh, ported to the **Next 16 `proxy` API** (the `middleware`→`proxy` rename; with `src/app/`, the file MUST be `src/proxy.ts` — a root file is silently ignored, verified during build). Non-admins: `/api/*` → 401 JSON, pages → redirect to `/login?redirect=…`. Public paths: `/login`, `/auth/*`. Matcher excludes only Next internals + favicon (CX-3).
3. **Login** (`src/app/login/page.tsx`). Email+password (`signInWithPassword`) + magic-link (`signInWithOtp`, `shouldCreateUser:false` — magic-link must not create accounts). `redirect` param sanitized via `safeRedirectPath` (open-redirect/XSS guard). Suspense boundary for `useSearchParams`; full-screen overlay.
4. **Auth routes.** `src/app/auth/callback/route.ts` (`exchangeCodeForSession` → safe redirect); `src/app/auth/signout/route.ts` (POST, **same-origin check** → 403 on cross-site, blocks CSRF forced-logout).
5. **API guards.** Every `/api/*` handler starts with `if (!(await requireUser())) return 401`. `requireUser()` validates via `getUser()` (JWT-checked, not `getSession()`) and applies the admin claim. Service-role still does the work; the session is the gate; RLS is defense-in-depth.
6. **`createApiClient()` hardening.** Throws on boot in **production** if `SUPABASE_SERVICE_ROLE_KEY` is missing (no anon fallback — that fallback would silently 500 every route post-lockdown). Dev keeps the fallback with a warning.
7. **RLS lockdown** (`sql/013_rls_lockdown.sql`, **cutover-only, NOT applied**). Three sections, all dynamic so nothing is missed: **tables** → RLS on + single `<t>_admin_all` policy gating `(auth.jwt() #>> '{app_metadata,role}') = 'admin'` + revoke anon; **views (+matviews)** → `security_invoker=true` so they honor table RLS + revoke anon; **functions** → revoke EXECUTE from anon AND public + default-privileges revoke, grant back only `match_chunks`/`keyword_search_chunks` to authenticated.
8. **Seed** (`scripts/seed-admins.ts`, cutover-only). Service-role admin API; `createUser` with `email_confirm:true`, `app_metadata:{role:'admin'}`, crypto-strong temp password (`randomBytes`). Parametrizable by email.
9. **Logout** button wired in `Sidebar`.

## Review (ruflo swarm + Claude 2nd pass + Codex) — security-focused
**Round 1 — ruflo swarm (opus reviewers) + Claude 2nd pass.** Findings, all fixed + re-verified (commit `8e73e1d`):
- **R2-F1 (CRITICAL):** a table-only lockdown was **insufficient** — public views were `security_invoker=false` (run as owner → bypass RLS) and several functions were anon-EXECUTE-able, so the corpus stayed world-readable via PostgREST even with table RLS on. **Verified live**: anon read 10 rows through a view under a table-only probe. **Fixed:** added §2 (views → `security_invoker=true` + revoke anon) and §3 (functions revoke) to `013`; re-probed → anon 0 rows through views too.
- **R1-F1/F2 (HIGH):** open-redirect / XSS — `router.replace(params.get('redirect'))` and the callback redirect accepted attacker-controlled values (`//evil.com`, `javascript:`). **Fixed:** `src/lib/safe-redirect.ts` (`safeRedirectPath` — only same-site absolute paths; control-char loop, not a regex that wrongly rejected hyphens like `/bp-budget`) + tests; used in login + callback.

**Round 2 — Codex (`gpt-5.5`, medium reasoning).** Found 4 real issues the swarm missed — all fixed + re-verified (commit `b394603`):
- **CX-1 (HIGH):** the gate was bare `authenticated`, so a **self-signup** (if project signups were ever on) would get full corpus access. **Fixed:** admin-claim model end-to-end — new `is-admin.ts` SSOT; proxy + `requireUser` + RLS policy all require `app_metadata.role='admin'`; login `shouldCreateUser:false`; seed sets the claim; dashboard signups disabled at cutover (runbook §1).
- **CX-2 (HIGH):** `revoke execute … from anon` was a **no-op** — functions default EXECUTE to `PUBLIC`, not anon. **Fixed:** revoke from `anon, public` + `alter default privileges … revoke execute on functions from public`, then grant back the two read RPCs to authenticated.
- **CX-3 (MED):** proxy matcher excluded paths by file extension → a dynamic param like `/project/MAD.svg` would **bypass** the guard. **Fixed:** matcher excludes only `_next/static|_next/image|favicon.ico`.
- **CX-4 (MED):** signout POST had no origin check → cross-site **CSRF forced-logout**. **Fixed:** reject mismatched `Origin` with 403.

## Live verification (self-cleaning rollback probe — `013` never persisted)
Applied `013` inside `begin … rollback` against the live DB and tested all three principals:
- **`CLAIMTEST anon=-1 auth_noclaim=0 auth_admin=5498`** — anon denied (-1 = permission error sentinel), authenticated-without-admin-claim reads **0** (the CX-1 self-signup case), admin reads the full **5498**.
- Anon denied on **tables AND views** (R2-F1 regression guard); functions revoked.
- Corpus integrity throughout: **5498 docs / 156898 chunks**, 0 leftovers. ROLLBACK → nothing persisted; live DB still open_all (dev app keeps working).
- Gate: **59 vitest green**, lint clean, `npm run build` OK with **`ƒ Proxy (Middleware)`** present.

## Final state
- Code-complete auth layer on `agent/auth-rls-c1`; RLS migration written + proven but **not applied** (cutover-only by design — shared live DB).
- The audit's C1 risk is **resolved pending cutover**: the moment the runbook is executed (seed → deploy → apply `013` → verify), the corpus flips from world-readable to admin-only. Until then, dev/prod remain intentionally anon-open.

## Still out of scope (unchanged from spec §6)
- Roles (viewer vs admin), invitation UI, SSO/OAuth, MFA, password-reset UI (Supabase covers reset by email).
- C2 (hardcoded prompt facts) was already neutralized in C; no other audit blockers remain.

## Cutover
Not done in this session (no push — push auto-deploys). Follow `2026-06-06-auth-rls-C1-cutover-runbook.md` at publication.
