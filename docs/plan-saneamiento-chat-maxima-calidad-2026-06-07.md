# Plan maestro — Saneamiento total + máxima calidad del chat documental (Gemswell MIS)

Fecha: 2026-06-07 · Modo de ejecución: `/goal` + `ultracode`, por fases, en sesiones sucesivas.
Origen: auditoría `auditoria-critica-chat-documental-2026-06-07.md` → workflow ultracode de 10 agentes (7 arquitectos de work-stream + secuenciador + definidor de calidad + red-team).
Estado de partida: **Fase 0 hecha** (rama `agent/chat-gate-fase0`, 2 commits, NO pusheada, `sql/019` NO aplicada). Este plan construye SOBRE ella.

> Regla del plan: cada fase es **prod-safe o con rollout gated**; cada cambio se **mide** contra el harness de eval, no se asume; ninguna afirmación de calidad sin número. El sistema es financiero y está vivo.

---

## 0. North star — qué significa "máxima calidad" (medible, con tripwire)

No es una sensación: es un estado numérico con gate de regresión en CI. Se alcanza cuando, medido por `scripts/eval/` (Tier-A retrieval recall@k+MRR sobre el `retrieveDocuments` real; Tier-B `runChatTurn` + verificador Opus juzgado por LLM-judge), **se cumplen a la vez**:

| Métrica (bucket documental, el rezagado) | Hoy | Objetivo | Cómo se mide |
|---|---|---|---|
| Judge **pass-rate** documental | **60%** | **≥ 80%** | `run-answers.ts` (la métrica titular del plan) |
| **Faithfulness** F | 4.30/5 | **≥ 4.5** | judge: toda cifra material respaldada por source card o tool result |
| **Citation precision** C | 4.20/5 | **≥ 4.5** | judge: las fuentes citadas son las correctas |
| Retrieval **recall@5** | 60% | **≥ 80%** | `run-retrieval.ts` sobre el set doc-ID-pinned |
| Retrieval **recall@10** (pool-inclusion) | 60% | **≥ 90%** | el chunk correcto entra al pool que ve el modelo |
| **MRR** | 0.475 | **≥ 0.60** | rank del doc correcto |
| **Precision@5** (NUEVA, hoy sin medir) | — | **≥ 0.55** | requiere doc-ID pinning |
| **Grounding** anti-fabricación (NUEVA) | — | **≥ 0.95** | % de cifras del answer presentes verbatim en fuente/tool (determinista) |

**Gates DUROS (rompen el build), nuevos:** G1 superseded/rejected NUNCA citado · G2 needs_review usado → SIEMPRE divulgado · G3 source_of_record alcanzable y liderando cuando existe · G4 caída de lane → mensaje de outage, no de gobernanza · abstención → cero fabricación.
**Guard de regresión:** los buckets BUENOS no caen — structured pass ≥ 86% / F ≥ 4.5, ambiguous/abstain behavior_correct = 1.0.

Hito que define "documental ya no plano": `ws1-final` supera a `ws1-base` en F/C/recall del bucket documental con **cero regresión** en structured/abstain/ambiguous.

---

## 1. La regla que evita el desastre #1 (corrección del red-team)

El red-team encontró el mayor riesgo de producción: **6 de 7 work-streams escriben `sql/020` de forma independiente, y 3 recrean las MISMAS dos RPC del retrieval (`match_chunks`/`keyword_search_chunks`) con cuerpos distintos** → la última en aplicarse gana en silencio y revierte a las demás (incluida la exclusión de `superseded` de Fase 0, reabriendo la fuga de 369 chunks; o peor, flip a seq-scan → timeout silencioso, la patología que ya mató el retrieval dos veces).

**Tres reglas de gobierno, obligatorias antes de escribir una sola línea de SQL:**

1. **Migration ledger único** (tabla §2). Los números `sql/020+` se preasignan aquí. Nadie inventa números.
2. **Regla de único dueño de RPC.** SOLO la migración de la **Fase 5** puede recrear `match_chunks`/`keyword_search_chunks`. Todo cambio de columnas de retorno (chunk_index, page, storage_path) se **funde en esa única recreación**, copiada VERBATIM del cuerpo de `sql/019`.
3. **Gate-0 global.** "Aplicar `sql/019` a prod" es un paso global de la Fase 1, **fuera** de cualquier work-stream de feature. Ninguna migración posterior se autora hasta que 019 esté vivo y verificado (si no, se autoraría sobre el cuerpo 015/018 pre-019 y se revertiría Fase 0).

Otras correcciones del red-team incorporadas:
- **RRF (WS1-T1) + relevance floor (WS1-T3) son UNA unidad de tuning**, medida junta (RRF solo cambia la inclusión en el pool; medido en solitario daría "sin mejora" y se abandonaría por error el lever más potente). Reportar recall@10 (pool-inclusion) + MRR-degradado, no solo top-k.
- **Re-embed de los 156.898 chunks legacy**: coste/mecánica no trivial — se planifica explícitamente en Fase 6/8, gated por el veredicto de compatibilidad de modelo (WS7-T1), nunca ad-hoc.
- **Endorsar 797 docs en bulk a source_of_record** cambia lo que el chat trata como autoritativo en prod: se hace gated, priorizado por autoridad, reversible, con asserts antes/después de la distribución de gobernanza.

---

## 2. Migration ledger (preasignado — fuente única de verdad)

`sql/` está hoy en 019. Aplicar en este orden; cada una con su `sql/rollback/NNN_rollback.sql` verbatim; aplicar primero en **Supabase branch** + probe de rendimiento vía el **cliente real** (supabase-js), no psql.

| Nº | Dueño (fase) | Qué hace | Recrea RPC retrieval? | Riesgo |
|----|----|----|----|----|
| **019** | Fase 0 (HECHA, pend. aplicar) | filtro `lifecycle<>'superseded'` en ambas RPC | sí (ya escrito) | medio — **Gate-0** |
| 020 | Fase 4 | `apply_document_governance` + CHECK de integridad de endorse | no | bajo |
| 021 | Fase 4 | `apply_document_governance_bulk(uuid[],…)` | no | medio |
| 022 | Fase 4 | `knowledge_corpus_health()` + `source_of_record_eligible/pct` | no | bajo |
| **023** | **Fase 5** | **UNIFICADA**: `match_chunks`+`keyword_search_chunks` añadiendo `chunk_index`+`page`+`storage_path` (cuerpo VERBATIM de 019) | **SÍ — ÚNICO DUEÑO** | **alto — branch + probe real** |
| 024 | Fase 5 | `finalize_document_ingest(doc, chunks, expected)` transaccional | no | alto |
| 025 | Fase 3/5 | `rag_chunks.embedding_model` (columna aditiva) + backfill `gemini-embedding-001` | no | medio (UPDATE 156k) |
| 026 | Fase 6 | `refresh_rag_term_df()` (fn + meta) | no | bajo |
| 027 | Fase 6 | `ingest_jobs` (tabla durable + RLS admin-only) | no | bajo (aditiva) |
| 028 | Fase 6 | `content_hash` + índice único parcial (dedup legacy) | no | bajo (aditiva) |

`page` viaja en `metadata` jsonb (no necesita columna). Si se decide columna, va en 023.

---

## 3. Roadmap por fases (secuenciador, con mis correcciones)

Ruta crítica: **Fase 1 → 2 → 3 → 5 → 7**. Fases 4, 6, 8 cuelgan en paralelo/después según dependencias.

### Fase 1 — Gate-0: Fase 0 a prod + congelar el espía de medición  · *prod: aplica migración*
- Merge `agent/chat-gate-fase0` a main; `npm test` verde.
- **Aplicar `sql/019`** (recrea ambas RPC añadiendo solo el filtro superseded) → verificar LIVE: 7 docs/369 chunks superseded devuelven 0 filas; `EXPLAIN ANALYZE` confirma index-served <100ms en MAD y KLP.
- Erigir el harness honesto: `scripts/eval/QUALITY.md` + `targets.ts` (rubric SSOT); **doc-ID pinning** del golden (`expected_doc_ids` reales, resueltos por humano — no auto-pin), reemplazando el match por substring de título; ampliar golden a ≥40 (≥15 documentales: pipe-tables, cláusula legal, EN-query→ES-doc, scoping KLP/PHILAE/GVF); meter `scripts/**/*.test.ts` en el glob de vitest; congelar baseline `ws1-base`.
- **Salida:** 019 vivo y verificado; rubric + targets + baseline commiteados; precision@k medible.

### Fase 2 — Calidad de retrieval/respuesta en capa de app · *prod-safe (env flags, A/B)* · **mayor lift temprano**
- **WS1-T1+T3 (una unidad):** RRF ponderado sustituyendo el dedup vector-first (A3) + relevance floor adaptativo sobre el score de Cohere (sustituye el 0.18 ciego). Detrás de `RAG_FUSION_MODE`/`RAG_RELEVANCE_FLOOR`, A/B contra `ws1-base`.
- **WS1-T2:** integridad de rerank — la ruta degradada ordena por `fusedScore` (escala-libre), no por la mezcla coseno/ts_rank; `relevanceScore∈[0,1]`; un retry de Cohere antes de degradar.
- **WS1-T4/T5:** query understanding KLP/PHILAE/GVF (entity detection + autotag) + descomposición multi-search para preguntas compuestas/cross-entity (prompt-first, seguro).
- **WS1-T8:** verificador — pasarle el chunk citado COMPLETO (no el preview de 220 chars) para que pueda confirmar en positivo; cerrar el bucket plano por el lado de generación.
- **Salida:** documental sube (F/C/recall) sin regresión; flags flip en Vercel solo tras A/B favorable; rollback = flip de env (inmediato).

### Fase 3 — Endurecer la ingesta en CÓDIGO (afecta solo a nuevos ingests) · *prod-safe*
- **WS2-T1..T3 (TDD):** chunking table-aware (detecta pipe-tables markdown, nunca parte una fila, repite cabecera) + cláusula/artículo legal (corte por `Artículo/Cláusula/numeral`, no por líneas en blanco). Cierra A1, "la pieza peor diseñada".
- **WS2-T4 + T7/T8/T10:** página → `metadata.page` (split por `page_separator`); **OCR Mistral** portado de MDL (`src/lib/rag/ocr.ts`) con trigger `chars<500 || single-char-ratio>0.4` → escaneados dejan de lanzar error; `ocr_used`/`parser` reales; instrucciones de pipe-table reforzadas en LlamaParse.
- **025 (aditiva, standalone):** `embedding_model` por chunk.
- **Salida:** nuevos PDFs traen `page`+`chunk_index`; un escaneado se ingiere por OCR; tests de chunking verdes; **legacy intacto** hasta el backfill de Fase 5.

### Fase 4 — Alcanzabilidad de la confianza (C2) + drenar el backlog · *prod: RPC de gobernanza*
- **WS3-T1..T3:** acción `endorse` ("Endorsar como fuente oficial") — fn pura SSOT (TDD) + CHECK de integridad (human-validated exige approved+indexed) + botón de un clic en `DocumentPanel`, gated a approved/auth≥90.
- **WS3-T4/T5:** RPC `apply_document_governance_bulk` + **cola de revisión keyboard-first** sobre el orden ya priorizado (confianza asc) para drenar los 2.267 rápido.
- **WS3-T6:** `corpus_health` expone `source_of_record_eligible`/`_pct` (mide el objetivo).
- **WS3-T10:** runbook + script guardado para endorsar la cabeza de 797 (operación de datos, gated).
- **Salida (live):** `source_of_record > 0` (de 0; alcanzable ~797); el chat lidera con "fuente oficial"; distribución de gobernanza sin cambios colaterales.

### Fase 5 — La ÚNICA ventana de migración del retrieval-RPC (alto riesgo, gated) · *prod: branch + probe real*
- **023 UNIFICADA** (funde WS1-T6+WS2-T5+WS5-T4): recrea ambas RPC añadiendo `chunk_index`+`page`+`storage_path`, cuerpo VERBATIM de 019, firma por lo demás idéntica. Aplicar en **Supabase branch** → `EXPLAIN ANALYZE` vía cliente real (MAD/KLP <100ms, keyword <1s) → solo entonces a prod.
- **024:** `finalize_document_ingest` transaccional (chunks + status indexed atómico — cierra C5 root).
- **WS5-T1/T2/T8:** endpoint de descarga firmada del original + backfill DMS→Storage (priorizar 797 auth≥90) + artefactos markdown `md_status='ready'`.
- **WS5-T5/T6:** deep-link de cita a página (`#page=N`) + render de `tool_calls` en la UI (M4, el "por qué" de respuestas estructuradas).
- **Salida:** una cita abre el PDF real en la página citada; `storage_path>0` para ≥797; ambas RPC siguen index-served; superseded sigue excluido.

### Fase 6 — Fiabilidad de ingesta & ops · *prod: aditivas + cron*
- Modelo de jobs durables (DECISIÓN: Inngest-dep vs Vercel-native — **recomiendo Vercel-native**) con idempotencia por `source_hash`, retries, concurrencia acotada, event rows; **cron reaper** en `vercel.json` que **RE-INGESTA** (no solo marca error); auto-refresh de `rag_term_df` (cierra A4/C4 root); alerting de strand/degradación; `git rm` de scripts legacy ingobernados + fix de docs que apuntan a 404; `source_channel` real; backfill `source_hash`/`content_hash` + dedup legacy.
- **Salida:** un doc stranded se recupera solo; re-queue idempotente; oracle keyword nunca obsoleto; cero writers ingobernables.

### Fase 7 — Gate de convergencia WS1 + gate de calidad en CI · *prod-safe (config/CI)*
- `ws1-final` vs `ws1-base` (tabla antes/después); promover los env ganadores a defaults en `retrieve.ts`; `scripts/eval/gate.ts` (un comando → verde/rojo vs targets+baseline, exit≠0 al romper); `.github/workflows/eval-gate.yml` de dos niveles (JOB A offline/bloqueante en cada PR: vitest + invariantes deterministas de gobernanza; JOB B scored nightly/manual con secretos).
- **Salida:** documental off-flat con cero regresión; gate duro impide reabrir el agujero de confianza o regresar retrieval.

### Fase 8 — Convergencia MDL/Teras: `@teras/rag-core` (gated por veredicto de vectores) · *prod: deploys de ambas apps*
- **WS7-T1 (BLOQUEANTE):** probar empíricamente compat. cruzada `gemini-embedding-001` vs `gemini-embedding-2-preview` → `embedding-pin-decision.md`. Probable: NO interoperables → pin por-app + tag `embedding_model` obligatorio, nunca corpus compartido sin re-embed completo.
- **WS7-T2:** reconciliar pin a env SSOT + **arreglar el bug latente de MDL** (`text-embedding-005` que 404ea en `process-attachment.ts:472`); quitar el anon JWT inline de MDL (`chat/route.ts:14`) + rotar.
- **WS7-T4..T8:** extraer `@teras/rag-core` puro-TS (rank/trust + injection + verifier + retrieve hibrido + chunking/rerank), parametrizando nombres de RPC + filtro de gobernanza para ambos esquemas.
- **Port FROM MDL → Gemswell:** OCR (ya en Fase 3), jobs durables (Fase 6), md-repo Git publish, Gmail/Drive (si las fuentes lo justifican).
- **Port TO MDL ← Gemswell:** verificador, lane keyword híbrida, trust-rank, injection boundary.
- **Salida:** un core compartido, gobernado una vez, con gate de eval corriendo contra ambas apps; reconciliación de esquema/modelo antes de cualquier corpus común.

---

## 4. Protocolo de ejecución en `/goal` + `ultracode`

Cada fase = una (o varias) sesión `/goal`. Por fase:
1. **Antes:** confirmar precondiciones del ledger (§2) y dependencias de fase; releer el cuerpo vivo de las RPC vía `pg_get_functiondef` (regla de sesiones concurrentes) si la fase toca SQL.
2. **Construir con TDD** (rama por fase, `agent/faseN-*`); cada tarea con sus tests + criterios de aceptación del work-stream.
3. **Medir**: `run-retrieval`/`run-answers` con label de fase; diff contra `ws1-base`; el bucket documental no regresa, los buenos no caen.
4. **Gated rollout** (si prod): branch Supabase + probe con cliente real → aplicar → verificar LIVE → rollback listo. Migraciones nunca a `main` sin push del usuario (auto-deploy).
5. **Cerrar**: gates verdes (vitest + eval gate), commit, actualizar el ledger y `CLAUDE.md`.

ultracode por fase: lanzar un workflow de implementación (fan-out por tarea independiente del work-stream → verificación adversarial de cada cambio antes de commitear), no uno monolítico.

---

## 5. Esfuerzo y orden recomendado de arranque

- **Programa completo:** ~7 work-streams, ~70 tareas, varias semanas en sesiones sucesivas.
- **Primera sesión (alto valor, bajo riesgo):** **Fase 1** — es el Gate-0 y desbloquea todo lo demás. Cierra en vivo C3 (superseded) y monta el yardstick honesto sin el cual "máxima calidad" no es medible.
- **Segunda:** **Fase 2** — el mayor salto de calidad documental con riesgo de prod nulo (todo env-flagged, A/B, rollback instantáneo).
- Luego Fase 3 (código) y Fase 4 (gobernanza) en paralelo; converger en la ventana única de Fase 5; estabilizar en 6/7; convergencia MDL en 8.

---

## 6. Lo que ya está hecho (no re-planificar)

Fase 0 (rama `agent/chat-gate-fase0`): C3 exclusión superseded (sql/019 + `isExcludedFromRetrieval`), C4 visibilidad de degradación (`vectorFailed`/`keywordFailed` + `emptyResultMessage`), C1 disclosure (`unreviewedUsed` → SSE → badges UI). Política C1 = needs_review se queda como fallback rankeado bajo approved. Gates verdes (vitest 85/85, lint, tsc, build). **Pendiente: aplicar 019 + push (Fase 1).**

---

### Anexo — los 3 derailers que el red-team dice que hay que vigilar
1. **Colisión de migraciones** (resuelto aquí con ledger + único-dueño-de-RPC + Gate-0). Hasta que el ledger se respete, *toda tarea SQL es insegura de empezar*.
2. **Espejismo de mejora de RRF** medido en solitario (resuelto: RRF+floor como una unidad, reportar recall@10 + MRR-degradado).
3. **Ground-truth del eval** débil (resuelto: doc-ID pinning humano antes de optimizar contra él).
