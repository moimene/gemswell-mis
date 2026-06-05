# Spec C — Chat Retrieval Quality Consolidation (design)

Fecha: 2026-06-05
Estado: **aprobado para escribir plan** (delegación autónoma del usuario)
Origen: hallazgos diferidos de la auditoría (`audit_chat_documental_2026-06`) + pasada adversarial de sub-proyecto A.
Builds on: A (corpus gobernado, merged) + B (gestor documental, merged `1914c06`).

## 0. Alcance
Tres arreglos de **calidad de recuperación del chat**, todos en el camino `/api/chat` → `search_documents`. El cuarto ítem original (C2: hechos hardcodeados en el system prompt) **ya está resuelto** por el commit `5b048af "Sanitize chat RAG quality governance"`: el `SYSTEM_PROMPT` actual (route.ts:178–208) es disciplina-de-evidencia estricta, sin cifras hardcodeadas ni "USE IT directly". Se documenta como cerrado, no se re-implementa.

**Fuera de alcance:** C1 (auth/RLS) — diferido a pre-publicación por dirección del usuario; re-parseo masivo; adaptadores de ingesta.

## 1. Estado verificado (BD `nqxhsjkcvfxygiajdxki`, 2026-06-05)
- 5.498 docs / 156.898 chunks. Distribución por proyecto: **BHX 3.142 (57%, inglés)**, MAD 1.094, KLP 492, GVF 490, PHILAE 184, null 96 → corpus **mixto ES/EN**, mayoría inglés pero ~40% español (MAD permisos/actas/legal + parte de KLP/PHILAE/GVF).
- **`keyword_search_chunks` NO usa la columna `fts`**: recomputa `to_tsvector('simple', c.content)` inline en el WHERE y en el rank (`ts_rank_cd`). → **sin stemming** (ni ES ni EN; 'simple' solo tokeniza+minúsculas), **sin `unaccent`** (no instalado), y **sin usar el índice GIN** (`idx_rag_chunks_fts` está sobre la columna `fts` 'english', no sobre el `to_tsvector('simple',…)` recomputado) → seqscan calculando tsvector sobre hasta 156k chunks por query. La columna `rag_chunks.fts` (trigger `rag_chunks_fts_update`, config 'english') + su GIN existen pero están **muertos** (el RPC no los toca).
- Rerank (route.ts:493–507): Cohere `rerank-v3.5` da `relevanceScore∈[0,1]`; luego el route hace `relevance×reviewPenalty + authorityBoost`.
- Limitador de embeddings (embeddings.ts:32–41): **un único limitador global** encadenado (`embeddingLimiterTail`) con intervalo mínimo 4s (`GEMINI_EMBEDDING_MIN_INTERVAL_MS`). Todo `embedText` comparte la cola → la query del chat espera detrás del backfill masivo.

## 2. Arreglo 1 — Dominancia de trust-tier en el ranking
**Problema:** `relevanceScore = (cohere × reviewPenalty) + authorityBoost`, con `authorityBoost = min(authority,100)/1000` (≤0.1) **aditivo** y `reviewPenalty` multiplicativo (needs_review ×0.85, approved ×1). Un doc `needs_review` authority 95 (`0.5×0.85 + 0.095 = 0.52`) **supera** a un `approved` authority 0 (`0.5×1 + 0 = 0.50`). El boost de autoridad aditivo invierte la confianza: un doc sin revisar de alta autoridad gana a uno aprobado.

**Decisión:** **ranking lexicográfico por confianza primero, relevancia después.** Nueva función pura `rankBySourceTrust(chunks)` en `src/lib/rag/rank.ts`:
- Calcula `tier` por chunk vía `verificationFromGovernance` (reusa `source-reference.ts`, fuente única): `source_of_record(3) > supporting(2) > context(1) > unverified(0)`.
- Ordena por `(tier desc, cohereRelevance desc)`. Estable.
- `rejected`/`agent_rejected` ya se filtran antes (no entran).
- **Transparencia preservada:** los `needs_review` siguen recuperables (no se ocultan), solo no pueden superar a evidencia igual-o-más-relevante de mayor tier. Se elimina el `authorityBoost` aditivo y el `reviewPenalty` ad-hoc; el tier (que ya incorpora authority≥90 + approved + human-validated) es el criterio.
- Pura → testeable: tests de inversión (needs_review-95 NO supera approved-source_of_record), estabilidad, empates por relevancia dentro de tier.

El route deja de hacer el cálculo inline (líneas 495–507) y llama a `rankBySourceTrust`.

## 3. Arreglo 2 — Stemming ES/EN (corpus mixto)
**Decisión:** tsvector **dual-idioma + `unaccent`, materializado en `fts` y consultado vía el índice GIN** → arregla a la vez (a) el stemming ES/EN, (b) la insensibilidad a acentos, y (c) la ineficiencia de seqscan (el RPC pasa a usar el índice).
- Migración `012`: `create extension if not exists unaccent;`
- Redefinir el trigger `rag_chunks_fts_update`: `NEW.fts := to_tsvector('spanish', unaccent(coalesce(NEW.content,''))) || to_tsvector('english', unaccent(coalesce(NEW.content,'')));`. El `||` combina ambos stemmers → recall en ES y EN; `unaccent` → insensible a acentos (clave en español).
- **Backfill por lotes** de 156.898 filas (`UPDATE rag_chunks SET fts = <expr> WHERE id = ANY(lote)`), en tandas (p.ej. 10k por execute_sql) para no bloquear; idempotente; el índice GIN `idx_rag_chunks_fts` se mantiene y ahora **sí se usa**.
- `keyword_search_chunks` **reescrito para usar `c.fts`** (deja de recomputar 'simple' inline): `WHERE c.fts @@ (plainto_tsquery('spanish', unaccent(query_text)) || plainto_tsquery('english', unaccent(query_text)))` y `ts_rank_cd(c.fts, <misma tsquery>)`. Mantiene intactos los filtros de gobernanza parent-first de A (status='indexed', exclusión rejected/agent_rejected, doc_type/project parent COALESCE). → GIN usado (gran mejora de latencia) + stemming ES/EN + acentos.
- `unaccent()` no es IMMUTABLE por defecto (importaría solo si se usara en un índice de expresión). Aquí se usa en el trigger/backfill y en la query del RPC, NO en la definición del índice GIN (que indexa la columna `fts` ya materializada), así que no hace falta un wrapper inmutable. Validar que el trigger sea determinista.
- **Verificación viva:** una query con acento (`"climatización"`) y un plural/conjugación español encuentran el chunk tras el backfill; una query inglesa (`"funding"/"funded"`) sigue funcionando. Self-cleaning donde aplique; el backfill es idempotente (recomputa `fts`).

## 4. Arreglo 3 — Desacoplar el limitador de embeddings
**Problema:** `waitForEmbeddingSlot()` encadena TODO en `embeddingLimiterTail` con 4s mínimo. La query interactiva del chat (1 embed, latency-sensitive) espera detrás del backfill masivo.
**Decisión:** **dos carriles.** Parametrizar `embedText`/`embedBatch` con un modo (`'interactive' | 'bulk'`, default `'bulk'` para no romper ingest):
- Carril `bulk`: limitador global actual (4s) — ingest/backfill.
- Carril `interactive`: limitador propio independiente con intervalo corto (`GEMINI_EMBEDDING_INTERACTIVE_MIN_INTERVAL_MS`, default **250ms**) — no se encola tras el bulk.
- El chat (`route.ts` `executeSearchDocuments`) llama `embedText(query, { lane: 'interactive' })`.
- Mantiene reintentos/backoff 429 en ambos carriles. Tests: dos llamadas interactivas no esperan 4s; el carril bulk conserva su intervalo.

## 5. Minor — Calibrar `RAG_MATCH_THRESHOLD`
`match_threshold` 0.18 puede estar bajo el suelo coseno del corpus (filtro inerte). Verificar en vivo la distribución de similitud de `match_chunks` para una query típica; fijar `RAG_MATCH_THRESHOLD` a un valor que recorte ruido real (o documentar que 0.18 es correcto). Cambio solo de constante/env + nota; sin migración.

## 6. Arquitectura / unidades
- `src/lib/rag/rank.ts` (NUEVO, puro): `rankBySourceTrust`, `trustTier`. Tests.
- `src/lib/rag/embeddings.ts` (MOD): carriles interactive/bulk.
- `src/app/api/chat/route.ts` (MOD): usar `rankBySourceTrust`; embed interactive.
- `sql/012_dual_language_fts.sql` (NUEVO): unaccent + trigger + `keyword_search_chunks` dual; backfill script/SQL por lotes.
- `src/lib/knowledge/source-reference.ts` (reusar `verificationFromGovernance`, ya exportado en B).

## 7. Manejo de errores
- Rerank/Cohere falla → fallback por similitud (ya existe) → `rankBySourceTrust` sigue aplicando sobre el fallback.
- Embed interactive falla → el chat degrada a solo keyword (ya hay try/catch en `executeSearchDocuments`).
- Backfill FTS: por lotes, idempotente, fail-soft por lote; el GIN se mantiene; si un lote falla se reintenta el lote.
- `keyword_search_chunks` nuevo: si `unaccent` no existe → la migración lo crea primero (ordenado).

## 8. Pruebas
1. `rankBySourceTrust`: needs_review-auth95 NO supera approved-source_of_record; orden estable; empate por relevancia dentro de tier; rejected ausente.
2. FTS (vivo): query con acento + plural español encuentra el chunk; query inglesa sigue; doc `rejected`/`retired` excluido (gobernanza parent-first intacta).
3. Embeddings: 2 llamadas `interactive` no incurren el intervalo de 4s; `bulk` conserva intervalo.
4. Regresión chat: `npm run build` + un par de queries e2e (vía DO/SQL para el RPC keyword) devuelven resultados ordenados por tier.
5. Threshold: la query típica devuelve N resultados por encima del nuevo umbral.

## 9. Fuera de alcance (sin cambios)
- C1 (auth + RLS) — pre-publicación.
- Re-parseo masivo, adaptadores upload/Drive/Gmail.
- Cambiar el modelo de embeddings o de chat.
