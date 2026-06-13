# Spec — Semáforo de confianza en el chat + grounding como preferencia blanda

> Fecha: 2026-06-13 · Capa: Layer 2 (chat/retrieval + UI) · Estado: DISEÑO (pendiente de revisión del usuario antes del plan de implementación).
> Repo `main` local = `188042f` (NO pusheado); prod (origin) = `a9a9ff2`. Esta feature es **código + UI**, **solo-lectura** sobre gobernanza. No requiere DDL ni mutación de datos.

## 1. Problema

El chat documental debe ser un asistente para CEO/CFO que **siempre responde**, pero hoy:

- Los modos `official_only` / `trusted_only` **filtran duro** y pueden **abstenerse** (devuelven vacío + mensaje "no hay documentos oficiales, abstente"). Contradice "nunca estricto".
- El aviso de confianza solo aparece **cuando algo va mal** (badges de degradado / sin-revisar). Si la respuesta es 100% oficial no se muestra nada → "silencio" es ambiguo.
- La advertencia inline ("(fuente sin revisar)") es una **instrucción blanda al LLM**, no fiable (hallazgo C1.4 de la revisión 2026-06-13). El único respaldo determinista hoy es el chip "Se apoya en N fuentes sin revisar".

## 2. Decisión de producto (usuario, 2026-06-13)

- **El chat siempre responde; nunca abstiene por gobernanza.**
- **El nivel de confianza se muestra SIEMPRE** como **semáforo simple** 🟢/🟡/🔴 (sin etiqueta de tier en el badge).
- Calculado **determinísticamente en backend** desde la gobernanza de las fuentes citadas — **nunca por el LLM**.
- Una **línea de confianza determinista** se antepone al **texto** de la respuesta (viaja al portapapeles/informe al copiar).

## 3. Diseño

### 3.1 Señal de confianza (módulo nuevo, puro)

`src/lib/chat/confidence.ts` — función pura `computeConfidence(input) → ConfidenceSignal`.

**Input** (todo ya disponible tras retrieval+verify):
- `sources`: las fuentes finales citadas, cada una con su `verification` (`source_of_record | supporting | context | unverified`, de `verificationFromGovernance` en `source-reference.ts`).
- `unreviewedUsed: number` (de `diagnostics`).
- `degraded`, `verified`, `retrievalIncomplete: boolean`, y si el pool quedó vacío.

**Regla** — se evalúa la fuente **mejor rankeada** ya citada (`rankBySourceTrust` ya ordena por confianza), usando **tanto su `verification` como su `review_status`** (para no castigar a un aprobado de baja autoridad), con overrides rojos:

| Luz | Condición (sobre la mejor fuente citada) | `level` | Línea de texto (ejemplo) |
|---|---|---|---|
| 🔴 | `retrievalIncomplete` **o** 0 fuentes citadas | `sin_base` | `Sin base documental — respuesta de razonamiento general; no procede de documentos del corpus.` |
| 🔴 | lo mejor que hay está **sin revisar** — `review_status ∈ {needs_review, pending}` (o `unverified`/rechazada) | `baja` | `Confianza baja — se apoya en N de M fuentes sin revisar.` |
| 🟡 | **revisada/aprobada pero no oficial** — `verification == supporting`, **o** `review_status == approved` con autoridad baja (tier `context`) | `media` | `Confianza media — fuentes revisadas, ninguna oficial.` |
| 🟢 | **oficial** — `verification == source_of_record` | `alta` | `Confianza alta — fuente oficial (source_of_record).` |

- Clave del split 🟡/🔴: **review_status**, no solo el tier. Así un documento *aprobado* de baja autoridad (tier `context` pero revisado por humano) es 🟡, no 🔴; el 🔴 "baja" se reserva para cuando la mejor evidencia disponible está **sin revisar**.
- `unreviewedUsed > 0` se **incorpora siempre al `detail`**, aunque la luz sea 🟢/🟡 (p.ej. `… +2 fuentes sin revisar`).
- **Output**: `{ light: 'green'|'amber'|'red'; level: 'alta'|'media'|'baja'|'sin_base'; headline: string; detail: string }`.
- Decisión bloqueada: sin-revisar = 🔴 (no 🟡). Flippable después si `scripts/eval` lo muestra demasiado alarmista — por eso la regla vive aislada en un único módulo.

### 3.2 Grounding: filtro duro → preferencia blanda (`src/lib/rag/retrieve.ts`)

- Se conserva el type `GroundingMode` con semántica nueva: `standard` (default, todas), `prefer_reviewed` (ex `trusted_only`), `prefer_official` (ex `official_only`).
- Se **elimina** el filtro duro `pool.filter(isAllowedByGroundingMode)` → se sustituye por un **boost de re-rank**: las fuentes del tier preferido suben dentro del orden de trust-tier, pero **el pool nunca se vacía** por el modo.
- Se **eliminan** las ramas de abstención de `emptyResultMessage` para los modos estrictos (`groundingMode === 'official_only' / 'trusted_only'`). Se conservan el mensaje de **outage real** y el de **no-match genuino**.
- La sobre-extracción estricta (multiplicador ×4) ya no es necesaria (no hay filtro duro que pueda vaciar): se simplifica a un único camino con los counts estándar.
- Las exclusiones duras (rejected/agent_rejected/superseded vía RPC + mirror) **NO cambian**.

### 3.3 Wiring (`src/lib/chat/agent.ts` + `src/app/api/chat/route.ts`)

- Tras retrieval + verify: `computeConfidence(...)` a partir de las fuentes citadas + diagnostics.
- (a) Enviar `confidence` en el evento SSE `final` (y persistir en la fila del mensaje si `persisted`).
- (b) **Anteponer la `headline` determinista al texto** de la respuesta ANTES de persistir/devolver, como blockquote (`> Confianza …`), de modo que `FormattedMessage` la renderice y `CopyButton` la incluya. **No la escribe el LLM.**

### 3.4 UI (`src/app/chat/page.tsx`)

- **Badge semáforo siempre presente** por `msg.confidence.light` (luz + label corto "Confianza" + `title`/tooltip con el `detail` para accesibilidad). Minimalista.
- Se conservan los chips de detalle actuales (degradado / inyección / truncado / sin-verificar / "N sin revisar") como complemento; el de sin-revisar se queda por el conteo.
- Selector relabelado: `Todas` / `Priorizar revisadas` / `Priorizar oficiales` (ya no implican abstención).

### 3.5 Tests

- `confidence.ts`: cada tier → luz/level/headline correctos; overrides (outage → sin_base, pool vacío); fold-in de `unreviewedUsed`.
- `retrieve.ts`: `prefer_official`/`prefer_reviewed` **nunca vacían** el pool; `standard` sin cambios; sin mensaje de abstención por modo.
- `agent`/`route`: la `headline` se antepone al texto; `confidence` viaja en el evento `final`.

## 4. Concurrencia / coordinación con la sesión de saneo documental

La sesión paralela (`docs/plan-trabajo-fondo-rag-2026-06-13.md`, Tranche A+B) trabaja en **Layer 1 (datos)**: backfill `content_hash` (A1), índice único `sql/028` ph2 (A2, gate humano), **borrado de 11.360 chunks superseded** (A3), ruido de retrieval (A4), inferencia de `lifecycle` de 1.593 'unknown' (A5), re-chunk/re-embed ~2.500 docs (B). Compatibilidad:

- **Capas distintas, complementarias.** Esta feature es **solo-lectura** sobre gobernanza (lee `verification`/`review_status`/`authority` vía las RPCs `match_chunks`/`keyword_search_chunks`, que hacen JOIN vivo a `rag_documents`). A medida que la otra sesión sana (needs_review→approved→source_of_record), las respuestas pasan **solas** de 🔴/🟡 a 🟡/🟢. La feature **se beneficia** del saneo; cero acoplamiento, cero re-trabajo.
- **No la rompe ninguna acción de la otra sesión:** A3 borra chunks superseded (ya excluidos del retrieval, no citables → no afectan el tier); A5 toca `lifecycle` (no entra en `verificationFromGovernance`, que usa authority+review_status+classification_source); B re-chunkea/re-embeddea (la señal de confianza no depende del texto del chunk, solo de su gobernanza).
- **Sin DDL ni mutación de datos por mi parte.** `sql/031` ya aplicada (aditiva, ajena). No escribo `rag_documents`/`rag_chunks`, no corro scripts de gobernanza, **no toco `docs/_AUTONOMOUS_RUN_LOG.md`** (las mutaciones #21+ son de la otra sesión), **no hago push**.
- **Disciplina git:** edito solo los ficheros de esta feature; **relectura justo antes de editar** cada uno (la otra sesión podría tocarlos — aunque su plan no incluye chat code); staging con **rutas explícitas** (nunca `git add -A`); si la otra sesión ha commiteado entremedias, **merge/rebase, no sobrescribir**. Ambas sesiones commitean a `main` local; nadie pushea.
- **Ficheros que poseo en esta pasada:** NUEVO `src/lib/chat/confidence.ts` (+ test); EDITO `src/lib/rag/retrieve.ts`, `src/lib/chat/agent.ts`, `src/app/api/chat/route.ts`, `src/app/chat/page.tsx`. Solapamiento con el saneo documental ≈ nulo.

## 5. No-objetivos (YAGNI)

- Sin score numérico ni confianza por-afirmación.
- Sin cambios al verificador (sigue fail-open, badge "sin verificar" aparte).
- Sin deploy/push (gated por operador).
- Sin re-embedding ni cambios de datos (eso es la otra sesión).
