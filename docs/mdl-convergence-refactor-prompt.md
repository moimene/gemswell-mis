# Prompt Maestro Para Iniciar La Convergencia En MDL/Teras

Uso previsto: pegar este prompt en una nueva conversacion de Codex/ChatGPT trabajando dentro del repo MDL/Teras, preferiblemente con `cwd` en:

`/Users/moisesmenendez/Dropbox/DESARROLLO/mdl-patrimonio`

Objetivo: iniciar una refactorizacion completa, incremental y verificable del chat documental, ingesta, RAG, markdown artifacts, clasificacion, revision y evidencia, tomando como baseline el trabajo cerrado en Gemswell MIS.

## Prompt

```text
Quiero iniciar la refactorizacion completa de convergencia documental entre MDL/Teras y Gemswell MIS.

Trabaja como arquitecto senior de RAG documental, ingeniero de producto critico y documentalista funcional. El objetivo no es reescribir todo de golpe ni migrar bases de datos de forma brusca. El objetivo es converger contratos, estados, trazabilidad y comportamiento del chat para que ambos sistemas respondan con evidencia verificable.

Repositorio actual:
- MDL/Teras: /Users/moisesmenendez/Dropbox/DESARROLLO/mdl-patrimonio

Repositorio de referencia:
- Gemswell MIS: /Users/moisesmenendez/Dropbox/DESARROLLO/GEMSWELL_MIS/gemswell-mis-app

Primero lee estos documentos de Gemswell como memoria de convergencia:

1. /Users/moisesmenendez/Dropbox/DESARROLLO/GEMSWELL_MIS/gemswell-mis-app/docs/knowledge-system.md
2. /Users/moisesmenendez/Dropbox/DESARROLLO/GEMSWELL_MIS/gemswell-mis-app/docs/knowledge-convergence-functional-spec.md
3. /Users/moisesmenendez/Dropbox/DESARROLLO/GEMSWELL_MIS/gemswell-mis-app/docs/chat-rag-ingest-memory-state-2026-06-04.md
4. /Users/moisesmenendez/Dropbox/DESARROLLO/GEMSWELL_MIS/gemswell-mis-app/docs/chat-rag-ingest-status-vs-mdl.md
5. /Users/moisesmenendez/Dropbox/DESARROLLO/GEMSWELL_MIS/gemswell-mis-app/docs/architecture/layer3-evidence-reconciliation.md

Despues inspecciona en MDL/Teras estos archivos antes de editar:

Frontera de conocimiento y taxonomia:
- src/lib/domain/information-context.ts

Chat:
- src/app/api/chat/route.ts
- src/app/chat/page.tsx

Ingesta/harness:
- src/app/api/agent/ingest-email/route.ts
- src/app/api/agent/process-attachment/route.ts
- src/app/api/ingest-document/route.ts
- src/app/api/ingest/route.ts
- src/app/api/upload/route.ts
- src/lib/agent/reserve.ts
- src/lib/rag/drive.ts
- src/lib/rag/ingest.ts
- src/lib/rag/extract.ts
- scripts/batch-ingest.ts

RAG:
- src/lib/rag/embeddings.ts
- src/lib/rag/rerank.ts
- src/lib/rag/graph.ts

Base de datos/migraciones:
- supabase/migrations/20260608_003_bl_documents_extensions.sql
- supabase/migrations/20260608_004_rag_chunks_extend.sql

Referencia Gemswell a portar/adaptar:
- /Users/moisesmenendez/Dropbox/DESARROLLO/GEMSWELL_MIS/gemswell-mis-app/src/lib/knowledge/contracts.ts
- /Users/moisesmenendez/Dropbox/DESARROLLO/GEMSWELL_MIS/gemswell-mis-app/src/lib/knowledge/source-reference.ts
- /Users/moisesmenendez/Dropbox/DESARROLLO/GEMSWELL_MIS/gemswell-mis-app/src/lib/knowledge/markdown-artifact.ts
- /Users/moisesmenendez/Dropbox/DESARROLLO/GEMSWELL_MIS/gemswell-mis-app/src/lib/ingest/queue-processor.ts
- /Users/moisesmenendez/Dropbox/DESARROLLO/GEMSWELL_MIS/gemswell-mis-app/src/lib/intel/grounding.ts
- /Users/moisesmenendez/Dropbox/DESARROLLO/GEMSWELL_MIS/gemswell-mis-app/sql/004_knowledge_convergence_governance.sql

Estado de Gemswell a fecha 2026-06-04:
- La migracion de governance esta aplicada.
- `rag_documents` tiene `source_hash`, `review_status`, `classification_source`, `authority_tier`, `authority_score`, `md_path`, `md_status`, `source_channel`.
- `match_chunks` y `keyword_search_chunks` inyectan metadata viva desde `rag_documents`.
- Hay indices full-text y metadata sobre `rag_chunks`.
- El chat usa tool loop y source cards.
- Las fuentes rechazadas quedan excluidas.
- Las fuentes no aprobadas se degradan.
- Una fuente solo puede ser `source_of_record` si esta `approved`.
- Ingesta reserva documento antes de parsear, genera markdown artifact y chunk metadata.
- Gemini embeddings tiene fallback REST, throttling, retry y fail-closed si embeddings queda incompleto.
- Dos documentos fueron ingeridos y verificados end-to-end:
  - Balance sheet - Feb 26.xlsx: 2 chunks.
  - Nominal Ledger - Apr to Jun 25.xlsx: 4 chunks.

Objetivo funcional en MDL/Teras:

1. Separar formalmente Knowledge System del resto de superficies de gestion.
2. Normalizar contratos compartidos:
   - KnowledgeIntakeItem
   - DocumentLabels
   - CanonicalDocument
   - MarkdownFrontmatter
   - SourceReference / KnowledgeSource
3. Mantener las fortalezas de MDL:
   - upload
   - Drive sync
   - Gmail bot / bot@terascap.es
   - reserva documental
   - Inngest/jobs
   - OCR/fallback
   - clasificacion documental
   - markdown publish
4. Portar desde Gemswell:
   - source cards con authority/review status
   - tool loop explicito para chat
   - exclusion fail-closed de documentos rechazados
   - markdown artifact con frontmatter auditable
   - evidence linking Layer 3
   - RPC/queries con governance dinamica desde el documento padre
5. Convertir el chat de MDL desde contexto monolitico a herramientas explicitas.

Reglas de trabajo:

- No aplicar migraciones remotas sin confirmar el proyecto Supabase correcto.
- Antes de tocar Supabase, inspeccionar tablas/migraciones y confirmar project ref.
- No hacer `git reset --hard` ni revertir cambios ajenos.
- No lanzar ingesta masiva.
- Todo cambio de ingesta debe poder ejecutarse con un solo documento de prueba.
- Todo documento ingerido por bot/upload/email debe quedar `pending` o `needs_review` salvo regla humana explicita.
- No marcar como `done` si no se insertaron todos los chunks esperados.
- No tratar documentos rechazados como contexto valido.
- No fabricar URLs ni rutas de storage.
- No ocultar el estado de revision al usuario.
- Mantener cambios por fases, con lint/build tras cada fase relevante.

Plan requerido:

Fase 0 - Auditoria de estado
- Leer los documentos de Gemswell listados arriba.
- Leer archivos clave de MDL/Teras.
- Producir un mapa `Gemswell contract -> MDL current implementation -> gap -> proposed patch`.
- Identificar endpoints duplicados de ingesta.
- Identificar si MDL tiene una unica fuente de verdad para documento canonico.
- Identificar si el chat actual puede citar review status, source authority y evidencia.

Fase 1 - Contratos compartidos
- Crear/adaptar `src/lib/knowledge/contracts.ts` en MDL/Teras.
- Mapear la taxonomia existente de `information-context.ts` a `DocumentLabels`.
- No romper tipos actuales; usar adaptadores si hace falta.

Fase 2 - Markdown artifact
- Crear/adaptar `src/lib/knowledge/markdown-artifact.ts`.
- Garantizar frontmatter con:
  - document_id
  - source_channel
  - source_hash
  - file_name
  - mime_type
  - business_line_id
  - project_id / matter_id si aplica
  - doc_type
  - lifecycle
  - authority_tier
  - authority_score
  - classification_source
  - review_status
  - parser
  - ocr_used
  - generated_at
  - version

Fase 3 - Reserva e ingesta
- Asegurar que todo flujo de upload, Drive, Gmail bot y backfill crea una reserva canonica antes de parsear.
- Normalizar deduplicacion por `source_hash`.
- Evitar endpoints que procesen binarios como texto.
- Centralizar el pipeline de parse -> markdown -> chunks -> embeddings.
- Aplicar fail-closed si embeddings queda incompleto.

Fase 4 - Busqueda y gobierno documental
- Asegurar que las queries/RPC de chunks unen contra documento padre para inyectar:
  - review_status
  - classification_source
  - authority_tier
  - authority_score
  - lifecycle
  - source_channel
  - md_path
- Excluir `review_status = rejected`.
- Degradar `pending` y `needs_review`.

Fase 5 - Chat con tools
- Convertir el chat a herramientas explicitas:
  - search_documents
  - get_document
  - get_document_evidence
  - get_review_queue
  - get_domain_context
  - herramientas especificas MDL/Teras
- Guardar tool calls para auditoria.
- No depender de un unico bloque gigante de contexto.
- Mantener el contexto estructurado de MDL como tool, no como prompt oculto monolitico.

Fase 6 - Source cards y UX
- Portar/adaptar `source-reference.ts`.
- Mostrar:
  - label
  - authority
  - review status
  - classification source
  - relevance
  - md_path/storage path cuando exista
- Advertir al usuario si una fuente esta sin revisar.

Fase 7 - Evidence linking
- Adaptar Layer 3 de Gemswell a MDL/Teras:
  - published facts
  - evidence links
  - corroboration
  - contradiction
  - superseded evidence
  - review events
- Crear una prueba que trace una respuesta del chat hasta chunk, documento, markdown y fuente original.

Fase 8 - Prueba controlada
- Elegir un documento pequeno.
- Procesarlo por el canal mas estable.
- Verificar:
  - reserva canonica
  - source_hash
  - markdown artifact
  - chunks
  - embeddings
  - search
  - source card
  - respuesta del chat
  - estado de revision visible

Entregables de la primera conversacion:

1. Documento de auditoria inicial en `docs/knowledge-convergence-mdl-audit.md`.
2. Plan de cambios por fase con archivos exactos.
3. Primer patch pequeno y verificable, preferiblemente contratos + markdown artifact o source cards.
4. Resultado de lint/build.
5. Lista de bloqueos Supabase o credenciales, si existen.

Empieza por auditoria. No escribas codigo hasta haber leido los archivos clave y haber identificado el gap exacto.
```

## Primer Resultado Esperado

La primera conversacion en MDL/Teras deberia terminar con:

- una auditoria escrita,
- una lista de archivos clave,
- una tabla de gaps,
- un primer PR/commit pequeno,
- y un plan claro para pasar de contexto monolitico a tools documentales.

## Criterio De Exito De La Convergencia

La convergencia se considera iniciada correctamente cuando MDL/Teras puede demostrar una respuesta documental trazable:

chat answer -> tool call -> chunk -> canonical document -> markdown artifact -> original source -> review status

Y cuando el usuario puede ver, sin ambiguedad:

- que documento sustenta la respuesta,
- quien o que lo clasifico,
- si esta aprobado,
- si es fuente de registro o solo contexto,
- y si existe una version markdown auditable.
