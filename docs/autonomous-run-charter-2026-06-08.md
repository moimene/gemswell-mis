# Charter de ejecución autónoma — Fases 3→8 (Gemswell MIS chat documental)

Fecha: 2026-06-08 · Modo: `/goal` + adversarial (doble ronda) + `ultracode`, sin supervisión humana durante horas.
Overlay de autonomía sobre el plan maestro. El QUÉ está en `docs/plan-saneamiento-chat-maxima-calidad-2026-06-07.md`
(fases §3, **ledger §2**, protocolo §4, north-star §0). Aquí se define el CÓMO ejecutarlo y aplicarlo a prod sin el usuario.

## Regla maestra
**Construye, verifica y aplica TODO de forma autónoma —incluida producción— pero ninguna mutación de prod ocurre sin
red de seguridad: branch-probe + SEGUNDA ronda adversarial (pre-prod) + rollback escrito + verificación en vivo con
AUTO-ROLLBACK si regresa.** Es un sistema financiero vivo: nada irreversible o de alto blast-radius sin que pueda
deshacerse solo en segundos. Si una red de seguridad no se puede montar para una acción concreta, esa acción NO se
ejecuta: se registra en el run log como "PENDIENTE USUARIO" y se sigue con el resto.

## Estado verificado 2026-06-08 (NO reconstruir — comprobado en git+BD)
- prod = origin/main = local main = `3e6cde5`. Fases 0,1,2 + Fase 3 chunking (WS2-T2 table-aware + WS2-T3
  clause/article-aware, en `src/lib/rag/embeddings.ts`) están desplegadas. Sólo afectan a ingests NUEVOS (legacy 156k intactos).
- BD viva `nqxhsjkcvfxygiajdxki`: `sql/019` aplicada (Gate-0 hecho, fuga superseded cerrada). Migración más alta en disco = 019.
  Ledger 020–028 preasignado en §2, SIN escribir. `src/lib/rag/ocr.ts` no existe (port OCR sin empezar).
- Admin de test para smoke-tests en vivo: `bot@gemswell.surf` / `test2026` (la app es admin-only por RLS).

## Modo adversarial — DOS rondas + gestión de Codex  ← núcleo de este run
Cada cambio pasa por DOS rondas adversariales independientes (paneles opus distintos, sin contexto compartido):
- **Ronda 1 — implementación (antes de commit):** N≥2 revisores opus en paralelo sobre el diff del incremento
  (corrección, colisión con ledger §2, ¿toca una RPC que no debe?, ¿tests suficientes?). Se commitea sólo si pasan.
- **Ronda 2 — PRE-PROD (antes de aplicar/desplegar/endorsar):** panel opus NUEVO, N≥3, re-examina la acción real contra
  prod: diff acumulado de la fase + migración + su rollback + DATOS VIVOS (queries reales) + blast radius + el plan de
  verificación-y-auto-rollback. Sólo tras Ronda 2 unánime "seguro" se toca prod.

**Codex = best-effort, NUNCA bloquea, SIEMPRE puede fallar** (cuelga 6h en estos bucles). Reglas:
- Invócalo UNA sola vez por ronda, no-interactivo, con timeout DURO ~10 min y MCP/stdin desactivados:
  `timeout 600 codex exec -c 'mcp_servers={}' -c model_reasoning_effort="medium" "<prompt>" < /dev/null`
  (`mcp_servers={}` + `</dev/null` evitan el cuelgue por MCP/stdin; no uses `--ignore-user-config`).
- Si cuelga / falla / timeoutea → mátalo, márcalo **fallback**, y **NO reintentes** (reintentar es lo que cuelga 6h).
- **Si Codex hace fallback, REFUERZA la Ronda 2:** +2 revisores opus extra (N≥5), exige consenso **UNÁNIME** (no mayoría)
  y añade una verificación extra con datos vivos. El opus es el motor primario; un Codex exitoso es señal adicional, no requisito.
- Opcional: usa la skill `codex:codex-cli-runtime` si gestiona mejor el time-box, con la misma política de no-reintento.

## Mutación autónoma de prod — orden + red de seguridad (obligatoria por acción)
Sí aplicas a prod, fase a fase, en el orden del ledger §2, SIEMPRE con esta red:
1. **Migración:** primero en **Supabase branch** → `EXPLAIN ANALYZE` vía cliente real supabase-js (no psql). Para la 023:
   index-served <100ms en MAD y KLP, keyword <1s. → Ronda 2 → apply a prod → **re-verifica en vivo la misma prueba** →
   si regresa (seq-scan / timeout / latencia fuera de umbral / filas inesperadas) → **auto-rollback** (`sql/rollback/NNN`),
   detén esa fase, anótalo, sigue con lo que no dependa de ella.
2. **Aditiva ANTES del código que la usa** (expand-migrate-contract). Las RPC son backward-compatible (cuerpo verbatim +
   columnas aditivas), así que aplica 023 y luego despliega el código que lee `chunk_index`/`page`/`storage_path`.
3. **Deploy:** merge a main + `git push` → **smoke-test en vivo** (login con el admin de test → el chat responde, una cita
   abre el PDF citado, sin error de retrieval) → si falla → **auto-rollback** (`git revert` + push, o redeploy del deployment
   anterior vía Vercel MCP).
4. **Endorse de los 797 (Fase 4):** script reversible; asserts de la distribución de gobernanza ANTES y DESPUÉS; si la
   distribución se mueve fuera de lo esperado, revierte. Prioriza por autoridad descendente.
5. **Registra CADA mutación de prod** en `docs/_AUTONOMOUS_RUN_LOG.md`: qué, cuándo, probe, verificación viva, y el comando
   exacto de rollback. Es el rastro que el usuario revisa al volver.

## Bucle por incremento (TDD + ultracode + doble ronda)
1. TDD Red→Green; tests en `src/lib/rag/__tests__/` (o el dir de la fase). Commitea cada incremento verde (no pierdas trabajo).
2. **ultracode:** Workflow con fan-out de las tareas independientes del work-stream; **Ronda 1 adversarial de cada cambio
   antes de commitear**; al cerrar la fase, **Ronda 2 antes de tocar prod**.
3. Mide contra `ws1-base` (`npm run eval:*`): el bucket documental no regresa; structured/abstain/ambiguous no caen.
4. Gates verdes antes de cerrar: `vitest`, `lint`, `tsc`, `next build`.
5. Al cerrar fase: merge a main, aplica prod con su red, y actualiza ledger §2 + `CLAUDE.md` + memoria `audit_chat_documental_2026-06-07.md`.

## Guardarraíles innegociables
- **ÚNICO-DUEÑO-DE-RPC** (derailer nº1 del red-team): SÓLO la migración **023** (Fase 5) recrea
  `match_chunks`/`keyword_search_chunks`; cuerpo **VERBATIM de `sql/019`** + columnas `chunk_index`+`page`+`storage_path`;
  **ninguna otra fase los toca**. Recrearlos en paralelo reabre la fuga superseded o flipa a seq-scan→timeout silencioso.
- En **Fase 3 NO toques las RPC**: `metadata.page` se estampa en el chunk al ingerir; `page`/`chunk_index` como columnas
  de RPC es Fase 5 (023).
- Ledger §2 es la única fuente de números de migración; nadie inventa números. Antes de tocar SQL, relee el cuerpo vivo de
  las RPC con `pg_get_functiondef` (puede haber sesiones concurrentes).
- Next 16 tiene breaking changes: lee `node_modules/next/dist/docs/` antes de tocar código de framework.

## Resto de Fase 3 (lo inmediato)
- **WS2-T4** page provenance: `metadata.page` partiendo por `page_separator` en chunking/parse (`embeddings.ts`/`parse.ts`).
- **WS2-T7/T8/T10** OCR Mistral: portar `mdl-patrimonio/src/lib/agent/ocr.ts` → `src/lib/rag/ocr.ts`; trigger
  `chars<500 || single-char-ratio>0.4`; flags reales `ocr_used`/`parser`; reforzar pipe-tables en LlamaParse (`parse.ts`);
  cablear el trigger en `src/lib/ingest/queue-processor.ts` / `/api/knowledge/upload`.
- **Migración 025** (aditiva): `rag_chunks.embedding_model` + backfill `gemini-embedding-001`. Aplícala con su red (es UPDATE 156k).

## Fases 4→8
Siguen `plan §3` literalmente. Construye el código + escribe y aplica las migraciones del ledger con su red; Ronda 2 antes de
cada prod. Fase 8 WS7-T1 (compat empírica `gemini-embedding-001` vs `-2-preview` → `embedding-pin-decision.md`) es un
experimento autónomo y bloqueante para la convergencia.

## Sólo-usuario (no ejecutable por el agente, déjalo marcado en el run log)
- **Rotar el JWT anon de MDL** (Fase 8 WS7-T2): quita el JWT inline del código autónomamente, pero la rotación de la clave en
  el dashboard de Supabase es del usuario → "PENDIENTE USUARIO" en el run log.

## No pares
No hay humano durante horas. Si una decisión te bloquea, elige lo **más conservador y reversible**, anótalo en el run log con
tu razonamiento, y sigue. Al terminar TODO: informe final (fases hechas, diff por fichero, veredicto de ambas rondas por
incremento, eval `ws1-final` vs `ws1-base`, mutaciones de prod aplicadas + verificadas) + `docs/_AUTONOMOUS_RUN_LOG.md` completo.
