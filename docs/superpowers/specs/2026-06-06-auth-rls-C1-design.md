# Spec C1 — Supabase Auth + RLS Lockdown (design)

Fecha: 2026-06-06
Estado: aprobado para escribir plan (delegación autónoma del usuario)
Origen: audit risk **C1** (`audit_chat_documental_2026-06`) — "RLS = open_all USING(true); anon key is NEXT_PUBLIC; no auth/middleware; entire confidential financial corpus world-readable. Risk #1." The pre-publication blocker after A+B+C.
Builds on: A+B+C (all merged to local `main`, HEAD `d518e38`).

## 0. Decisiones (usuario, 2026-06-06)
- **Login: ambos** — email+password (primario) + magic-link (recuperación/alternativa).
- **Usuarios: pocos admins con acceso igual** — sembrar 2-3 usuarios, todos acceso total, **sin roles**, sin UI de invitación.
- **Modelo: single-tenant** — cualquier usuario autenticado = acceso total; `anon` = denegado. (Es una empresa, un corpus; no hay aislamiento por-fila/multi-tenant.)

## 1. Estado verificado (BD `nqxhsjkcvfxygiajdxki` + código, 2026-06-06)
- `auth.users` = **0**. NO existe `middleware.ts`, ni `/login`, ni rutas `/auth/*`. `createServerSupabase` (cookie-aware) existe pero **no se usa**.
- **59 tablas públicas** con política `USING(true)` (`to public` → incluye anon) — anon puede todo. `@supabase/ssr ^0.10.2` instalado.
- **10 rutas `/api/*`** usan `createApiClient()` (service-role, salta RLS), sin auth.
- **~10 páginas de UI consultan Supabase directamente desde el navegador** (`createClient` = `createBrowserClient`, cookie-aware): `/`, portfolio, risks, pricing, commercial, ops-readiness, fnb-readiness, critical-path, project/[id], ProjectSelector. El resto (chat, gestor, admin) va por `/api/*`.

**Implicación clave:** `createBrowserClient` usa la cookie de sesión. Tras login, las lecturas directas del navegador corren como `authenticated` → la RLS `authenticated=full` las permite. Anon (sin login) lo bloquea el middleware (redirect a /login) y la RLS.

## 2. Arquitectura
Unidades con frontera limpia:
- **`middleware.ts`** (raíz) — patrón `@supabase/ssr`: refresca la cookie de sesión en cada request y **redirige a `/login`** si no hay usuario. Matcher excluye `/login`, `/auth/(.*)`, `/_next/(.*)`, assets estáticos, favicon. (Next.js 16: leer `node_modules/next/dist/docs` para la firma de middleware antes de escribir.)
- **`src/app/login/page.tsx`** (cliente) — formulario email+password (`signInWithPassword`) + botón "enviar magic link" (`signInWithOtp`, `emailRedirectTo=/auth/callback`). Estados de error/carga; `sonner` toasts.
- **`src/app/auth/callback/route.ts`** — intercambia el code del magic-link por sesión (`exchangeCodeForSession`) y redirige a `/`.
- **`src/app/auth/signout/route.ts`** (POST) — `signOut()` + redirect a `/login`. Botón "Cerrar sesión" en `Sidebar`.
- **`src/lib/supabase-server.ts`** — añadir `requireUser()`: `const { data:{ user } } = await createServerSupabase().auth.getUser(); return user`. Devuelve `null` si no hay sesión. (Usa `getUser()`, que valida el JWT contra Supabase, no `getSession()`.)
- **Guards de ruta** — al inicio de **cada** handler en `/api/*`: `const user = await requireUser(); if (!user) return NextResponse.json({error:'unauthorized'},{status:401})`. Luego el trabajo con `createApiClient()` (service-role) como hoy. (La sesión es el gate; el service-role hace el trabajo; la RLS bloquea el acceso directo anon — defensa en profundidad.)
- **RLS lockdown** `sql/013_rls_lockdown.sql` — por cada una de las 59 tablas: `drop policy <open_all>` y `create policy "<t>_authenticated_all" on public.<t> for all to authenticated using (true) with check (true)`. Generado dinámicamente (un `DO`/`format` sobre `pg_policies`) para no omitir ninguna. RPCs: `grant execute on match_chunks, keyword_search_chunks to authenticated` (por si hay rpc desde navegador); `apply_document_governance`, `knowledge_corpus_health` siguen **service_role-only** (solo las llaman rutas API). `ingest_queue` incluido.
- **Seed** `scripts/seed-admins.ts` — vía admin API (service-role): crea los 2-3 usuarios con `email_confirm=true` y password temporal (impreso una vez); pueden entrar por password o pedir magic-link. Parametrizable por email. Se ejecuta en cutover con emails reales (p.ej. `moises.menendez@gmail.com`).
- **Browser client** (`createClient`) — sin cambios (ya cookie-aware vía `@supabase/ssr`); funciona post-login.

## 3. Seguridad del cutover (CRÍTICO)
Aplicar RLS restrictiva a la BD viva **rompe inmediatamente** la app actual basada en anon (la desplegada en `origin/main` y el dev local). La BD es **compartida** con otras sesiones que usan anon. Por tanto:
- **Durante dev/build: NO se aplica `013` a `main` vivo.** El código de auth convive con `open_all` (logged-in = authenticated; open_all también deja pasar anon — estado actual).
- `013` se **escribe y se prueba** sin persistir: en una transacción `begin; <aplica políticas>; set local role anon; <select → debe fallar/0 filas>; set local role authenticated; <select → ok>; rollback;` (o en una Supabase branch). 
- **CUTOVER** (lo ejecuta el usuario al publicar, runbook): (1) `seed-admins` con emails reales, (2) push → deploy de la app con auth, (3) aplicar `013` (flip RLS), (4) verificar: login OK + lecturas autenticadas OK + anon denegado. Ventana breve entre (2) y (3) con RLS abierta — minimizar haciendo (3) justo tras (2).
- **No pushear** en esta sesión. C1 entrega el código de auth + `013` probada + runbook.

## 4. Manejo de errores
- Rutas: sin sesión → 401 (no 500). Errores de auth en login → toast claro, sin filtrar detalles.
- Middleware: fallo al refrescar sesión → tratar como no-autenticado (redirect a /login), nunca 500 silencioso que deje pasar.
- `exchangeCodeForSession` falla (link expirado) → /login con mensaje.
- RLS: si `013` se aplicara sin auth desplegada, la app rompe — por eso es cutover-only (no en dev).

## 5. Pruebas
1. `requireUser`: con cookie de sesión válida → user; sin cookie → null (mock del cliente).
2. Middleware: rutas públicas (`/login`, `/auth/callback`, estáticos) pasan; rutas privadas sin sesión → redirect a /login (probar el matcher/lógica).
3. Ruta API sin sesión → 401; con sesión → 200 (al menos una ruta, vía test o build+manual).
4. **RLS (vivo, rollback):** tras aplicar `013` en transacción: `set local role anon` → SELECT en `rag_documents`/`fct_*` → 0 filas/denegado; `set local role authenticated` → permitido; cada una de las 59 tablas tiene exactamente una política `to authenticated`. ROLLBACK. Corpus intacto.
5. `npm run build` compila (middleware + páginas auth + Next 16).

## 6. Fuera de alcance
- Roles/permisos (admin vs viewer) — todos los admins iguales.
- UI de invitación, SSO/OAuth, MFA, UI de reset de password (Supabase lo cubre por email; se puede añadir luego).
- Cambiar el patrón service-role de las rutas (se mantiene; el gate es la sesión + RLS).
