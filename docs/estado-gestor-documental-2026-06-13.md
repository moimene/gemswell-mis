# Estado del gestor documental — 2026-06-13

> **⚠ Estado de commit / despliegue (añadido en la revisión adversarial 2026-06-13).** Todo lo descrito
> en «Correcciones aplicadas en esta pasada», «Evolución de backlog aplicada» y «Cierre adversarial final»
> se construyó en el **working tree**. A fecha de esta revisión `HEAD == origin/main == a9a9ff2` y prod
> auto-despliega desde `main`, por lo que **nada de esta pasada estaba desplegado en producción** (ingesta
> asíncrona por jobs, cron worker `*/5`, modos de grounding `trusted_only`/`official_only`, API de Historial,
> ruta de upload async). «aplicada» en este documento significa *aplicada al working tree*, no a prod. Tras la
> revisión:
> - **Commit:** esta pasada quedó **commiteada localmente** (sin push — el push a `main` auto-despliega y es
>   una decisión del operador).
> - **`sql/031`:** **APLICADA a prod** (mutación #20 del run-log; tabla aditiva y reversible vía
>   `sql/rollback/031_rollback.sql`). No hay código desplegado que la use todavía, así que es inerte hasta el deploy.
> - **Activación del cron `*/5` + ruta async:** **PENDIENTE de push explícito** — ver «Secuencia segura de deploy».
> - **Chat por defecto:** modo `standard` (admite `needs_review`/`pending` como contexto **divulgado**, no
>   bloqueado). El modo estricto a fuentes oficiales (`source_of_record`/`official_only`) es **opt-in** por
>   selector, **no** el comportamiento por defecto.
> - **Verificación gates:** `npm test` (29/228), `lint`, `build` y `git diff --check` re-ejecutados en la
>   revisión: pasan. La «Foto live del corpus» se reconfirmó exacta contra Supabase.

## Veredicto

El gestor documental ya tiene una base funcional avanzada y verificable: biblioteca documental, revisión documental, ingesta por upload directo a Storage, corpus gobernado, chat RAG híbrido con reranking y verificador final. No está en estado "prototipo vacío".

El cuello de botella para producto final no es crear el gestor desde cero, sino cerrar tres frentes:

1. Convertir la ingesta en un flujo operativo asíncrono con progreso, reintentos y backfill de artefactos.
2. Consolidar la experiencia entre Biblioteca, Ingesta y Centro de revisión para que no parezcan módulos duplicados.
3. Mantener el chat en modo evidencia estricta, usando `source_of_record` vivo y disclosed fallback cuando una fuente no esté revisada.

## Foto live del corpus

Consulta contra Supabase local configurado en `.env.local`.

| Métrica | Valor |
| --- | ---: |
| Documentos totales | 5.498 |
| Documentos indexed | 5.497 |
| Documentos retired | 1 |
| Chunks | 156.898 |
| Cola ingest_queue total | 2.406 |
| Cola queued / processing / error | 0 / 0 / 0 |
| `source_of_record` vivo | 829 |
| `source_of_record` elegible vivo | 833 |
| `source_of_record_pct` vivo | 99,52% |
| Documentos con markdown artifact | 2 |
| Documentos con source_hash | 2 |

Distribución relevante:

- `classification_source`: `agent_auto` 3.351, `agent_reviewed` 1.048, `rule` 1.099.
- `source_channel`: `manual_admin` 5.496, `local_backfill` 2.
- `lifecycle`: `superseded` 1.969, `unknown` 1.593, `draft` 1.102, `working_paper` 378, `executed` 285, `signed` 130, `filed` 41.
- Governance indexado: el RPC lifecycle-aware reporta 3.507 approved, 20 needs_review, 1 rejected. El recuento bruto sin lifecycle deja más `needs_review` porque incluye documentos no vivos o superseded.

Lectura: el chat ya tiene fuentes oficiales vivas, pero el corpus legacy sigue sin bytes originales en Storage, sin `source_hash` y sin markdown artifact. Eso limita dedup robusto, descarga directa desde citas y reingesta durable.

## Arquitectura actual

### Chat documental

Código principal:

- `src/app/api/chat/route.ts`
- `src/lib/chat/agent.ts`
- `src/lib/rag/retrieve.ts`
- `src/lib/rag/rank.ts`
- `src/lib/rag/rerank.ts`
- `src/lib/knowledge/source-reference.ts`

Estado:

- El chat usa tool loop con Anthropic.
- `search_documents` ejecuta recuperación híbrida vector + keyword.
- Vector lane usa `match_chunks`; keyword lane usa `keyword_search_chunks`.
- El pool se fusiona, se rerankea con Cohere y después se ordena por trust tier.
- Rejected, `agent_rejected` y `lifecycle='superseded'` quedan excluidos.
- `needs_review` y `pending` siguen disponibles como fallback, pero rankean por debajo y deben declararse.
- Postura por defecto = `standard`: admite `needs_review`/`pending` como contexto **divulgado** (badge «Se apoya en N fuentes sin revisar»). La declaración inline («(fuente sin revisar)») es una instrucción al modelo, no un gate duro; el badge —calculado de forma determinista, no por el LLM— es el respaldo auditable. El modo estricto (`trusted_only` = revisadas, `official_only` = `source_of_record`) es **opt-in**, no el default.
- El verificador final revisa la respuesta completa antes de emitirla por SSE (no se streamea token a token). Es **fail-open**: si el verificador está deshabilitado o falla, se emite el borrador marcado `verified=false` (badge «Respuesta sin verificar»), no se bloquea la respuesta.
- Las citas abren la ficha del gestor y, si existe artifact original, la descarga firmada.

Riesgo residual:

- Si faltan APIs externas o falla el verificador, la UI lo marca como degradado/no verificado, pero el operador debe vigilar esas señales.
- RRF y `RAG_RELEVANCE_FLOOR` siguen env-gated; el modo por defecto conserva `vector_first` y floor 0.

### Biblioteca documental

Código principal:

- `src/app/admin/documents/page.tsx`
- `src/app/admin/documents/_components/DocumentPanel.tsx`
- `src/app/api/knowledge/documents/route.ts`
- `src/app/api/knowledge/documents/[id]/route.ts`
- `src/lib/knowledge/governance-actions.ts`

Estado:

- Es la ficha e inventario canónico del corpus.
- Permite filtrar, buscar, aprobar, rechazar, reclasificar, retirar, restaurar, superseder y endorsar como fuente oficial.
- Las mutaciones pasan por RPC transaccional `apply_document_governance`.
- La tabla y el panel muestran autoridad, estado, verificación, markdown reconstruido, chunks e historial.

Riesgo residual:

- Los documentos legacy no tienen artifact original; la cita puede abrir la ficha pero no el archivo real.
- El panel reconstruye markdown desde chunks cuando no existe artifact, que es útil para inspección pero no equivale al documento original.

### Centro de revisión

Código principal:

- `src/app/admin/review/page.tsx`
- `src/app/admin/review/_components/DocumentReviewQueue.tsx`
- `src/app/api/intel/*`

Estado:

- Tiene cuatro pestañas: Documentos, Métricas, Contradicciones, Historial.
- La pestaña Documentos reutiliza la API de biblioteca y es una cola operativa de `needs_review`.
- Métricas/Contradicciones pertenecen al circuito Layer 3/Tower Control, no al inventario documental.
- Historial muestra acciones documentales y decisiones de métricas desde una API real con degradación parcial explícita.

Lectura de producto:

- No conviene duplicar "Documentos" como segunda biblioteca. Debe quedar claro que Biblioteca = inventario/ficha completa; Centro de revisión > Documentos = cola de decisión.

### Ingesta documental

Código principal:

- `src/app/admin/ingest/page.tsx`
- `src/app/admin/documents/_components/UploadPanel.tsx`
- `src/app/api/knowledge/upload/sign/route.ts`
- `src/app/api/knowledge/upload/route.ts`
- `src/lib/ingest/queue-processor.ts`
- `src/lib/ingest/reaper.ts`

Estado:

- El usuario sube un documento individual.
- El archivo va directo a Supabase Storage mediante signed upload URL.
- Después el servidor descarga el objeto y ejecuta parse, clasificación, markdown, chunking, embeddings e indexación.
- Hay reaper para documentos `processing` varados y reingesta de errores recuperables con bytes en Storage.
- El upload de la **Biblioteca** sigue siendo síncrono desde la perspectiva de la request; para documentos grandes puede tardar. (Esta sección describe la **línea base**; `/admin/ingest` pasó a ingesta **asíncrona** por jobs durables — ver «Evolución de backlog aplicada», punto 7. La contradicción aparente «síncrono» vs «async jobs» se resuelve así: Biblioteca conserva el síncrono como fallback; `/admin/ingest` es async.)

Riesgo residual:

- No hay job UI durable con progreso por etapa, cancelación, retry manual y listado de intentos.
- No hay bulk upload ni conectores Drive/Gmail.
- OCR existe como fallback opt-in (`RAG_OCR_ENABLED=true` + `MISTRAL_API_KEY`), no como experiencia operacional visible.

## Correcciones aplicadas en esta pasada

1. `source_channel` de browser upload
   - Antes: los uploads de navegador entraban como `local_backfill`.
   - Ahora: `ingestBuffer` acepta `sourceChannel`; `/api/knowledge/upload` lo envía como `browser_upload`; también queda en frontmatter markdown y metadata de chunks.
   - La Biblioteca expone un filtro por origen (`source_channel`) para separar legacy/manual, backfill, Drive/Gmail y upload de navegador.

2. Copy de Ingesta
   - Se cambió "Disponible para el Chat tras aprobarse" por "Fuente fiable para el Chat tras aprobarse" para reflejar la política real: el chat puede usar fuentes sin revisar como contexto degradado, pero solo las aprobadas/human-validadas son fiables.
   - La pantalla de Ingesta ahora muestra estado operativo de cola, errores, documentos sin revisar y cobertura `artifact/source_hash`.
   - Tras un upload correcto, muestra enlaces directos a la ficha documental y al Centro de revisión.

3. Limpieza de lint
   - `scripts/reclassify-needs-review-opus.ts` quedó tipado sin `any`.
   - `src/lib/rag/__tests__/retrieve.test.ts` quedó sin warning de parámetro no usado.

4. Historial real del Centro de revisión
   - Nueva API `GET /api/intel/review/history` combina `rag_document_events` e `intel_review_decision`.
   - La pestaña Historial deja de ser placeholder y muestra acciones documentales y decisiones de métricas.

5. Recuperabilidad y fidelidad documental
   - La ingesta guarda `storage_path` antes del parseo/embedding para que una ingesta fallida pueda ser recuperada por el reaper.
   - En errores de ingesta se conserva `storage_path` y se registra `review_reason`.
   - El reaper conserva `source_channel` en reingestas recuperables, evitando relabelar documentos no-browser como backfill local.
   - El reset de `reingest_attempts` es no fatal y ya no puede convertir una ingesta indexada en error.
   - La ficha documental descarga el markdown artifact real cuando `md_path` existe; si no está disponible, lo declara como fallback reconstruido.
   - La ficha avisa cuando los chunks mostrados están truncados.

6. Pasada adversarial
   - Se corrigió el empty state del historial para no presentar un fallo parcial de auditoría como ausencia real de decisiones.
   - La revisión adversarial no encontró P0/P1; los tres P2 encontrados quedaron corregidos antes de los gates finales.

7. Evolución de backlog aplicada
   - Nueva tabla operativa `knowledge_ingest_jobs` (`sql/031`) con RLS admin, rollback y claim atómico `FOR UPDATE SKIP LOCKED`.
   - Nuevo worker `GET /api/cron/ingest-jobs`, protegido con `CRON_SECRET`, y cron cada 5 minutos; reporta processed/done/failed/retried.
   - Nuevos endpoints `GET/POST /api/knowledge/ingest/jobs`, detalle, retry y cancel.
   - `/admin/ingest` usa upload asíncrono: sube a Storage, encola job y muestra cola durable con estado, stage, intentos, error, retry, cancel y enlace a ficha.
   - La firma de Storage, la creación del job y el worker aplican límite server-side de 50 MB.
   - Biblioteca conserva el upload síncrono como fallback operativo.
   - Biblioteca puede filtrar `rag_documents.status='error'` con "Solo errores".
   - Chat añade modos de grounding: estándar, fuentes revisadas (`trusted_only`) y fuentes oficiales (`official_only`), filtrando evidencia antes del modelo.
   - La segunda pasada adversarial encontró 1 P1 y 3 P2; quedaron corregidos: leases expirados **acotados** (un lease expirado se reencola hasta `max_attempts` y solo entonces pasa a `error` terminal — la recuperación vive en la RPC `claim_knowledge_ingest_job`; el fallback JS sin la RPC no recupera filas `processing` varadas), retries automáticos con backoff, límite server-side de 50 MB, y prompt estricto compartido entre HTTP/evals.

8. Cierre adversarial final
   - El dedupe por `source_hash` ya no destruye chunks de un documento existente si el documento ya está `indexed` y tiene chunks; en ese caso la ingesta reutiliza el documento y termina sin reparsear.
   - Retry/cancel usan compare-and-swap por `updated_at`; el worker solo cambia etapa, reencola o finaliza si conserva `status='processing'`, `attempts` y el mismo `lease_expires_at`.
   - El reaper ya no silencia fallos al persistir `reingest_attempts`; el default dependency lanza error y la orquestación lo registra explícitamente.
   - `trusted_only` y `official_only` sobreextraen candidatos vector/keyword antes del filtro de gobierno para evitar falsos vacíos por top-K estrecho.
   - Ruflo quedó usado como coordinación/supervisión y la segunda pasada adversarial quedó cerrada sin bloqueantes P0/P1/P2 tras las correcciones.

## Verificación local

- `npm test`: 29 archivos, 228 tests passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `git diff --check`: passed.
- Smoke HTTP local: `/admin/ingest` y `/chat` responden con redirect 307 a `/login`, esperado al estar protegidas.

## Plan de evolución recomendado

### Fase 1 — Consolidación UX funcional

- Renombrar mentalmente las superficies:
  - Biblioteca documental = inventario y gobierno completo.
  - Ingesta documental = entrada rápida.
  - Centro de revisión = bandeja de decisiones: documentos, métricas, contradicciones, historial.
- Ampliar el historial real con filtros por usuario, tipo de acción y documento/métrica.

### Fase 2 — Ingesta ágil de producto

- ✅ `sql/031_knowledge_ingest_jobs.sql` **APLICADA a prod** (mutación #20, aditiva y reversible). Falta el paso final: hacer push (auto-deploy) para activar el cron `*/5` y la ruta async — ver «Secuencia segura de deploy» al final.
- Evolucionar la UI de jobs de estado global a etapa fina: uploaded, parsing, classifying, chunking, embedding, indexed, needs_review/error.
- Bulk upload por lote con límites de concurrencia.
- Activar OCR operacional con fallback claro para PDFs escaneados.

### Fase 3 — Backfill legacy

- Subir originales legacy a Storage.
- Backfill `storage_path`, `source_hash`, `md_path` y `content_hash`.
- Deduplicar por hash/contenido y retirar superseded reales.
- Regenerar markdown artifacts para documentos críticos primero: legal, board, funding, audited/annual accounts, BP models.

### Fase 4 — Grounding más estricto

- Evaluar activar `RAG_FUSION_MODE=rrf` y un `RAG_RELEVANCE_FLOOR` medido contra `scripts/eval`.
- Evaluar con `scripts/eval` los modos `trusted_only` y `official_only` contra preguntas críticas.
- Mantener gates duros: rejected/superseded nunca citados; lane outage no se interpreta como ausencia; `needs_review` siempre divulgado.

## Secuencia segura de deploy (pendiente de push)

Estado actual tras la revisión 2026-06-13: `sql/031` está **aplicada a prod** (mutación #20); el código de esta pasada está **commiteado localmente pero sin push**. Activar la ingesta async + cron requiere el push, que auto-despliega **toda** la pasada. Orden seguro:

1. **(Hecho)** Aplicar `sql/031` a prod. Verificado: tabla `knowledge_ingest_jobs` presente, RLS activa (policy admin), RPC `claim_knowledge_ingest_job` con `FOR UPDATE SKIP LOCKED` y `search_path` fijado, trigger `updated_at` con `search_path=''`. La tabla es inerte hasta que se despliegue código que la use.
2. **Confirmar secretos en Vercel:** `CRON_SECRET` debe existir en el proyecto (el worker `/api/cron/ingest-jobs` y el proxy lo exigen; sin él el cron responde 401). Reutiliza el mismo patrón que `/api/cron/ingest-reaper`, ya en prod.
3. **Push a `main`** (auto-deploy). Esto activa: la ruta async `/api/knowledge/ingest/jobs*`, el cron `*/5`, el allowlist del proxy para `/api/cron/ingest-jobs`, los modos de grounding del chat y la API de Historial. **No hay forma de activar solo el cron sin desplegar el resto** — es un push atómico de la pasada.
4. **Verificar post-deploy:** (a) un upload de prueba en `/admin/ingest` debe encolar un job y verlo pasar `queued → processing → indexed` (la cola ahora se auto-refresca); (b) el cron debe responder 200 con `processed/done/failed/retried` (revisar logs Vercel del cron); (c) confirmar que `/chat` sigue verde (el gate no cambió de comportamiento por defecto).
5. **Rollback si hace falta:** revertir el commit en `main` (re-deploy del estado previo) y, si se quiere limpiar la tabla, `sql/rollback/031_rollback.sql`. La tabla aditiva puede quedarse sin riesgo aunque se revierta el código.

Decisión de producto abierta (no incluida en este deploy): si el asistente CEO/CFO debe **defaultear a `trusted_only`** en vez de `standard`. Es un cambio de una línea en el default de grounding, evaluable con `scripts/eval` antes de activarlo.
