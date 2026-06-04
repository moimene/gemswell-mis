# Estado Comparativo: Chat, RAG e Ingesta vs MDL/Teras

Fecha de corte: 2026-06-04

## Objetivo

Este documento resume el estado funcional de Gemswell MIS frente a MDL/Teras en tres frentes:

- Chat documental.
- RAG, markdown y vector DB.
- Ingesta y gestion documental.

La finalidad es identificar que capacidades estan consolidadas, que piezas de MDL/Teras conviene portar, que piezas de Gemswell conviene portar a MDL/Teras, y que gaps quedan para converger ambos sistemas bajo el `Knowledge Convergence Functional SPEC`.

## Resumen Ejecutivo

Gemswell y MDL/Teras tienen fortalezas complementarias.

Gemswell esta mas avanzado en arquitectura conversacional auditable: chat con tool loop, herramientas explicitas, `tool_calls`, source cards y una capa de evidencia/revision tipo Layer 3.

MDL/Teras esta mas avanzado en harness operativo de ingesta: Gmail bot, Inngest, jobs, reserva documental, clasificacion, conversion, OCR, markdown publish y embeddings batch.

La convergencia deseada es:

- Gemswell adopta mas disciplina operativa de ingesta de MDL/Teras.
- MDL/Teras adopta mas disciplina conversacional y de source verification de Gemswell.
- Ambos comparten contratos de conocimiento: intake, labels, documento canonico, markdown, chunks, governance y review.

## Semaforo General

| Frente | Gemswell | MDL/Teras | Lectura |
| --- | --- | --- | --- |
| Chat agentico | Alto | Medio | Gemswell tiene mejor tool loop y auditoria de llamadas. |
| Contexto estructurado | Medio | Alto | MDL/Teras tiene mejor motor de dominio y look-through. |
| Source verification | Alto | Medio | Gemswell ya degrada fuentes no aprobadas y expone verificacion. |
| Ingesta operacional | Medio | Alto | MDL/Teras tiene mejor harness de jobs, Gmail e Inngest. |
| Markdown artifact | Medio | Alto | Gemswell acaba de anadirlo; MDL/Teras lo tiene mas integrado en el harness. |
| Chunking | Medio | Alto | MDL/Teras tiene chunking markdown heading-aware; Gemswell conserva chunking financiero. |
| OCR/fallbacks | Bajo | Alto | MDL/Teras tiene adapter OCR Mistral y calidad de conversion. |
| Evidencia/fact linking | Alto | Medio | Gemswell tiene Layer 3 mas completo; MDL/Teras tiene suggestions/review parciales. |
| Schema governance | Medio | Alto | Gemswell tiene SQL revisable pendiente; MDL/Teras tiene migraciones mas completas. |
| Tests/evals | Bajo | Medio | Ambos necesitan eval set documental, smoke tests y corpus minimo. |

## Estado Gemswell

### 1. Chat Documental

Estado: alto, con gaps de runtime/evaluacion.

Archivos clave:

- `src/app/api/chat/route.ts`
- `src/app/chat/page.tsx`
- `src/lib/knowledge/source-reference.ts`
- `src/lib/knowledge/contracts.ts`

Capacidades consolidadas:

- Chat basado en tool loop con Anthropic.
- Herramientas explicitas:
  - `search_documents`
  - `get_capex_summary`
  - `get_funding_status`
  - `get_cash_runway`
  - `get_covenant_status`
  - `get_risk_register`
  - `compare_projects`
- Auditoria de llamadas mediante `toolCalls`.
- Persistencia de fuentes y `tool_calls` en `rag_messages`.
- Source cards normalizadas por `buildKnowledgeSource`.
- Filtro defensivo en aplicacion para excluir fuentes con `review_status = rejected` o `classification_source = agent_rejected`.
- Penalizacion de fuentes `pending` / `needs_review`.
- Advertencia cognitiva al modelo cuando una fuente procede de agente y no esta aprobada.
- Verificacion documental basada en autoridad mas estado de revision:
  - `source_of_record` exige autoridad alta y `review_status = approved`.
  - fuentes pendientes se degradan a contexto.

Gaps:

- El SQL `004_knowledge_convergence_governance.sql` esta creado pero no aplicado contra Supabase.
- Mientras el SQL no este aplicado, la gobernanza live desde `rag_documents` no entra automaticamente via RPC; solo funcionara si los chunks ya traen metadata.
- El system prompt sigue conteniendo bastante conocimiento hardcoded de Gemswell.
- No hay eval set recurrente de preguntas criticas con fuentes esperadas.
- No hay todavia herramienta tipo `get_document_status`, `get_document_inventory` o `compare_sources`.

### 2. RAG, Parseo, Chunking y Embeddings

Estado: medio.

Archivos clave:

- `src/lib/rag/parse.ts`
- `src/lib/rag/embeddings.ts`
- `src/lib/rag/rerank.ts`
- `src/lib/knowledge/markdown-artifact.ts`
- `sql/004_knowledge_convergence_governance.sql`

Capacidades consolidadas:

- Parser principal: LlamaParse premium.
- Fallback local para Excel.
- Instrucciones de parsing orientadas a documentos financieros.
- Embedding con Gemini 768 dimensiones.
- Validacion de dimensiones antes de insertar chunks.
- Reranking con Cohere.
- Busqueda hibrida: vector + keyword.
- Normalizacion de `doc_type` en el chat.
- Metadata enriquecida para chunks:
  - `document_id`
  - `source_hash`
  - `source_channel`
  - `review_status`
  - `classification_source`
  - `lifecycle`
  - `authority_tier`
  - `authority_score`
  - `parser_used`
  - `ocr_used`
  - `md_path`

Cambios recientes:

- Se anadio `buildMarkdownArtifact`.
- El pipeline genera un markdown con frontmatter despues del parseo.
- El chunking ahora se realiza sobre el markdown final con frontmatter.
- Se intenta subir el markdown a Storage en `artifacts/{documentId}/v1.md`.
- La subida del artifact no bloquea la ingesta si el bucket o columnas `md_*` no estan listos.

Gaps:

- Chunking de Gemswell sigue siendo financiero/paragraph-aware, no plenamente heading-aware como MDL/Teras.
- No hay OCR fallback para PDFs escaneados o imagenes.
- No hay medicion de calidad del parseo.
- No esta probado con ingesta real posterior al cambio de markdown artifact.
- El bucket de artifacts debe confirmarse (`KNOWLEDGE_ARTIFACT_BUCKET` o `documents`).
- La migracion SQL de gobernanza debe revisarse contra la firma real de los RPC existentes.

### 3. Ingesta y Gestion Documental

Estado: medio.

Archivos clave:

- `src/lib/ingest/queue-processor.ts`
- `src/app/api/ingest/queue/route.ts`
- `src/app/api/ingest/process/route.ts`
- `scripts/ingest-worker.mjs`
- `scripts/ingest-dms.mjs`
- `scripts/ingest-key-docs.mjs`
- `src/lib/knowledge/contracts.ts`

Capacidades consolidadas:

- La ingesta por cola tiene un procesador unico en `queue-processor.ts`.
- `/api/ingest/process` es el ejecutor canonico.
- `scripts/ingest-worker.mjs` conduce la API, reduciendo duplicacion.
- Reserva temprana de `rag_documents` antes del parseo.
- SHA-256 `source_hash` calculado antes del parseo.
- Si existe `source_hash` duplicado y la migracion esta aplicada, puede reutilizar documento y limpiar chunks previos.
- Fallback legacy si las columnas nuevas aun no existen.
- Markdown artifact se genera dentro del mismo pipeline.

Gaps:

- `scripts/ingest-dms.mjs` y `scripts/ingest-key-docs.mjs` aun contienen logica legacy directa.
- Gemswell no tiene todavia adaptadores maduros de:
  - browser upload
  - Drive sync
  - Gmail bot dedicado
  - Inngest
- La clasificacion actual es basicamente por cola/folder metadata, no por clasificador LLM + review.
- No hay job table tan completa como `agent_attachment_jobs` de MDL/Teras.
- No hay workflow events.
- No hay reprocess/stuck-job script equivalente al de MDL/Teras.

### 4. Evidencia, Review y Fact Linking

Estado: alto en diseno, medio en ejecucion operativa.

Archivos clave:

- `sql/003_layer3_evidence_reconciliation.sql`
- `src/lib/intel/grounding.ts`
- `src/app/api/intel/candidates/route.ts`
- `src/app/api/intel/review/route.ts`
- `src/app/api/intel/packs/[id]/route.ts`
- `src/app/api/intel/stats/route.ts`
- `src/app/admin/review/page.tsx`
- `src/app/admin/packs/page.tsx`
- `src/app/admin/packs/[id]/page.tsx`

Capacidades consolidadas:

- Capa Layer 3 definida:
  - `intel_metric_definition`
  - `intel_doc_authority`
  - `intel_metric_candidate`
  - `intel_review_decision`
  - `intel_fact_publication`
  - `intel_fact_source_link`
  - `intel_contradiction_alert`
- APIs para candidatos, review, packs y stats.
- `grounding.ts` normaliza metadata desde chunks y documentos.
- Se extendio `GroundedDocument` con:
  - `authority_tier`
  - `lifecycle`
  - `review_status`
  - `classification_source`

Gaps:

- Extraccion automatica de metricas aun no esta cerrada como pipeline.
- La publicacion a fact tables requiere validacion funcional.
- Contradiction alerts requieren pruebas con corpus real.
- Las pantallas de review necesitan validar UX con documentalista.

## Estado MDL/Teras

### 1. Chat Documental

Estado: medio-alto, con deuda arquitectonica.

Archivos clave:

- `/Users/moisesmenendez/Dropbox/DESARROLLO/mdl-patrimonio/src/app/api/chat/route.ts`
- `/Users/moisesmenendez/Dropbox/DESARROLLO/mdl-patrimonio/src/app/chat/page.tsx`
- `/Users/moisesmenendez/Dropbox/DESARROLLO/mdl-patrimonio/src/lib/domain/information-context.ts`

Capacidades consolidadas:

- Motor de contexto estructurado muy superior al de Gemswell.
- `buildChatStructuredContext` compone:
  - entidades
  - business lines
  - participaciones
  - intragrupo
  - look-through
  - discrepancias
  - inventario documental
- Prompt con reglas fuertes para documentos:
  - humano
  - bot aprobado
  - bot corregido
  - bot sin revisar
  - bot rechazado
- Scope server-side para limitar corpus por business line.
- Always-retrieve para documentos criticos.
- Graph search opcional.

Gaps:

- Arquitectura monolitica: se inyecta mucho contexto en un unico prompt.
- No hay tool loop equivalente al de Gemswell.
- No se guardan `tool_calls` porque no hay herramientas explicitas.
- Source cards no tienen la misma verificacion formal que Gemswell.
- La gobernanza vive mas en prompt que en retrieval/tool contracts.

### 2. RAG, Parseo, Chunking y Embeddings

Estado: alto en harness nuevo, medio por duplicacion legacy.

Archivos clave:

- `/Users/moisesmenendez/Dropbox/DESARROLLO/mdl-patrimonio/src/lib/rag/embeddings.ts`
- `/Users/moisesmenendez/Dropbox/DESARROLLO/mdl-patrimonio/src/lib/rag/ingest.ts`
- `/Users/moisesmenendez/Dropbox/DESARROLLO/mdl-patrimonio/src/lib/rag/extract.ts`
- `/Users/moisesmenendez/Dropbox/DESARROLLO/mdl-patrimonio/src/lib/rag/rerank.ts`
- `/Users/moisesmenendez/Dropbox/DESARROLLO/mdl-patrimonio/src/lib/rag/graph.ts`
- `/Users/moisesmenendez/Dropbox/DESARROLLO/mdl-patrimonio/src/lib/agent/embed.ts`
- `/Users/moisesmenendez/Dropbox/DESARROLLO/mdl-patrimonio/src/lib/agent/convert.ts`
- `/Users/moisesmenendez/Dropbox/DESARROLLO/mdl-patrimonio/src/lib/agent/ocr.ts`

Capacidades consolidadas:

- Chunking markdown heading-aware en `src/lib/agent/embed.ts`.
- Respeta tablas y code fences.
- Embeddings batch con Retry-After.
- Conversion nativa para DOCX/XLSX/PPTX/PDF.
- Quality gates para parseo.
- OCR fallback con Mistral.
- Graph RAG opcional.
- RPC `match_chunks_filtered` por business line.

Gaps:

- Conviven RAG legacy y harness nuevo.
- `/api/ingest-document` todavia tiene riesgo: descarga Storage y usa `fileData.text()` para binarios.
- `upload`, `drive`, `ingest-document`, `ingest` y `process-attachment` no estan completamente normalizados en un unico contrato.
- Hay deuda de modelo/embedding entre paths historicos y nuevos.

### 3. Ingesta y Gestion Documental

Estado: alto.

Archivos clave:

- `/Users/moisesmenendez/Dropbox/DESARROLLO/mdl-patrimonio/src/inngest/functions/process-attachment.ts`
- `/Users/moisesmenendez/Dropbox/DESARROLLO/mdl-patrimonio/src/inngest/functions/poll-inbox.ts`
- `/Users/moisesmenendez/Dropbox/DESARROLLO/mdl-patrimonio/src/app/api/agent/poll-inbox/route.ts`
- `/Users/moisesmenendez/Dropbox/DESARROLLO/mdl-patrimonio/src/app/api/agent/ingest-email/route.ts`
- `/Users/moisesmenendez/Dropbox/DESARROLLO/mdl-patrimonio/src/app/api/upload/route.ts`
- `/Users/moisesmenendez/Dropbox/DESARROLLO/mdl-patrimonio/src/app/api/drive/route.ts`
- `/Users/moisesmenendez/Dropbox/DESARROLLO/mdl-patrimonio/src/lib/agent/reserve.ts`
- `/Users/moisesmenendez/Dropbox/DESARROLLO/mdl-patrimonio/src/lib/agent/classify.ts`
- `/Users/moisesmenendez/Dropbox/DESARROLLO/mdl-patrimonio/src/lib/agent/publish.ts`

Capacidades consolidadas:

- Gmail bot / poll inbox.
- Inngest workflow.
- `agent_attachment_jobs`.
- Idempotencia por attachment/source hash.
- Reserva temprana de `bl_documents`.
- Clasificacion con Claude Haiku.
- Estados de review.
- Conversion, OCR, markdown publish y embeddings.
- Workflow events.
- Scripts de smoke y reprocess.

Gaps:

- Algunas rutas legacy siguen ingiriendo directamente.
- La clasificacion y reserva del harness nuevo no gobiernan todavia todos los origenes.
- Hay fallback a anon/service key que debe endurecerse segun entorno.
- Falta trasladar a MDL/Teras el modelo completo de evidence/fact linking de Gemswell.

### 4. Schema y Gobernanza

Estado: alto.

Archivos clave:

- `/Users/moisesmenendez/Dropbox/DESARROLLO/mdl-patrimonio/supabase/migrations/20260608_002_agent_attachment_jobs.sql`
- `/Users/moisesmenendez/Dropbox/DESARROLLO/mdl-patrimonio/supabase/migrations/20260608_003_bl_documents_extensions.sql`
- `/Users/moisesmenendez/Dropbox/DESARROLLO/mdl-patrimonio/supabase/migrations/20260608_004_rag_chunks_extend.sql`
- `/Users/moisesmenendez/Dropbox/DESARROLLO/mdl-patrimonio/supabase/migrations/20260608_005_agent_workflow_events.sql`
- `/Users/moisesmenendez/Dropbox/DESARROLLO/mdl-patrimonio/supabase/migrations/20260611_011_match_chunks_filtered.sql`

Capacidades consolidadas:

- `bl_documents` extendido con metadata documental.
- `rag_chunks` extendido con campos de documento, BL, doc type, hash, section, page, embedding model.
- Job table operativa.
- Workflow events.
- RPC filtrado.

Gaps:

- Falta unificar nomenclatura con `KnowledgeIntakeItem` / `DocumentLabels`.
- Falta Layer 3 tipo Gemswell para candidates, contradictions y fact publication.
- Falta source verification UI equivalente a Gemswell.

## Comparativa Por Contrato Del SPEC

| Contrato | Gemswell | MDL/Teras | Gap principal |
| --- | --- | --- | --- |
| `KnowledgeIntakeItem` | Tipos creados; cola local parcial | Concepto operativo en agent harness | Usar el contrato en todos los adapters de ambos repos. |
| `DocumentLabels` | Tipos creados; source cards consumen governance | Clasificador real avanzado | Portar clasificador MDL a Gemswell; portar source verification a MDL. |
| Documento canonico | `rag_documents` reservado antes del parseo | `bl_documents` reservado antes del pipeline | Alinear campos y versionado. |
| Markdown artifact | Helper y subida no bloqueante implementados | Publish markdown en harness | Probar Storage y versionado; decidir bucket/repositorio. |
| RAG chunks | Metadata enriquecida, chunking financiero | Metadata fuerte y heading-aware | Portar heading-aware a Gemswell. |
| RPC governance | SQL `004` creado, pendiente aplicar | RPC filtrado por BL | Aplicar governance JOIN en ambos RPCs. |
| Chat contract | Tool loop fuerte | Contexto estructurado fuerte | Convertir MDL a tools; anadir herramientas documentales a Gemswell. |
| Evidence linking | Layer 3 mas completo | Suggestions/review parcial | Adaptar Layer 3 a MDL/Teras. |

## Riesgos Actuales

### Riesgos Gemswell

- SQL `004` no aplicado: el chat tiene defensa en aplicacion, pero no governance live desde parent document.
- Markdown artifact no probado con una ingesta real.
- Sin OCR fallback: documentos escaneados pueden fallar o generar baja calidad.
- Scripts legacy pueden saltarse el nuevo pipeline.
- Clasificacion documental todavia no es suficientemente rica.

### Riesgos MDL/Teras

- Chat monolitico: buen contexto, poca trazabilidad de decisiones del modelo.
- Paths legacy pueden saltarse el harness nuevo.
- `/api/ingest-document` puede tratar binarios como texto.
- Source verification depende mas del prompt que de un contrato formal.
- No hay fact publication / contradiction layer tan fuerte como Gemswell.

## Recomendacion De Convergencia

### Corto Plazo

1. Aplicar/revisar `sql/004_knowledge_convergence_governance.sql` en Gemswell.
2. Procesar un documento pequeno en Gemswell y validar:
   - `source_hash`
   - `rag_documents` reservado antes del parseo
   - markdown artifact en Storage
   - metadata de chunks
   - source card en chat
3. Portar `src/lib/knowledge/source-reference.ts` a MDL/Teras.
4. Portar `src/lib/knowledge/contracts.ts` a MDL/Teras.
5. Marcar los scripts legacy de Gemswell como queue-population-only o retirarlos.

### Medio Plazo

1. Portar chunking heading-aware de MDL/Teras a Gemswell.
2. Portar OCR fallback de MDL/Teras a Gemswell.
3. Convertir el chat MDL/Teras a herramientas explicitas:
   - `search_documents`
   - `get_structured_context`
   - `get_document_inventory`
   - `get_document_status`
   - `compare_sources`
4. Adaptar Layer 3 de Gemswell a MDL/Teras:
   - candidates
   - decisions
   - publications
   - contradictions
   - fact-source links

### Largo Plazo

1. Crear un paquete compartido o duplicado controlado de contratos.
2. Crear un corpus minimo de evaluacion comun.
3. Crear eval set recurrente de preguntas criticas.
4. Unificar semantica de review:
   - `pending`
   - `approved`
   - `rejected`
   - `needs_review`
5. Definir politica de fail-closed para scopes sin business line/project.

## Estado De Implementacion En Gemswell Tras Ultimos Cortes

Implementado en codigo:

- `docs/knowledge-convergence-functional-spec.md`
- `src/lib/knowledge/contracts.ts`
- `src/lib/knowledge/source-reference.ts`
- `src/lib/knowledge/markdown-artifact.ts`
- `src/lib/ingest/queue-processor.ts`
- `src/lib/intel/grounding.ts`
- `src/app/api/chat/route.ts`
- `src/lib/rag/embeddings.ts`
- `sql/004_knowledge_convergence_governance.sql`

Validado localmente:

- `npm run lint`
- `npm run build`

Pendiente de validar en runtime:

- Aplicacion SQL `004`.
- Una ingesta real con markdown artifact.
- Busqueda chat leyendo governance desde RPC.
- Visualizacion final en source cards con `review_status`.
- Comportamiento con documento `rejected`.

## Conclusion

Gemswell esta listo para convertirse en el repositorio base de la arquitectura conversacional verificable. MDL/Teras esta listo para convertirse en la referencia de harness de ingesta documental.

La convergencia debe seguir esta regla:

- Gemswell no debe copiar la ingesta legacy de MDL/Teras.
- MDL/Teras no debe copiar el prompt monolitico de Gemswell.
- Ambos deben compartir contratos, estados, labels y semantica de fuente.

El siguiente hito operativo debe ser una prueba end-to-end en Gemswell: cola -> reserva -> parseo -> markdown artifact -> chunks -> embeddings -> chat -> source card.

