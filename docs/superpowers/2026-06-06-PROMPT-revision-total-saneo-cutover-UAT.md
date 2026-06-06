# Prompt de arranque (modo ULTRACODE) — Revisión total + saneo + cutover C1 + UAT

> Pega el bloque de abajo como **primer mensaje** de una conversación nueva de Claude Code,
> con el cwd en `gemswell-mis-app`. Empieza con la palabra clave `ultracode`, que activa la
> orquestación multi-agente (workflows). Está escrito para un Claude sin contexto previo.
> ⚠️ Ultracode consume muchos tokens (puede lanzar docenas de subagentes) — es intencionado.

---

ultracode — Retomamos Gemswell. Trabaja en **modo de máximo esfuerzo con orquestación multi-agente**: para cada fase sustantiva diseña y lanza un **workflow** (fan-out de subagentes en paralelo, **verificación adversarial** de cada hallazgo, **completeness-critic** y **loop-until-dry**), uno por fase, parándote entre ellos para mantenerte en el loop. El coste de tokens **no es una restricción**; prioriza la respuesta más exhaustiva y correcta. La única excepción al modo autónomo es el **cutover (Fase C): confírmamelo antes de flipar** (toca prod + la DB viva compartida y es difícil de revertir).

**Objetivo:** dejar la aplicación entera lista para un **test profundo con humanos (UAT)** — revisión total end-to-end de las 4 capas, saneo, ejecutar el **cutover de C1 (auth + RLS)** para que los testers entren con login real, y producir los entregables de UAT.

## 0. Re-oriéntate primero (no asumas nada — verifica)
Antes de tocar nada, lee y luego comprueba contra el estado vivo:
1. `MEMORY.md` (se carga solo) y, en `…/memory/`: `handoff_2026-06-05.md` (START HERE), `project_subproject_{a,b,c}_done_2026-06.md`, `project_subproject_c1_done_2026-06.md`, `audit_chat_documental_2026-06.md`, y los `feedback_*`.
2. En el repo: `CLAUDE.md` + `AGENTS.md` (⚠️ **este Next.js NO es el que conoces** — Next 16: el middleware se llama `proxy` y vive en `src/proxy.ts`; lee `node_modules/next/dist/docs/` antes de tocar APIs de Next). Y los outcomes en `docs/superpowers/specs/*-outcome.md` + el **runbook** `docs/superpowers/specs/2026-06-06-auth-rls-C1-cutover-runbook.md`.
3. Verifica el estado real: `git log --oneline -5`, `git status`, y la DB Supabase `nqxhsjkcvfxygiajdxki` (migraciones aplicadas, conteos del corpus). **No te fíes de los números de memoria sin confirmarlos.**

**Estado esperado (confírmalo):** A+B+C+C1 construidos y mergeados a `main` local (HEAD ~`9db6a0f`, **NO pusheado**, ~68 commits por delante de origin). Migraciones aplicadas **hasta la 012**; la **013 (RLS lockdown) está escrita pero NO aplicada** → el corpus de la DB viva sigue **anon-abierto / world-readable** hasta el cutover. Corpus ~5498 docs / 156898 chunks. Stack: Next 16 + Supabase + RAG (Cohere rerank + embeddings). El auth (proxy + /login + guards + admin-claim) está en el código pero **dormido** (la RLS no está flipada).

## 1. Plan de workflows (uno por fase)
Lanza una **secuencia de workflows**, leyendo el resultado de cada uno antes de decidir el siguiente. Escala el número de agentes a la amplitud real (las ~22 páginas + ~10 rutas API + 4 capas justifican fan-out amplio).

**Fase A — Understand (workflow: multi-modal sweep).** Fan-out de un lector por capa/superficie en paralelo → mapa estructurado. Capa 1 (corpus/gobernanza, ingesta), Capa 2 (`/api/chat`, retrieval/ranking, `/chat`), Capa 3 (extracción: `/admin/review`, `/admin/packs`, `intel_*`), Capa 4 (reporting: dashboard CEO, `/portfolio`, `/funding`, `/pricing`, `/commercial`, `/risks`, `/critical-path`, `/ops-readiness`, `/fnb-readiness`, `/project/[id]`, `/decisions`, `/bp-budget`) + admin (`/admin/documents`, `/admin/ingest`). Cada agente reporta: ¿carga?, ¿maneja loading/empty/error?, ¿qué datos muestra?, ¿placeholders/hardcodes/TODOs?

**Fase B — Review + saneo (workflow: dimensiones → find → adversarial-verify → fix → loop-until-dry).** Un finder por dimensión, en paralelo; cada hallazgo lo **verifican ≥2 revisores que intenten refutarlo** (descártalo si la mayoría lo refuta) antes de arreglarlo; cierra con un **completeness-critic** y repite rondas **hasta 2 secas**. Dimensiones:
- **Coherencia post-auth:** ahora TODO redirige a `/login` y `/api/*` devuelve 401. ¿Las páginas cliente (`'use client'` + `fetch`) manejan el 401 con elegancia (no pantalla en blanco)? ¿Logout, password y magic-link funcionan? ¿`redirect` saneado?
- **Inconsistencias entre capas:** lifecycles (`rpt_pack`, `intel_metric_candidate`), naming, claves (`pack_id` no `id`, `delta_abs` generada, FKs de funding/contradiction — ver CLAUDE.md), datos que no cuadran entre dashboards y corpus.
- **Dead code / endpoints huérfanos / TODO-FIXME reales / deps sin usar.**
- **UX rough edges:** estados vacíos, spinners colgados, errores crípticos, números sin formato (`formatCompact`).
- **Documentación vs realidad:** que specs/outcomes/memory reflejen el código; corrige lo desfasado.
Arregla lo confirmado en el momento; lista lo caro. Mantén TODA escritura en la DB viva **self-cleaning** (`DO … RAISE/ROLLBACK`); inspecciona `pg_proc`/`information_schema` antes de cualquier DDL (DB compartida). Commitea libremente; **no hagas push fuera del cutover**.

**Fase C — Cutover de C1 (mini-workflow de pre-flight, luego flip MANUAL con confirmación).** Primero un workflow corto que revisa adversarialmente el pre-flight + el runbook + un **dry-run `begin…rollback` de `013`** (probar anon=denegado en tablas/vistas/rpc, admin=5498, sin persistir). **Luego confírmame la ventana** y ejecuta el flip paso a paso (esto NO se paraleliza), siguiendo `2026-06-06-auth-rls-C1-cutover-runbook.md`:
1. Pre-flight: env de Vercel prod (incl. **`SUPABASE_SERVICE_ROLE_KEY`** — `createApiClient` revienta en prod sin él); `main` compila (`ƒ Proxy (Middleware)` presente), tests verdes.
2. Desactiva signups en el dashboard de Supabase.
3. `npx tsx scripts/seed-admins.ts <emails-de-los-testers>` — el modelo es **admin-only sin roles**, así que **cada tester humano necesita una cuenta sembrada con `app_metadata.role='admin'`**. Guarda las contraseñas temporales.
4. Push `main` → deploy en Vercel → smoke test (deslogueado=redirect/401, admin logueado=ok).
5. Aplica `sql/013_rls_lockdown.sql` a la DB viva.
6. Verifica: admin lee; **anon denegado en tablas Y vistas Y rpc**; corpus íntegro (5498/156898); 0 políticas `open_all` restantes. Si algo falla, §7 (rollback re-expone el corpus → prioriza arreglar hacia delante).

**Fase D — UAT (workflow: generación paralela + completeness-critic).** Genera en paralelo y luego un crítico verifica que cubren el **camino crítico del negocio** (login → chat documental con citas de fuente → revisar un dashboard → gobernar un documento en `/admin/documents`). Entregables en `docs/superpowers/`:
- **Plan de pruebas por capa**: escenarios concretos (qué hacer, datos, resultado esperado).
- **Cuentas de tester** sembradas + cómo entrar (password y magic-link).
- **Guía paso a paso para no-técnicos** (1 página).
- **Checklist de smoke test post-deploy** (canary) + **plantilla de reporte de bugs** (pasos, esperado, observado, captura).
- **Known-issues / fuera de alcance** (sin roles viewer, sin UI de reset de password, MAD capex contradiction abierta) para que no reporten lo ya conocido.

**Fase E — Finalizar.** Gate final (test/lint/build) + actualiza `MEMORY.md` y el handoff (cutover hecho/estado UAT). Resume qué se saneó, qué quedó como known-issue, y el estado real de seguridad del corpus tras el cutover.

## 2. Reglas
- **Confirma antes del flip (Fase C).** El resto, autónomo y exhaustivo en modo ultracode.
- **Lee el resultado de cada workflow antes de lanzar el siguiente** — tú orquestas, los subagentes ejecutan.
- Reporta con fidelidad: si un test falla, dilo con el output; si algo queda a medias, dilo.
- No re-derives A/B/C/C1 (hechos+mergeados), no repitas backfills (corpus completo, 0 null fts), no reedites findings ya cerrados (A F1-8/CX1-5, B F1-15/CX-B1-7, C R1/R2/R3, C1 R2-F1/CX1-4).
- Si necesitas Codex: `codex exec … -c 'mcp_servers={}' -c model_reasoning_effort="medium" < /dev/null`.

Empieza por la Fase 0 (re-orientación + verificación del estado vivo) y propón el plan de workflows antes de lanzar el primero.
