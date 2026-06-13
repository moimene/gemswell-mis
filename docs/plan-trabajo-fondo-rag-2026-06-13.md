# Plan — Trabajo de fondo RAG + ingesta (2026-06-13)

> Estado: **Tranche A EJECUTADO + verificado (2026-06-13)**. Tranche B = feasibility PROBADA (pilot), pendiente decisión de scope (curado, NO blanket).
> Prod: `nqxhsjkcvfxygiajdxki`. App local `main`=`188042f` (NO pusheado), origin=`a9a9ff2`.

## EJECUCIÓN — Tranche A DONE (2026-06-13, mutaciones #21–#26)
Baseline pre: 156.898 chunks · 11.360 superseded · 1.593 unknown · 0 content_hash · 1.787 tiny.
- **#21 A3** purga superseded chunks → backup `rag_chunks_superseded_bak_20260613` (12.010 filas) + DELETE. Chunks 156.898→145.538.
- **#22 A1** backfill `content_hash` (sha256 normalizado, idéntico a `dedup-legacy-corpus.mjs`) sobre 3.529 docs vivos (los superseded quedan NULL, fuera del índice — correcto).
- **#23 A2a** resueltas 21 colisiones content_hash (dups byte-idénticos: formato/nombre/versión-BP) vía supersede del no-canónico + audit `dedup_supersede` (revert-compatible). Cero pérdida de contenido (el canónico tiene texto idéntico).
- **#24 A2b** índice único parcial `uq_rag_documents_content_hash (content_hash, project_id) WHERE lifecycle<>'superseded'`.
- **#25 A3b** purga de los 650 chunks de los 21 nuevos superseded (al backup) + DELETE. Chunks →144.888.
- **#26 A5** lifecycle inference conservador (solo señal de filename inequívoca): 21 docs (20 signed, 1 draft). Resto sigue `unknown` honesto (señales escasas; lifecycle NO es palanca de retrieval — solo exclusión `=superseded` en retrieve.ts:102).
- **A4** borrado SOLO de 30 chunks `---` puro (separadores) → backup `rag_chunks_noise_bak_20260613`. Los 1.787 "tiny chunks" NO se tocaron: son fragmentos de deck con KPIs/cifras reales (`## Amount: € 2,020,000`, `## Surf 40,59%`). + reconciliado chunk_count en 30 docs.

**Estado post-A (verificado):** 5.498 docs · **144.858 chunks** · superseded_chunks_present=0 · live retrievable 3.528→**3.507** · content_hash 3.529 · **orphan_chunks=0** · backups 12.010+30. Todo REVERSIBLE.

**No-regresión PROBADA (eval):** `run-retrieval.ts` post-A = cross @5 55% / @10 **64%** / MRR 0.442 / **degraded 0**; scoped @5 57%. (vs `ws1-base` @5 60/@10 60/MRR 0.475.) El único efecto de A fue 1 doc pin-eado en `golden.json` que dedupé (`1094af8d`→canónico `d4738ec5`, contenido idéntico); re-pin-eado → scoped @5 43→57. recall@10 SUBIÓ. Corpus cambió mucho desde 06-07, así que el 60→55 cross no es atribuible a A.

## EJECUCIÓN — Tranche B: feasibility PROBADA, blanket DESCARTADO
Pilot `scripts/rechunk-pilot.ts` (read-only, reconstruye texto de chunks → corre `chunkFinancialContent` real):
- ✅ Clause-aware SÍ dispara en texto reconstruido + **recupera page** donde sobreviven `---`: `HUB URB MEM` 5228→5674 (clause 4098, withPage 5664); `ECIJA ContratoObra` 1870→2329 clause. Gana de verdad en contratos reales.
- ⚠ `doc_type='legal'` está CONTAMINADO con anexos de ingeniería (mediciones, plazos/costes, 4–10M chars) → el regex de cláusula da falsos positivos (`"sección de medición"`). Blanket re-chunk los empeoraría.
- ⚠ Reconstrucción INFLA chunks ~8–30% (overlap narrativo duplicado) salvo que se strip-ee.
- 706 docs legal/board = 57.690 chunks (40% del corpus). Re-embed masivo NO justificado por el eval (golden de 11 Qs demasiado grueso).
**Conclusión B:** re-chunk clause-aware CURADO de contratos genuinos (no anexos de ingeniería), con strip de overlap, re-embed solo del subset. Blanket = NO.

## EJECUCIÓN — Tranche B CURADO (2026-06-13, en curso)
`scripts/rechunk-contracts.ts` (DRY-RUN por defecto, `--apply` escribe). Curación = filtro título contrato ∧ no-ingeniería ∧ chunk_count>=5 → **178 contratos genuinos** (ECIJA ContratoObra, Acuerdo de socios Kelpa ×2, Acuerdo Marco ATM-MPS, Acuerdo Inversión, Loan Agreements, NDAs, ISHA…).
- **Backup completo:** `rag_chunks_rechunk_bak_20260613` = TODOS los legal/board live chunk_count>=5 (**57.293 chunks / 504 docs**, superset) — fuente inmutable de reconstrucción + restore.
- **Bug propio cazado + fijo:** primera reconstrucción con `deOverlap` colapsaba `\n`→espacio → mataba la detección line-anchored (clause 118). Fix = join `\n\n` newline-preserving (el pilot lo probó). True dry-run: **7.272→11.637 chunks, clause+3.135, page+4.869**.
- **Crash-safe/resumable:** lee OLD chunks del BACKUP (no rag_chunks), salta docs con evento `rechunk`, delete+insert por doc. fts vía trigger `trig_rag_chunks_fts`, embedding_model vía default de columna, mismo path que `insertChunkBatch`.
- **Pilot --apply --limit 3 VERIFICADO:** 268 chunks, null_fts=0, null_emb=0, null_model=0, with_page=265, chunk_count consistente. Write-path correcto.
- **Apply completo (#27 prod):** EN CURSO (~175 docs / ~11.4k chunks, re-embed bulk ~30-35min). Rollback: restore desde `rag_chunks_rechunk_bak_20260613`.
- Pendiente al terminar: re-eval `run-retrieval.ts`, refresh `rag_term_df` (keyword oracle), verificación integridad, commit.

## EJECUCIÓN — Backlog completo (2026-06-13, adversarial + Codex ×3, mutaciones #28–30)
Modo adversarial (auto-revisión con datos live) + **Codex `gpt-5.5` como 2º adversarial, 3 pasadas**. El bucle redujo riesgo iterativamente; cada hallazgo concreto fijado.
- **B1 (sql/032, #28):** 29 anexos de ingeniería (HUB URB planos/MEM, COVE mediciones, PLAN DE PLAZOS, ahorros, BREEAM, drawings) mal puestos `legal/board`@audited-95 → `capex`. **Codex cazó:** `\bloan\b` no es boundary en PG; `pliego` demasiado amplio → fijado (drop `pliego`, `breeam` cubre; +loan/prestamo/cesion/covenant/pliego-de-condicion al exclude). Auditado, reversible. legal/board 706→677, capex 450→479.
- **B2 (sql/033, #29):** 9 planos image-only (<200 chars) auth→10. **Codex cazó:** "<200 chars" pillaba firmados/certificados cortos → re-scopeado a títulos de DIBUJO ∧ excluye legal/cert/authorization/deed/lease/notice/surrender; quitado `render`(→surrender). El anexo audited-95 near-empty se deja intacto.
- **B4 (scripts/dedup-near-dups.mjs, #30):** **9** near-dups superseded (variantes mismo-día formato/copia/firma, sim≥0.95 ∧ len≥0.92). **Bucle adversarial 56→12→9:** auto-review cazó que el stem colapsaba series temporales (Tablas MPS semanales, Memo Fase fechados) → `tightKey` preserva fechas; Codex cazó sim sobre primeros-4-chunks → fingerprint FULL-doc; `tightKey` borraba años `(2024)` → solo `(\d{1,3})`; +guarda length-ratio; quitado `supersedes_document_id` (semántica survivor→old); +`--revert`; optimistic lock. 508 clusters → revisión humana (financial-versions/translations/sub-umbral). Chunks de los 9 purgados (384) → backup.
- **B5 (queue-processor.ts):** `content_hash` en el ingest. **Codex CRÍTICO cazó 2:** (1) hasheaba `finalMarkdown` con frontmatter volátil (document_id/generated_at) → hash único inútil → fijado a `computeContentHash([parsed.content])`; (2) `project_id` NUNCA se persistía en `rag_documents` (bug pre-existente) → índice veía `(hash,NULL)`, NULLs no colisionan → dedup muerto → fijado (persiste project_id en NEW docs, sin sobreescribir reused). On 23505 → supersede el re-upload. 22 tests (5 content-hash + 17 ingest), tsc limpio.
- **B6:** resuelto por decisión (mantener; tradeoff SHA Kelpa monitorizado). **B7:** `rag_term_df` refrescado (302.797 términos).
- **Out-of-backlog (Codex round-3, chip lanzado):** `source_hash` dedup es GLOBAL no per-project → mismo fichero no puede aparecer en 2 proyectos. Necesita migración `(source_hash,project_id)`. `task_786828a0`.
- **Integridad post-backlog:** 5.498 docs · **148.757 chunks** · superseded_present 0 · null_fts/emb 0 · orphans 0 · live_retrievable 3.498.

### Tareas de seguimiento (resto, NO en este pase)
- Near-dups que A2 (byte-exacto) no cogió: `Loan Agreement 130.000 GBP` ×4 formatos, `Acuerdo Marco ATM-MPS` ×3, `Acuerdo de socios Kelpa` ×2. Necesitan dedup semántico/versión (no byte-exacto).
- Reclasificar anexos de ingeniería mal puestos como `doc_type='legal'` (mediciones, plazos/costes) → capex/engineering.
- Wire `content_hash` en el ingest (`queue-processor.ts`) para que el índice único `uq_rag_documents_content_hash` guarde de verdad re-ingestas futuras (hoy ingest no escribe content_hash).
- `fts` NULL en ingest nuevo: el trigger lo cubre, pero confirmar que `insertChunkBatch` no lo rompe.
- 12 planos image-only sin texto (storage_path=0 → no OCR posible en legacy); 1 es `audited` (`AM_MPS-Anexo III.pdf`) — revisar manualmente.

## 0. Diagnóstico (foto live verificada hoy)

| Dimensión | Estado | Lectura |
|---|---|---|
| Corpus | 5.498 docs / 156.898 chunks | — |
| Integridad | 0 huérfanos · 0 embeddings null · 0 mismatch chunk_count · embedding uniforme `gemini-embedding-001` | **Sano** |
| Superficie ungobernada retrievable | **20** docs `needs_review` vivos (raw 1.306, resto superseded) | Gate cerrado |
| `lifecycle='unknown'` | **1.593 docs (29%)**, 1.582 approved+retrievable | Mayor hueco de metadato |
| Page provenance | **0 / 156.898** chunks con `metadata.page` | `assignPages` (WS2-T4) nunca corrió en legacy |
| `chunk_type` | table_section 83.742 · narrative 73.156 · **clause 0** | Legacy = heurística estructurada vieja; clause-aware nunca aplicado |
| `content_hash` | **NULL en 5.498/5.498** | Dedup no enforzable; sql/028 phase 2 sin aplicar |
| `storage_path` / source bytes | **0 docs** con bytes originales (md_path/source_hash = 2) | **No se puede re-parsear desde origen** |
| Chunks superseded físicos | **11.360** (7,2% del índice HNSW) | Excluidos del retrieval, inflan el índice |
| Extracción fallida | 12 near-empty + 24 finos = ~1% de 3.528 vivos | Los 12 son planos image-only. No es crisis |
| Ingesta | último doc 2026-06-04, 2 desde 1-jun; cola durable inerte hasta deploy `188042f` | Congelada por **decisión de deploy**, no por datos |

**Veredicto:** el corpus está bien mantenido. Esto es completitud + una optimización, no rescate.

---

## Tranche A — Higiene (autorizado, reversible, alta confianza)

Orden por riesgo creciente. Cada paso = mutación prod numerada con verificación + rollback, estilo `docs/_AUTONOMOUS_RUN_LOG.md`.

### A1 — Backfill `content_hash` (additivo, sin riesgo)
- Calcular hash determinista por doc a partir del texto reconstruido (concat de chunks por `chunk_index`). `sql/028` ya define la columna.
- UPDATE 5.498 filas. Reversible (set NULL).
- **Bloquea** el índice único hasta resolver colisiones (ver A2).

### A2 — Índice único de dedup (sql/028 PHASE 2) — **GATE humano**
- Tras A1, contar colisiones `content_hash`. Memoria: ~21 colisiones cross-title que necesitan revisión humana.
- Si colisiones=0 → crear índice único parcial. Si >0 → listar para decisión, NO forzar.
- **No aplicar a ciegas.**

### A3 — Purga de 11.360 chunks superseded (reversible-ish)
- DELETE de `rag_chunks` donde el doc es `lifecycle='superseded'`. Los docs se conservan (`status` intacto); solo se sueltan vectores ya excluidos del retrieval.
- Beneficio: índice HNSW −7,2% → menos riesgo del timeout gotcha + storage.
- Reversible solo vía re-chunk (aceptable: son superseded). Snapshot de conteos antes.

### A4 — Limpieza de ruido de retrieval
- 1.787 tiny chunks (<40 chars) en docs vivos: marcar `chunk_type='fragment'` o excluir del retrieval vía filtro (no borrar a ciegas).
- 12 planos image-only: bajar `authority_score` / marcar `doc_type` para que no compitan en retrieval de texto. Candidatos a OCR opt-in (A6).

### A5 — Inferencia de `lifecycle` para los 1.593 'unknown' (reversible)
- Patrón ya usado: `scripts/reclassify-needs-review-opus.ts` + `apply-opus-reclassify.mjs`.
- Reglas determinísticas primero (doc_type + título: `executed`/`signed`/`filed`/`draft`/`working_paper`), LLM fallback solo para ambiguos.
- Escribe `rag_document_events` para auditabilidad + reversión. Cada cambio registrado.

### A6 — (opcional) OCR de los 12 planos
- `src/lib/rag/ocr.ts` ya portado (Mistral, opt-in `RAG_OCR_ENABLED`). Pero sin bytes originales (storage_path=0) **no hay imagen que OCRear**. → **Inviable en legacy.** Solo aplica a nuevos uploads. Mover a backlog going-forward.

---

## Tranche B — Re-chunk (REFRAME por `storage_path=0`)

**Lo que NO es posible:** re-ingesta desde origen (0 bytes en Storage). Page provenance completa (los `---` solo sobreviven en 2.821 chunks).

**Lo que SÍ es posible y vale la pena:** re-segmentar SOLO los docs que ganan, desde texto reconstruido:
- **~2.178 docs con tablas pipe**: hoy chunkeados por la heurística vieja (`tryStructuredChunk`) que parte tablas mid-row. Re-correr `tryMarkdownTableChunk` (row-atómico, header repetido) → ganancia real en retrieval de tablas financieras.
- **Docs legales (doc_type legal/board)**: 0 chunks `clause` hoy. Aplicar `tryClauseChunk` → ganancia en SHA / contratos.
- **Page**: recuperable solo donde sobreviven `---` (~2.821 chunks). Se acepta como best-effort; page real = feature going-forward.

**Re-embed:** mismo modelo (`gemini-embedding-001`, pin Fase 8). Re-embeddear **solo** los chunks cuyo texto cambie tras re-segmentar (subset tabla+legal ≈ 2.500 docs), **NO** los 156k. Lane `bulk`, 4s spacing.

### B0 — Eval gate (OBLIGATORIO antes de re-embed)
- `scripts/eval` (baseline `ws1-base`: recall@5 60% / recall@10 60% / MRR 0.475).
- A/B sobre muestra de docs financieros+legales: chunker actual-en-DB vs re-segmentado. Medir delta recall@5/MRR.
- Δ positivo claro → ejecutar B sobre el subset. Δ marginal/negativo → parar B, quedarnos con A. **Decisión por evidencia.**

### B1 — Ejecución (si B0 verde)
- Reconstruir texto por doc (strip de overlap sintético narrativo + headers repetidos de tabla).
- Re-chunk con `chunkFinancialContent` (incluye assignPages best-effort).
- Reemplazar chunks del doc en transacción; re-embed bulk; stamp `embedding_model` + `chunk_type` + `page` donde haya.
- Por lotes, idempotente, con snapshot de conteos por doc para rollback.

---

## Meta — Ingesta congelada (fuera de sanitización)
La cola durable (`knowledge_ingest_jobs`, 0 filas) está construida pero **inerte hasta el deploy de `188042f`** (gate: confirmar `CRON_SECRET` en Vercel). Hoy no entra ningún doc nuevo salvo path legacy. Es una **decisión de deploy** ya documentada ("Secuencia segura de deploy"), no un problema de datos. Recomendación: tratarla por separado del trabajo de fondo.

---

## Secuencia propuesta
1. **A1, A3, A5** ya (additivos/reversibles, sin gate). 
2. **A2** (índice único) y **A4** tras ver colisiones / definir filtro.
3. **B0 eval** → decide B.
4. **B1** solo si eval verde, sobre subset.
5. Ingesta/deploy = pista aparte (CRON_SECRET).

Riesgo global: bajo en A. B acotado y con gate. Nada borra contenido único; todo con snapshot/rollback.
