# Prompt de arranque — Revisión total + saneo + cutover C1 + UAT con humanos

> Pega el bloque de abajo como **primer mensaje** de una conversación nueva de Claude Code,
> con el cwd en `gemswell-mis-app`. Está escrito para un Claude sin contexto de la sesión anterior.

---

Retomamos Gemswell. Esta sesión tiene un objetivo claro: **dejar la aplicación entera lista para un test profundo con humanos (UAT)** — revisión total end-to-end de las 4 capas, saneo pragmático, **ejecutar el cutover de C1 (auth + RLS)** para que los testers entren con login real, y producir los entregables de UAT.

## 0. Re-oriéntate primero (no asumas nada — verifica)
Antes de tocar nada, lee y luego comprueba contra el estado vivo:
1. `MEMORY.md` (se carga solo) y, en `…/memory/`: `handoff_2026-06-05.md` (START HERE), `project_subproject_{a,b,c}_done_2026-06.md`, `project_subproject_c1_done_2026-06.md`, `audit_chat_documental_2026-06.md`, y los `feedback_*`.
2. En el repo: `CLAUDE.md` + `AGENTS.md` (⚠️ **este Next.js NO es el que conoces** — Next 16: el middleware se llama `proxy` y vive en `src/proxy.ts`; lee `node_modules/next/dist/docs/` antes de tocar APIs de Next). Y los outcomes en `docs/superpowers/specs/*-outcome.md` + el **runbook** `docs/superpowers/specs/2026-06-06-auth-rls-C1-cutover-runbook.md`.
3. Verifica el estado real: `git log --oneline -5`, `git status`, y la DB Supabase `nqxhsjkcvfxygiajdxki` (migraciones aplicadas, conteos del corpus). **No te fíes de los números de memoria sin confirmarlos.**

**Estado esperado (confírmalo):** A+B+C+C1 están construidos y mergeados a `main` local (HEAD ~`9db6a0f`, **NO pusheado**, ~68 commits por delante de origin). Migraciones aplicadas **hasta la 012**; la **013 (RLS lockdown) está escrita pero NO aplicada** → el corpus de la DB viva sigue **anon-abierto / world-readable** hasta que se ejecute el cutover. Corpus ~5498 docs / 156898 chunks. Stack: Next 16 + Supabase + RAG (Cohere rerank + embeddings). El auth (proxy + /login + guards + admin-claim) está en el código pero **dormido** (la RLS no está flipada).

## 1. Misión y fases
Trabaja con **QA pragmático** como modo por defecto (saneo + smoke tests + entregables de UAT). NO montes el enjambre adversarial pesado de A/B/C — resérvalo solo si en el cutover (auth/RLS, frontera de confianza) encuentras algo gordo; ahí basta una mini-revisión (1 reviewer + un pase Codex), no 3+ opus.

**Fase A — Inventario + revisión end-to-end (las 4 capas).** Mapea todas las superficies que un humano tocará: Capa 1 (corpus/gobernanza, ingesta), Capa 2 (`/api/chat`, retrieval/ranking, `/chat`), Capa 3 (extracción: `/admin/review`, `/admin/packs`, `intel_*`), Capa 4 (reporting: dashboard CEO, `/portfolio`, `/funding`, `/pricing`, `/commercial`, `/risks`, `/critical-path`, `/ops-readiness`, `/fnb-readiness`, `/project/[id]`, `/decisions`, `/bp-budget`) + admin (`/admin/documents`, `/admin/ingest`). Para cada una: ¿carga?, ¿maneja loading/empty/error?, ¿qué datos muestra?, ¿hay placeholders/hardcodes/TODOs reales?

**Fase B — Saneo.** Arregla en el momento lo barato; lista lo caro. Busca específicamente:
- **Coherencia post-auth:** ahora TODO redirige a `/login` y `/api/*` devuelve 401. ¿Las páginas cliente (`'use client'` + `fetch`) manejan el 401 con elegancia (no pantalla en blanco)? ¿Logout, password y magic-link funcionan? ¿El `redirect` saneado?
- **Inconsistencias entre capas:** lifecycles de estado (`rpt_pack`, `intel_metric_candidate`), naming, claves (`pack_id` no `id`, `delta_abs` generada, FKs de funding/contradiction — ver CLAUDE.md), datos que no cuadran entre dashboards y corpus.
- **Dead code / endpoints huérfanos / TODO-FIXME reales / dependencias sin usar.**
- **UX rough edges:** estados vacíos, spinners colgados, mensajes de error crípticos, números sin formato (`formatCompact`).
- **Documentación vs realidad:** que specs/outcomes/memory reflejen el código actual; corrige lo que haya quedado desfasado.
Mantén TODA escritura en la DB viva **self-cleaning** (bloques `DO … RAISE/ROLLBACK`); inspecciona `pg_proc`/`information_schema` antes de cualquier DDL (la DB es compartida). Commitea libremente (pre-producción) pero **no hagas push fuera del cutover de la Fase C**.

**Fase C — Cutover de C1 (evento coordinado, con confirmación humana).** Esto toca producción y la DB viva compartida y es difícil de revertir → **antes de flipar, confirma conmigo la ventana** y ejecuta paso a paso verificando cada uno, siguiendo el runbook `2026-06-06-auth-rls-C1-cutover-runbook.md`:
1. Pre-flight: env de Vercel prod (incl. **`SUPABASE_SERVICE_ROLE_KEY`** — `createApiClient` revienta en prod sin él); `main` compila (`ƒ Proxy (Middleware)` presente), tests verdes.
2. Desactiva signups en el dashboard de Supabase.
3. `npx tsx scripts/seed-admins.ts <emails-de-los-testers>` — **importante:** el modelo es admin-only sin roles, así que **cada tester humano necesita una cuenta sembrada con `app_metadata.role='admin'`**. Guarda las contraseñas temporales.
4. Push `main` → deploy en Vercel → smoke test (deslogueado=redirect/401, admin logueado=ok).
5. Aplica `sql/013_rls_lockdown.sql` a la DB viva. (Opcional pero recomendado: primero el dry-run `begin … rollback` del runbook §6.)
6. Verifica: admin lee; **anon denegado en tablas Y vistas Y rpc**; corpus íntegro (5498/156898); 0 políticas `open_all` restantes. Si algo falla, §7 (rollback re-expone el corpus → prioriza arreglar hacia delante).

**Fase D — Preparar el UAT con humanos.** Entrega, en `docs/superpowers/` (o donde prefieras):
- **Plan de pruebas por capa**: escenarios concretos (qué hacer, con qué datos, resultado esperado), incluyendo el camino crítico del negocio (login → chat documental con citas de fuente → revisar un dashboard → gobernar un documento en `/admin/documents`).
- **Cuentas de tester** sembradas + cómo entrar (password y magic-link).
- **Guía paso a paso para no-técnicos** (1 página): cómo acceder, qué probar, qué NO es un bug.
- **Checklist de smoke test post-deploy** (canary) y un **mecanismo de reporte de bugs** (plantilla: pasos, esperado, observado, captura).
- **Lista de known-issues / fuera de alcance** (p.ej. sin roles viewer, sin UI de reset de password, MAD capex contradiction abierta) para que no reporten lo ya conocido.

**Fase E — Finalizar.** Gate final (test/lint/build) + actualiza `MEMORY.md` y el handoff (cutover hecho/estado UAT). Resume qué se saneó, qué quedó como known-issue, y el estado real de seguridad del corpus tras el cutover.

## 2. Reglas
- **Confirma conmigo antes del flip de la Fase C** (push + 013): es irreversible-ish, outward-facing y toca la DB compartida. El resto trabájalo de forma autónoma.
- Reporta con fidelidad: si un test falla, dilo con el output; si algo queda a medias, dilo.
- No re-derives A/B/C/C1 (hechos+mergeados), no repitas backfills (corpus completo, 0 null fts), no reedites sus findings ya cerrados (A F1-8/CX1-5, B F1-15/CX-B1-7, C R1/R2/R3, C1 R2-F1/CX1-4).
- Si necesitas Codex: `codex exec … -c 'mcp_servers={}' -c model_reasoning_effort="medium" < /dev/null`.

Empieza por la Fase 0 (re-orientación + verificación del estado vivo) y luego propón un plan corto antes de ejecutar el saneo.
