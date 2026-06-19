# Chat, RAG e Ingesta - Memoria Operativa

Fecha de estado: 2026-06-04

Actualizacion principal: 2026-06-19

Repositorio: `moimene/gemswell-mis`

Commits de cierre:

- `be8b766 Consolidate RAG ingestion governance`
- `8a63c1c Fix Gemini REST embeddings fallback`

Este documento conserva la memoria operativa del estado actual del chat documental, RAG, ingesta, documentos de memoria y convergencia con MDL/Teras. Debe leerse junto a:

- `docs/knowledge-system.md`
- `docs/knowledge-convergence-functional-spec.md`
- `docs/chat-rag-ingest-status-vs-mdl.md`
- `docs/architecture/layer3-evidence-reconciliation.md`

## Resumen Ejecutivo

El sistema de chat documental de Gemswell queda en estado funcional verificable para continuar evolucionando.

El avance principal ya no es solo arquitectonico: se aplico la migracion de gobierno documental, se probaron ingestas reales, se corrigio el fallback REST de Gemini embeddings, se crearon indices full-text y se verifico que la busqueda documental devuelve metadatos de revision y fuente.

El proximo bloque no debe ser una reescritura completa. Debe ser una evolucion controlada:

1. Procesar la cola restante en modo conservador.
2. Llevar este contrato de gobierno documental a MDL/Teras.
3. Convertir el chat de MDL/Teras a herramientas explicitas.
4. Portar a MDL/Teras la verificacion visual de fuentes y el evidence linking.
5. Portar desde MDL/Teras a Gemswell su harness mas maduro de upload, Drive, Gmail bot, OCR y jobs.

## Actualizacion 2026-06-19 - SharePoint ZIP Corpus Refresh

El refresco documental completo desde SharePoint se ejecuto mediante fallback local de ZIPs exportados/sincronizados por el usuario. No existia conector Graph en el repo y no habia credenciales de Azure AD disponibles, por lo que no se construyo un conector Microsoft Graph en esta pasada.

Runbook detallado:

- `docs/sharepoint-rag-ingestion-runbook-2026-06-19.md`

Memoria rapida nueva:

- `MEMORY.md`

Reportes finales:

- `docs/reports/sharepoint-local-reconcile-final-after-ingest.json`
- `docs/reports/sharepoint-local-reconcile-final-after-ingest.csv`
- `docs/reports/sharepoint-local-large-final-errors.json`

Estado final de reconciliacion:

- Inventario SharePoint local: `2120` ficheros.
- `enqueueable=0`.
- `already_indexed_hash=1451`.
- `legacy_title_match=285`.
- `duplicate_content_superseded=37`.
- `failed_unextractable=22` rutas / `20` documentos unicos.
- `unsupported=283`.
- `duplicate_in_batch=31`.
- `job_exists=11`.

Estado final de cola:

- `queued=0`.
- `processing=0`.
- `done=1366`.
- `error=24`.
- `canceled=1`.

Estado final del corpus consultado el 2026-06-19:

- `rag_documents=6895`.
- `rag_chunks=213438`.
- `knowledge_corpus_health()` actualizado con `sql/036_corpus_health_knowledge_ingest_jobs.sql`;
  el dashboard lee `knowledge_ingest_jobs`, no `ingest_queue`.
- Dashboard/chat: `approved=3477`, `needs_review=1368`, `source_of_record=814`.
- `rag_documents.status='indexed'`: `6881`.
- `rag_documents.status='processing'`: `0`.
- `rag_documents.status='error'`: `12`.

Fallos materiales confirmados:

- `17` documentos sin texto util extraible despues de parse local.
- `3` PDFs corruptos o con estructura invalida.
- `2` PDFs cifrados/password.
- Los dos PDFs gigantes que quedaban fuera del limite normal se registraron como `rag_documents.status='error'` con `source_hash`, de forma que futuras reconciliaciones no vuelvan a marcarlos como pendientes.

Herramientas creadas:

- `npm run sharepoint:reconcile` -> inventario/diff local SharePoint ZIP contra `rag_documents` + subida/cola con `--apply`.
- `npm run sharepoint:ingest-large` -> ingesta local de PDF/PPTX >50 MB con `sourceHashOverride` y registro de errores terminales.
- `npm run ingest:jobs-loop` -> worker local de `knowledge_ingest_jobs`.
- `npm run ingest:jobs-direct` -> recuperacion directa de jobs existentes desde Storage para `processing` vencidos o errores por cuota.

Cambios de pipeline relevantes:

- `src/lib/rag/parse.ts` soporta fallback local con `RAG_LOCAL_PARSE_FALLBACK=force`.
- Fallback local cubre PDF (`pdftotext`), PPTX/DOCX (`7z` XML), DOC (`textutil`), TXT/CSV y XLS/XLSX.
- `src/lib/ingest/jobs.ts` acepta `.doc` y usa lease de 2 horas.
- `src/lib/ingest/queue-processor.ts` permite backfills controlados con `sourceHashOverride`, `parsedContentOverride`, `parserOverride` y `ocrUsedOverride`; no debe usarse para saltarse gobierno.

Reglas operativas nuevas:

- No reingestar `legacy_title_match` por defecto; es proteccion contra duplicados del corpus legacy con `source_hash NULL`.
- No reintentar `failed_unextractable` sin corregir fuente: OCR, password, o reemplazo por PDF valido.
- No reingestar `duplicate_content_superseded` salvo cambio deliberado de politica de deduplicacion.
- Usar `RAG_LOCAL_PARSE_FALLBACK=force` cuando LlamaParse o clasificacion LLM esten sin cuota; la ingesta puede completarse con parser local + gobierno por reglas.
- No marcar jobs `done` manualmente si `ingestBuffer` no devolvio exito o si no se verifico un documento `indexed` con chunks y hash/proyecto correcto.

## Frontera Del Sistema

El sistema se divide en dos contextos:

- Knowledge System: chat, RAG, ingesta, markdown artifacts, evidencia, verificacion documental.
- Tower Control: dashboards operativos, vistas financieras, KPIs, gestion ejecutiva.

La separacion esta documentada en `docs/knowledge-system.md`.

Regla de frontera:

- Tower Control puede consumir hechos ya publicados o datos estructurados.
- Knowledge System debe ser dueno de ingestion, retrieval, prompts, source cards, revision documental y trazabilidad.
- Las respuestas criticas del bot no deben apoyarse en documentos rechazados o sin estado claro.

## Estado Del Chat

Archivos clave:

- `src/app/api/chat/route.ts`
- `src/app/chat/page.tsx`
- `src/lib/knowledge/source-reference.ts`
- `src/lib/intel/grounding.ts`
- `src/lib/rag/rerank.ts`
- `src/lib/rag/embeddings.ts`

Estado actual:

- El chat funciona con tool loop, no solo con contexto monolitico.
- La herramienta `search_documents` combina busqueda vectorial y keyword.
- La busqueda vectorial llama a `match_chunks`.
- La busqueda keyword llama a `keyword_search_chunks`.
- Ambas rutas reciben metadata gobernada desde `rag_documents` via RPC.
- El chat filtra o degrada fuentes no aprobadas.
- Las source cards ya interpretan:
  - `review_status`
  - `classification_source`
  - `authority_tier`
  - `authority_score`
  - `md_path`
  - `source_channel`

Reglas de seguridad actuales:

- `review_status = rejected` queda excluido.
- `classification_source = agent_rejected` queda excluido.
- `pending` y `needs_review` se degradan en relevancia.
- Una fuente solo puede ser `source_of_record` si esta `approved`.
- Las fuentes no aprobadas no se promocionan silenciosamente como verdad.

## Estado RAG Y Busqueda

SQL aplicado:

- `sql/004_knowledge_convergence_governance.sql`

Cambios ya aplicados en Supabase:

- Nuevas columnas de gobierno en `rag_documents`.
- Indice unico parcial por `source_hash`.
- Indices de gobierno en `rag_documents`.
- RPC `match_chunks` actualizada con join a `rag_documents`.
- RPC `keyword_search_chunks` actualizada con join a `rag_documents`.
- Indice GIN full-text:
  - `idx_rag_chunks_fts_simple`
- Indices metadata:
  - `idx_rag_chunks_metadata_project_id`
  - `idx_rag_chunks_metadata_doc_type`

Verificacion operativa:

- `keyword_search_chunks` para `Nominal Ledger` en `BHX` respondio en `210 ms`.
- `keyword_search_chunks` para `Birmingham` dejo de dar timeout tras crear indices.
- `match_chunks` fue validado reutilizando un embedding existente y devolvio metadata gobernada.

## Estado Ingesta

Archivos clave:

- `src/lib/ingest/queue-processor.ts`
- `src/app/api/ingest/process/route.ts`
- `src/app/api/ingest/queue/route.ts`
- `scripts/ingest-worker.mjs`
- `src/lib/rag/parse.ts`
- `src/lib/rag/embeddings.ts`
- `src/lib/knowledge/markdown-artifact.ts`

Estado actual:

- `/api/ingest/process` es el ejecutor canonico.
- `scripts/ingest-worker.mjs` conduce la API, no duplica la logica principal.
- El endpoint permite `itemId` para procesar un item concreto sin alterar toda la cola.
- La ingesta reserva `rag_documents` antes de parsear.
- Se calcula `source_hash` SHA-256.
- Si el documento ya existe por `source_hash`, se reutiliza y se limpian chunks anteriores.
- Se genera markdown artifact con frontmatter.
- Se guarda `md_path` en `rag_documents`.
- Los chunks reciben metadata de gobierno.
- Los embeddings se generan con throttling, retry y fallback REST.

Regla fail-closed nueva:

- Si embeddings falla parcialmente, el documento no se marca como `done`.
- Si `insertedChunks !== chunks.length`, la ingesta lanza error.
- En error, se eliminan chunks parciales y `rag_documents.status` queda `error`.

## Gemini Embeddings

Modelo:

- `gemini-embedding-001`

Dimension objetivo:

- `768`

Problema detectado:

- El SDK y/o llamadas concurrentes pueden disparar `429 RESOURCE_EXHAUSTED`.
- El codigo previo hacia `Promise.all` por lote, provocando rafagas.

Mitigacion aplicada:

- Throttle global entre llamadas.
- Backoff exponencial con jitter.
- `embedBatch` real para lotes.
- Transporte REST directo para llamadas individuales.
- Variable para forzar REST secuencial:
  - `GEMINI_EMBEDDING_TRANSPORT=rest`

Configuracion operativa conservadora:

```bash
GEMINI_EMBEDDING_TRANSPORT=rest
GEMINI_EMBEDDING_MIN_INTERVAL_MS=5000
INGEST_EMBEDDING_BATCH_SIZE=1
GEMINI_EMBEDDING_MAX_RETRIES=5
GEMINI_EMBEDDING_BASE_DELAY_MS=2000
```

Detalle importante:

- El endpoint REST `embedContent` no acepta `config`.
- Para obtener 768 dimensiones en REST, el payload probado debe usar `outputDimensionality` top-level.
- `embedContentConfig` devolvio 3072 dimensiones en la prueba local; no se debe usar en este fallback hasta nueva verificacion.

## LlamaParse

Estado:

- Operativo.
- La clave esta configurada.
- La prueba real con Excel funciono.
- Se verifico que el endpoint actual de lectura de LlamaCloud respondia `200`.

Documentos parseados:

- `Balance sheet - Feb 26.xlsx`
- `Nominal Ledger - Apr to Jun 25.xlsx`

Limitacion:

- No se ha confirmado saldo exacto de cuota desde API.
- La cuota exacta debe verificarse en dashboard LlamaCloud.

## Documentos Ingeridos En Prueba

### Balance sheet - Feb 26.xlsx

- `rag_documents.id`: `398e060c-0aed-4c44-957d-d57c6d6669b4`
- Estado: `indexed`
- Chunks: `2`
- Parser: `llamaparse`
- Review: `approved`
- Classification source: `rule`
- Markdown artifact: `artifacts/398e060c-0aed-4c44-957d-d57c6d6669b4/v1.md`

### Nominal Ledger - Apr to Jun 25.xlsx

- `rag_documents.id`: `d0cae3ff-7684-4047-a54c-ced8ff9648b4`
- Estado: `indexed`
- Chunks: `4`
- Parser: `llamaparse`
- Review: `approved`
- Classification source: `rule`
- Markdown artifact: `artifacts/d0cae3ff-7684-4047-a54c-ced8ff9648b4/v1.md`

## Estado Cola Ingesta

Foto tomada el 2026-06-04 despues del cierre operativo:

- `queued`: `267`
- `processing`: `0`
- `done`: `2406`
- `error`: `2`

Interpretacion:

- No hay jobs atascados en `processing`.
- La saturacion actual es volumen pendiente y cuota/rate-limit de embeddings.
- La ingesta no debe reanudarse en modo masivo sin throttling.

## Documentos De Memoria Del Proyecto

### `docs/knowledge-system.md`

Define la frontera del Knowledge System frente a Tower Control.

Debe ser el primer documento de orientacion para cualquier nueva conversacion sobre chat, RAG, ingesta, evidencia o verificacion documental.

### `docs/knowledge-convergence-functional-spec.md`

SPEC funcional de convergencia Gemswell vs MDL/Teras.

Es la baseline de revision por documentalista experto. Define:

- intake contract
- document labels
- canonical document
- markdown artifact
- chunk contract
- chat contract
- source cards
- evidence linking
- matriz de cobertura

### `docs/chat-rag-ingest-status-vs-mdl.md`

Comparativa extensa Gemswell vs MDL/Teras.

Advertencia: parte del estado de ese documento es anterior al cierre operativo del 2026-06-04. Para estado actual debe prevalecer esta memoria.

### `docs/architecture/layer3-evidence-reconciliation.md`

Documento de arquitectura para reconciliacion, evidencia y cobertura Layer 3.

Debe reutilizarse para portar evidence linking a MDL/Teras.

### `docs/chat-rag-ingest-memory-state-2026-06-04.md`

Este documento.

Debe funcionar como memoria compacta y actualizada para reanudar el trabajo.

## Estado MDL/Teras Para Convergencia

MDL/Teras debe recibir de Gemswell:

- contratos `src/lib/knowledge/contracts.ts`
- source verification `src/lib/knowledge/source-reference.ts`
- modelo de chat con tools explicitas
- RPC/queries que inyecten governance desde documento padre
- markdown artifact frontmatter
- reglas fail-closed de revision documental
- evidence linking Layer 3

Gemswell debe recibir de MDL/Teras:

- harness de upload, Drive y Gmail bot
- reserva documental mas madura
- jobs asincronos y estados mas ricos
- OCR/fallbacks
- chunking heading-aware
- clasificacion documental por dominio
- reprocess/stuck-job tooling

## Siguiente Secuencia Recomendada

### 1. Continuar cola Gemswell de forma controlada

Procesar solo batches pequenos:

```bash
GEMINI_EMBEDDING_TRANSPORT=rest \
GEMINI_EMBEDDING_MIN_INTERVAL_MS=5000 \
INGEST_EMBEDDING_BATCH_SIZE=1 \
npm run dev
```

Luego:

```bash
curl -X POST http://localhost:3000/api/ingest/process \
  -H 'Content-Type: application/json' \
  -d '{"batchSize":1}'
```

Subir gradualmente solo si no hay `429`.

### 2. Crear herramientas MDL/Teras

Convertir el chat MDL/Teras desde contexto estructurado monolitico a tool loop:

- `search_documents`
- `get_document`
- `get_document_evidence`
- `get_review_queue`
- `get_canonical_document`
- herramientas especificas de dominio MDL

### 3. Normalizar contratos

Portar o adaptar:

- `KnowledgeIntakeItem`
- `DocumentLabels`
- `CanonicalDocument`
- markdown frontmatter
- source cards

### 4. Unificar estados de revision

Estados minimos:

- `pending`
- `needs_review`
- `approved`
- `rejected`

Regla:

- Todo bot/upload/email sin revision humana debe entrar en `pending` o `needs_review`, salvo regla explicita aprobada.

### 5. Preparar documento de auditoria documental

Para cada respuesta del chat debe poder trazarse:

chat answer -> source card -> chunk -> document -> markdown artifact -> original source -> review state

## Riesgos Pendientes

- Quota/rate-limit de Gemini puede volver si se sube batch sin throttling.
- No hay todavia scheduler robusto para procesar 267 pendientes.
- La estrategia de LlamaParse cuota exacta depende de dashboard.
- Los dos errores historicos de LlamaParse siguen en cola con `error`.
- `scripts/ingest-dms.mjs` y `scripts/ingest-key-docs.mjs` aun deben revisarse para no reintroducir ingesta directa legacy.
- MDL/Teras todavia no ha recibido estos contratos.

## Definicion De Listo Para El Proximo Hito

El siguiente hito se considera listo cuando:

- 20 documentos adicionales se procesen sin 429 ni chunks parciales.
- `keyword_search_chunks` y `match_chunks` funcionen con source cards gobernadas.
- El chat cite fuentes con review status visible.
- MDL/Teras tenga un primer branch con contratos compartidos y prompt/tool plan.
- El documentalista pueda revisar una respuesta desde el chat hasta el markdown artifact.
