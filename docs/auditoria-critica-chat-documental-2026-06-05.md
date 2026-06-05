# Auditoría Crítica — Sistema de Chat Documental Gemswell MIS

Fecha: 2026-06-05
Auditor: arquitecto senior RAG / auditor documental / ingeniero de producción (modo adversarial, sin complacencia)
Método: lectura de código (no de docs), verificación contra Supabase vivo (`nqxhsjkcvfxygiajdxki`), comparación con `mdl-patrimonio`.

> Regla de esta auditoría: **ningún elogio sin evidencia y ningún reproche sin `file:line` o cifra de BD.** Donde los documentos de memoria y el código se contradicen, manda el código y la base de datos.

---

## 0. Datos duros de partida (verificados en Supabase vivo, no en los docs)

| Métrica | Doc dice | Realidad (BD `nqxhsjkcvfxygiajdxki`) |
|---|---|---|
| Chunks | "102K+" (CLAUDE.md), "150K+" (knowledge-system), "27.600" (layer3) | **156.898** (`rag_chunks`) |
| Documentos | — | **5.498** (`rag_documents`) |
| Cola ingesta | 2406/267/2 (2026-06-04) | **2406 done / 267 queued / 2 error** (idéntico → 0 progreso en 24h+) |
| Modelo chat | "GPT-4o" (CLAUDE.md) | **`claude-sonnet-4-20250514`** (route.ts:781) |
| Migración `004` aplicada | "no aplicada" (status-vs-mdl) vs "aplicada" (memory-state) | **APLICADA** (RPCs con JOIN gobernanza confirmados) |
| `review_status` del corpus | "degradamos no-aprobados" | **5.498/5.498 = `approved`** |
| `authority_score` | escalera 0–100 | **5.498/5.498 = `0`**; con `≥90`: **0 docs** |
| `source_hash` (dedup) | "SHA-256, dedup" | **2 de 5.498** lo tienen |
| `md_path` (markdown artifact) | "pipeline genera markdown" | **2 de 5.498** (`md_status='generated'`); 5.496 `pending` |
| RLS | "gobernanza, fail-closed" | **`open_all USING(true)` para `public`**; `ingest_queue` con **RLS off** |
| `intel_review_decision` | "human-in-the-loop" | **0 filas** (nunca se revisó nada) |
| `intel_doc_authority` | "ranking de autoridad" | **0 filas** (tabla vacía) |

Estas doce filas son la tesis de toda la auditoría: **el sistema está descrito como un bot documental gobernado y trazable, y operacionalmente es un RAG plano sobre 5.498 documentos uniformemente marcados "aprobado / autoridad 0 / sin revisar por humano", servido desde una base de datos sin control de acceso.**

---

## 1. Veredicto duro (10 líneas)

1. El chat tiene un **tool loop limpio y auditable** (Anthropic, `tool_calls` persistidos): es la mejor pieza del sistema y no debe romperse.
2. Pero el **system prompt ordena al modelo recitar cifras financieras hardcodeadas como verdad sin fuente** ("USE IT directly — never say 'not found in context'", route.ts:222–223): contradice de raíz la promesa de trazabilidad.
3. La **gobernanza documental es plumbing vivo sobre datos vacíos**: 100% del corpus es `approved` + `authority 0`, así que degradación, exclusión y `source_of_record` son **código muerto** sobre datos reales.
4. **No existe gestor documental.** Hay un UI de revisión de *métricas* (Layer 3), no de *documentos*; y `intel_review_decision = 0`: nunca se usó.
5. La **consolidación de ingesta es ficción**: el pipeline canónico ha procesado **2 de 5.498 docs**; el corpus vivo lo construyó el camino legacy ingobernado.
6. **Seguridad inexistente**: RLS `USING(true)`, `anon key` pública, cero auth → todo el corpus financiero confidencial es world-readable. Es el riesgo #1.
7. **Sin OCR, sin embedding provenance, sin umbral de similitud, `tsvector('simple')`** en corpus bilingüe: el retrieval es más frágil de lo que aparenta.
8. **LlamaParse sin fallback** salvo Excel: si caduca la cuota (CLAUDE.md: "credits pending"), toda ingesta PDF/DOCX/PPTX falla en duro.
9. La **Layer 3 está sobre-diseñada** (8 tablas, vistas, RPCs, alertas de contradicción) y **sin operar** (0 decisiones, 0 autoridades).
10. No hace falta reescribir: hay que **hacer real lo que ya existe** (gobernanza, seguridad, gestor) y **portar el harness de ingesta de MDL**. En orden: seguridad → gobernanza real → gestor → consolidación → harness MDL → trazabilidad.

---

## 2. Riesgos CRÍTICOS (parar la máquina)

### C1 — Corpus financiero confidencial world-readable (RLS abierto + anon key pública)
- **Evidencia**: `pg_policies` → toda política sobre `rag_documents/rag_chunks/rag_messages/intel_metric_candidate/fct_capex_snapshot` es `open_all` `cmd=ALL` `roles={public}` `qual=true with_check=true`. `ingest_queue` tiene `rls_enabled=false` (advisor Supabase: *critical*). La `NEXT_PUBLIC_SUPABASE_ANON_KEY` viaja al navegador por diseño y `createApiClient()` usa `SERVICE_ROLE_KEY || ANON_KEY` (sin service key en `.env.local`, cae a anon).
- **Impacto**: cualquiera con la URL pública puede extraer la anon key del bundle JS y leer (o escribir/borrar) los 156.898 chunks: contratos, board packs, covenants, cash flow MAD/BHX. Para un MIS de CEO/CFO esto es una brecha de confidencialidad de grado 1.
- **Por qué es crítico y no alto**: no es una vulnerabilidad teórica, es la configuración *actual* de producción y afecta a datos de máxima sensibilidad.

### C2 — El bot afirma cifras hardcodeadas como hechos, sin fuente y sin trazabilidad
- **Evidencia**: `SYSTEM_PROMPT` (route.ts:164–223) contiene la estructura de financiación completa con importes exactos (`Teras Fund Equity: €18.4M`, `Santander + BBVA Senior Debt: €31.0M`, `CESCE-backed Senior Debt: ~£22M`…), nombres de personas, y termina con: *"When you have knowledge from this system prompt (financing structure, corporate entities, key people), USE IT directly — never say 'not found in context'."*
- **Impacto**: el modelo está **instruido a no buscar** para todo lo que ya esté en el prompt. Esas cifras están congeladas en código; cuando el deal cambie (y cambiará), el bot recitará importes obsoletos con tono de certeza, sin source card, sin chunk, sin documento. Viola los invariantes 1, 2 y 5 de `knowledge-system.md` ("usar tools en vez de adivinar", "exponer fuentes", "no fabricar"). Es el mayor riesgo de alucinación **estructural** (no estocástica) del sistema.
- **Contexto implícito no auditable**: el propio prompt ES un bloque de contexto de ~60 líneas de "verdad" sin procedencia. Esto es exactamente el "contexto implícito no auditable" que la auditoría debía buscar.

### C3 — La gobernanza documental es semánticamente vacía
- **Evidencia**: 5.498/5.498 docs en `review_status='approved'`, `authority_score=0`, `authority_tier='unverified'`, `classification_source='human'` (5.496) — todos **valores DEFAULT** que `004` estampó al hacer `ALTER TABLE ADD COLUMN ... DEFAULT`. El pipeline (`queue-processor.ts:55–60`) y los scripts legacy reproducen o heredan esos defaults.
- **Cadena de código muerto resultante** (route.ts + source-reference.ts):
  - `isRejectedSource()` → nunca true (0 rechazados).
  - `needsReviewWarning()` → solo si `pending/needs_review` **y** `classification_source` empieza por `agent`: nunca (todo `approved`+`human`).
  - degradación `×0.85` → solo `pending/needs_review`: nunca.
  - `verificationFromGovernance(0,'approved')` → no ≥90, no ≥75 → **siempre `'context'`**. Nunca `source_of_record`, nunca `supporting`.
- **Impacto**: la UI muestra siempre el mismo badge "context"; la "verificación de fuentes" que los docs venden como ventaja de Gemswell **no discrimina nada** sobre datos reales. Es teatro de gobernanza.

### C4 — El pipeline "consolidado" no construyó el corpus; lo hizo el camino ingobernado
- **Evidencia**: solo 2 docs tienen `source_hash` y `md_path` (los dos XLSX de prueba, `source_channel='local_backfill'`). Los 5.496 restantes son `source_channel='manual_admin'`, `md_status='pending'`, sin hash → **no pasaron por `queue-processor.ts`**. Los scripts `scripts/ingest-dms.mjs` (insert doc :502, chunks :521) e `ingest-key-docs.mjs` (doc :415, chunks :438) escriben directo, sin `source_hash`, sin metadata de gobierno, sin markdown, con dedup solo por `metadata->>source_file`.
- **Impacto**: re-ejecutar cualquiera de los dos scripts (rutas locales hardcodeadas, claramente pensados para correr a mano) **duplica** documentos+chunks (no colisionan con el índice único de `source_hash` porque no lo setean) e inyecta material **trusted-by-default** (el chat asume `approved` ante metadata ausente). La "única fuente de verdad de ingesta" existe en código y es falsa en datos.

---

## 3. Riesgos ALTOS

### A1 — LlamaParse es single point of failure para todo lo no-Excel
`parse.ts:81–90`: si LlamaParse falla, solo hay fallback local para `.xlsx/.xls`; PDF/DOCX/PPTX hacen `throw err`. Con "LlamaParse credits pending" (CLAUDE.md) y BHX aún sin ingestar, un agotamiento de cuota convierte el 100% de la ingesta documental (no-Excel) en `error`. No hay medición de cuota desde API (memory-state lo admite).

### A2 — Sin OCR
`parse.ts` no tiene rama OCR. PDFs escaneados (frecuentes en legal/board/funding) dependen del OCR interno de LlamaParse premium sin quality gate ni marca `ocr_used` real (siempre `false`, queue-processor.ts:287). MDL tiene Mistral OCR con heurística de disparo (`chars<500 || singleCharLineRatio>0.4`). Gap confirmado.

### A3 — Retrieval sin umbral y keyword sin stemming
- `match_chunks` (verificado en BD): `ORDER BY embedding <=> q LIMIT match_count` **sin `WHERE similarity > umbral`**. Siempre devuelve hasta 25 chunks aunque la query sea ruido → fuerza "relevancia" y alimenta alucinación. MDL usa `match_threshold: 0.20`.
- `keyword_search_chunks`: `to_tsvector('simple', ...)` → **sin stemming ES/EN**. "financiación" no matchea "financiacion", "covenants" no matchea "covenant". En corpus bilingüe financiero, recall keyword degradado.

### A4 — Rerank trunca a 1500 chars y no pondera autoridad
`rerank.ts:48`: `c.content.slice(0, 1500)` antes de rerank. En cláusulas legales/financieras una cláusula truncada cambia el sentido (MDL deliberadamente **no** trunca). Además el rerank es puramente semántico: con autoridad real (cuando exista) un `narrative` puede reelevarse por encima de un `audited`. No hay ordenación authority-aware.

### A5 — Acoplamiento de latencia: la query del chat comparte el throttle global con la ingesta
`embeddings.ts:9,32–41`: `embeddingLimiterTail` y `nextEmbeddingRequestAt` son **module-level (globales)**. La query del chat usa el mismo limitador (`GEMINI_EMBEDDING_MIN_INTERVAL_MS`, default 4000ms) que el batch de ingesta. Si hay ingesta corriendo, una pregunta del CEO encola detrás → segundos/minutos de espera. `maxDuration=800` (route.ts:8) es la tirita que delata el problema.

### A6 — Sin embedding provenance
`ChunkMetadata` (embeddings.ts:141–161) **no incluye `embedding_model`**. Con 156.898 chunks embebidos a lo largo del tiempo por ≥3 caminos (queue-processor, ingest-dms, ingest-key-docs), no hay forma de detectar drift de modelo/dimensión. MDL sí guarda `embedding_model` por chunk. Si un subconjunto se embebió con otro modelo, el coseno es basura y nadie se entera.

### A7 — Cero auth en superficies admin con escritura
El agente confirmó: no hay `middleware.ts`, ni guard de sesión en páginas, ni auth en rutas API. Cualquiera puede `POST /api/intel/review` (aceptar/rechazar candidatos), `POST /api/ingest/queue`, disparar `/api/ingest/process` con privilegios de servidor. (Hoy es menos grave que C1 solo porque el daño ya es total vía anon key.)

---

## 4. Riesgos MEDIOS

- **M1 — Cola sin scheduler**: 267 pendientes estáticos desde 2026-06-04; solo `curl` manual o `ingest-worker.mjs` a mano. No hay reproceso de stuck-jobs (MDL sí: `reprocess-stuck-jobs.mjs`).
- **M2 — `user_id: 'ceo'` hardcodeado** (route.ts:907): sin identidad real; auditoría de quién preguntó qué es ficticia. `rag_messages` = 52 filas / 18 conversaciones (uso mínimo).
- **M3 — Markdown artifact no visible ni versionado real**: `current_version` siempre 1; `supersedes_document_id` usado 0 veces; ningún UI lee `md_path`. El artifact es write-only.
- **M4 — Dedup multi-canal imposible**: no existen adaptadores upload/Drive/email en Gemswell, así que "mismo doc desde 3 canales" ni siquiera es testeable; y el `source_hash` solo dedup­lica si todos los caminos lo calculan (legacy no).
- **M5 — Doc-types divergentes**: `chunkFinancialContent` detecta `doc_type` por regex (capex/cash_flow/funding/bp_model) que **no coincide** con la taxonomía de `contracts.ts` (legal/board/funding/capex/tax/kyc/dd…). El filtro `doc_type` del chat (alias en route.ts:117–128) parchea parte, pero la metadata de chunk y la taxonomía canónica no hablan el mismo idioma.
- **M6 — `intel_*` parcialmente poblado sin revisión**: 40 candidatos, 8 publicaciones, 60 source links, 4 contradicciones, pero **0 decisiones humanas** y **0 autoridades**. Hay hechos publicados a `fct_*` sin que nadie los haya aprobado: el "human-in-the-loop" se saltó.
- **M7 — Contradicción de capex sin resolver** (CLAUDE.md: €103M vs €57M MAD) viva en datos, y la maquinaria de contradicción (`intel_contradiction_alert`, 4 filas) no la cierra.

---

## 5. Qué está BIEN y no debe romperse

1. **`src/lib/ingest/queue-processor.ts`**: reserva-antes-de-parsear, `source_hash` SHA-256, recuperación de colisión `23505` con limpieza de chunks previos, fail-closed real (`insertedChunks !== chunks.length` → throw + borra parciales + marca `error`, :352–404). Es el patrón correcto. **Mantener como único writer.**
2. **El tool loop del chat** (route.ts:770–863): bucle Anthropic `tool_use` limpio, máx 5 iteraciones, ejecución paralela de tools, guard de `tool_use` sin bloques, y **persistencia de `tool_calls`** (:927) y `sources` (:920). Auditable de verdad. Es la joya.
3. **Separación structured vs documentary a nivel de tool**: `search_documents` (RAG híbrido) vs 6 tools que leen `fct_*` directos (capex/funding/cash/covenant/risk/compare). El modelo *sí* distingue dato estructurado de evidencia documental — porque son herramientas distintas. Bien.
4. **El JOIN de gobernanza en los RPC** (`match_chunks`/`keyword_search_chunks`, verificado en BD): la cañería para inyectar `review_status/authority/...` desde el documento padre es correcta. El problema son los datos, no el RPC.
5. **`source-reference.ts`**: el mapeo `verificationFromGovernance` y la construcción de labels es lógica sólida; solo necesita datos de autoridad reales para dejar de devolver siempre `context`.
6. **Tools financieras con safeguards**: `get_cash_runway` cap ±€50M y ventana 9 meses (:568–569); dedup de snapshots por fecha en risk/covenant. Defensa sensata.

---

## 6. Qué está SOBRE-diseñado

- **Layer 3 completa (`intel_*`)**: 8 tablas + 4 vistas + RPCs + alertas de contradicción + columnas generadas, **operada a 0**: `intel_review_decision=0`, `intel_doc_authority=0`. Se construyó la cadena de evidencia documento→KPI antes de tener un solo revisor humano usándola. Gold-plating dirigido por spec.
- **`contracts.ts`**: taxonomía riquísima (5 enums, `KnowledgeIntakeItem`, `DocumentLabels`, `CanonicalDocument`, `AUTHORITY_TIER_SCORE`) — pero los datos reales viven todos en un único combo de defaults. Tipos sin tracción.
- **Markdown artifact + frontmatter auditable**: pipeline entero (`markdown-artifact.ts` + subida a Storage + `md_path/md_status`) ejecutado sobre **2 documentos**. Correcto en diseño, irrelevante en operación.
- **Los 6 contratos del SPEC de convergencia** (intake/labels/canonical/markdown/chunk/chat) están escritos como si ambos sistemas ya los cumplieran; en Gemswell son aspiracionales.

Patrón: el sistema invirtió en *contratos y capas de evidencia* (lo intelectualmente satisfactorio) antes que en *seguridad, clasificación real y gestor documental* (lo aburrido y necesario).

## 7. Qué está INFRA-diseñado

- **Seguridad/acceso**: inexistente (C1, A7).
- **Gestor documental**: inexistente (§8). No se puede aprobar/rechazar/reclasificar/retirar/superseder un documento desde ninguna UI.
- **Clasificación real**: no hay clasificador. `classification_source='human'` es mentira de DEFAULT. MDL clasifica con Haiku; Gemswell no clasifica.
- **Adaptadores de intake**: 0. No hay upload, ni Drive, ni Gmail bot, ni Inngest. El `KnowledgeIntakeItem` con `source_channel: 'gmail_bot'` es tipo sin implementación.
- **OCR, embedding provenance, umbral de similitud, scheduler, evals**: todos ausentes.
- **Observabilidad de corpus**: existe `GET /api/ingest/queue` (queue/processing/done/error) pero **ningún UI lo consume**.

---

## 8. ¿Hay gestor documental? — NO (settled)

- **El árbol admin son 4 páginas**: `/admin/ingest` (file-picker sobre `dms-manifest.json` estático), `/admin/review` (revisión de **métricas** Layer 3), `/admin/packs`, `/admin/packs/[id]`. No existen `/admin/inbox`, `/admin/estado`, `/admin/documents`, `/admin/corpus` (esos están en **MDL**, no aquí).
- **El UI de "review" revisa `intel_metric_candidate`, no documentos** (su propio header: *"Layer 3 — Review extracted metric candidates"*). `rag_documents` aparece solo como label de fuente read-only. Ninguna ruta UI muta `review_status/authority_tier/classification_source/lifecycle/supersedes_document_id`.
- Respuesta a tus preguntas de control:
  - ¿Revisar/aprobar/rechazar/reclasificar documentos? **No** (solo métricas).
  - ¿Ver el markdown generado? **No** (ningún UI lee `md_path`).
  - ¿Entender de dónde viene cada chunk? **Parcial**: el chat muestra label+snippet+`dms_path` como texto, sin deep-link, sin page/chunk-id.
  - ¿Retirar un documento del RAG? **No** desde UI (solo `review_status='rejected'` que nadie puede setear; o re-ingesta).
  - ¿Marcar source-of-record? **No** (y aunque se pudiera, `authority 0` lo impide).
  - ¿Gestionar versiones/superseded? **No** (`supersedes_document_id` = 0 usos).

Conclusión: hay una **cola técnica** (`ingest_queue`) y un **revisor de métricas**, pero **no un gestor documental**. El documentalista que el SPEC pone como reviewer primario **no tiene pantalla**.

---

## 9. Gaps de Gemswell frente a MDL/Teras (portar DESDE MDL)

| Capacidad | MDL (evidencia) | Gemswell | Acción |
|---|---|---|---|
| Gmail bot dedicado | `bot@terascap.es`, `src/lib/agent/gmail.ts`, poll-inbox cron | **ausente** | Portar adaptador Gmail + intake |
| Drive sync | `src/lib/rag/drive.ts` (googleapis, service account) | **ausente** | Portar Drive read/sync |
| Upload UI | `/api/upload` multipart | **ausente** (solo file-picker de manifest) | Portar upload→cola |
| Jobs async durables | Inngest `process-attachment.ts` 9 pasos, retries, idempotency, `agent_workflow_events` | cola síncrona + curl | Adoptar modelo de job con estados ricos |
| OCR | Mistral `src/lib/agent/ocr.ts` con heurística de disparo | **ausente** | Portar OCR fallback |
| Reserva documental | `reserve.ts` (`review_status='reserved'` antes de proyectar) | reserva existe pero sin clasificación previa | Alinear |
| Clasificación documental | Haiku `classify.ts` (doc_type/BL/authority/confidence) | **ausente** (defaults) | Portar clasificador |
| Chunking heading-aware | `agent/embed.ts` (respeta tablas/fences, `section` H1>H2>H3) | financiero/regex 2000 chars | Portar heading-aware |
| Markdown twin repo | GitHub `terasia-md-repo`, frontmatter, idempotente | Storage `artifacts/{id}/v1.md` (2 docs) | Operacionalizar |
| Reproceso stuck-jobs | `reprocess-stuck-jobs.mjs` | **ausente** | Portar tooling |
| Taxonomía de provenance en prompt | `[humano]/[bot·aprobado]/⚠[bot·SIN revisar]/⛔[bot·rechazado]` end-to-end | `needsReviewWarning` existe pero nunca dispara | Hacer real (datos) |

**Matiz crítico**: MDL **sí tiene** un gestor/inbox documental con approve/reject/reclassify (`/admin/inbox`). En gobernanza *documental operable*, **MDL va por delante de Gemswell**, al revés de lo que sugiere el semáforo de `status-vs-mdl.md`.

## 9-bis. Gaps de MDL frente a Gemswell (portar DESDE Gemswell)

| Capacidad | Gemswell | MDL | Acción |
|---|---|---|---|
| Tool loop explícito | route.ts:770 (Anthropic, tool_calls) | **ninguno** (prompt monolítico, single-shot) | Convertir chat MDL a tools |
| Layer 3 evidencia/contradicción | `intel_*` completo | suggestions/review parciales | Adaptar Layer 3 |
| `tool_calls` audit persistido | sí | no (no hay tools) | Portar |
| Source verification contract | `source-reference.ts` | provenance en prompt, no contrato | Portar contrato |
| Fail-closed embedding completeness | queue-processor.ts:352 | bug latente `text-embedding-005` 404 (process-attachment.ts:472) | Portar disciplina + arreglar 404 |

**Importante**: ambos comparten la **misma enfermedad** — metadata de gobierno que por defecto significa "fiable". No es que uno cure al otro; ambos necesitan que el DEFAULT deje de ser `approved`.

---

## 10. Plan de refactorización por fases (sin reescritura)

**Fase 0 — Cerrar la puerta (seguridad). Bloqueante, días, no semanas.**
- Sustituir `open_all USING(true)` por políticas reales o, mínimo, mover toda lectura/escritura a rutas server con `SUPABASE_SERVICE_ROLE_KEY` server-only y cerrar la anon a `SELECT` con RLS por rol autenticado. Activar RLS en `ingest_queue`.
- Añadir auth (Supabase Auth) y gate a `/admin/*` y `/api/*` de escritura.
- Criterio: un cliente con solo la anon key **no** puede leer `rag_documents`.

**Fase 1 — Hacer la gobernanza real.**
- Cambiar los DEFAULT de `004`: `review_status` → `needs_review` (no `approved`); `classification_source` → `agent_auto`/`unknown` (no `human`).
- Backfill clasificador (portar Haiku de MDL): asignar `authority_tier/authority_score/doc_type` por folder-map + LLM sobre los 5.498 docs. Hasta entonces, no afirmar `source_of_record`.
- Criterio: distribución de `authority_score`/`review_status` deja de ser un único valor.

**Fase 2 — Gestor documental.**
- Pantalla `/admin/documents` sobre `rag_documents`: filtros por review/authority/source_hash/md_path; acciones approve/reject/reclassify/retire/supersede; visor de markdown (`md_path`); panel de salud de cola consumiendo `GET /api/ingest/queue`.
- Criterio: el documentalista cierra el ciclo de un documento sin SQL.

**Fase 3 — Consolidar ingesta de verdad.**
- Convertir `ingest-dms.mjs`/`ingest-key-docs.mjs` en *queue-population-only* o retirarlos; `queue-processor.ts` único writer.
- Re-ingestar (o backfill de `source_hash`+markdown) el corpus para que deje de ser legacy ingobernado.
- Criterio: % de docs con `source_hash` y `md_status='generated'` → ~100%.

**Fase 4 — Harness de intake (portar MDL).**
- Upload → Drive → Gmail bot → Inngest (jobs durables, estados, workflow events, reproceso). OCR Mistral. Chunking heading-aware.
- Criterio: el mismo documento por 3 canales deduplica por `source_hash`.

**Fase 5 — Trazabilidad y calidad del chat.**
- Quitar/neutralizar la instrucción de "usar cifras del prompt directamente"; mover los hechos de financiación a un tool con fuente (o etiquetarlos "contexto, verificar").
- Umbral de similitud en `match_chunks`; `tsvector` ES/EN; ordenación authority-aware; `embedding_model` por chunk.
- Visor que trace answer→source→chunk→doc→markdown→original→review.
- Criterio: cero afirmaciones financieras sin source card.

**Fase 6 — Evals y operaciones.** Set recurrente de preguntas críticas con fuentes esperadas; smoke test e2e; scheduler de cola.

---

## 11. Primeros 5 cambios concretos

1. **RLS lockdown + auth** (C1/A7): migración que dropea `open_all`, activa RLS en `ingest_queue`, y crea políticas por rol; añadir Supabase Auth + gate en `/admin` y `/api`. Mover service key a server-only.
2. **Quitar el DEFAULT `approved`/`human`** (C3): migración `005` que cambia defaults a `needs_review`/`agent_auto` y **backfillea los 5.498 docs** a `needs_review` (para que la degradación deje de ser código muerto y nadie trate el corpus como verdad mientras no se clasifique).
3. **Cuarentenar los 2 scripts legacy** (C4): renombrar a `.legacy`/mover a `scripts/_archive/`, o reconvertir a poblar `ingest_queue`. Cierra la fuente de duplicados/ingobernados.
4. **Neutralizar la instrucción de hechos hardcodeados** (C2): editar `SYSTEM_PROMPT` (route.ts:213–223) para que las cifras de financiación se marquen como "contexto no verificado — buscar y citar antes de afirmar", o moverlas a un tool `get_deal_structure` con fuente.
5. **Document Manager mínimo** (§8): página `/admin/documents` (lista + approve/reject/reclassify/retire + visor markdown) y página de salud de cola consumiendo `GET /api/ingest/queue`.

---

## 12. Archivos exactos a tocar

- `src/app/api/chat/route.ts` — system prompt (213–223), añadir umbral/authority-aware al consumir `match_chunks`, gate auth.
- `src/lib/rag/embeddings.ts` — separar limitador de chat vs ingesta (A5); añadir `embedding_model` a `ChunkMetadata` (A6).
- `src/lib/rag/parse.ts` — fallback no-Excel + hook OCR (A1/A2).
- `src/lib/rag/rerank.ts` — subir/eliminar truncado 1500 (A4); ponderar autoridad.
- `src/lib/ingest/queue-processor.ts` — defaults de gobierno (C3); clasificador en reserva (Fase 1).
- `src/lib/knowledge/source-reference.ts` — sin cambios de lógica; depende de datos de autoridad.
- `scripts/ingest-dms.mjs`, `scripts/ingest-key-docs.mjs` — cuarentena/reconversión (C4).
- `src/app/admin/documents/page.tsx` (**nuevo**) + `src/app/api/knowledge/documents/route.ts` (**nuevo**) — gestor (§8).
- `src/app/admin/corpus/page.tsx` (**nuevo**) — salud de cola.
- `src/components/layout/Sidebar.tsx` — nav a las pantallas nuevas.
- `middleware.ts` (**nuevo**) — auth gate.
- `sql/` — migraciones (abajo).

## 13. Migraciones necesarias

1. `005_security_rls_lockdown.sql` — drop `open_all`; `ENABLE RLS` en `ingest_queue`; políticas por `authenticated` (lectura) y server/service (escritura).
2. `006_governance_defaults_backfill.sql` — `ALTER ... SET DEFAULT 'needs_review'` (review_status) y `'agent_auto'` (classification_source); `UPDATE rag_documents SET review_status='needs_review'` para el corpus legacy; índice por `authority_score`.
3. `007_rag_chunks_embedding_model.sql` — `ADD COLUMN embedding_model text`; backfill `'gemini-embedding-001'`.
4. `008_match_chunks_threshold.sql` — `match_chunks` con parámetro `match_threshold` y ordenación que considere `authority_score`; `keyword_search_chunks` con `to_tsvector('spanish'/'english')` o config bilingüe.
5. (Fase 4) tablas de job estilo `agent_attachment_jobs` + `workflow_events` portadas de MDL.

## 14. Pruebas mínimas end-to-end

1. **Trazabilidad**: una pregunta → source card → chunk → `rag_documents` → `md_path` → original → `review_status` visible. (Criterio de cierre del SPEC.)
2. **Documento rechazado**: marcar `review_status='rejected'` desde el gestor → no aparece en `search_documents` (ya garantizado por RPC) **y** desaparece de la UI.
3. **No-aprobado degradado**: doc `needs_review` → relevancia penalizada y badge "SIN REVISAR" visible.
4. **Anti-hardcode**: preguntar por una cifra de financiación → la respuesta cita documento o dice explícitamente que no hay fuente; **no** recita el prompt.
5. **429 Gemini**: simular rate-limit en ingesta → cola hace backoff, no marca `done` con chunks parciales, chat sigue respondiendo (limitador desacoplado).
6. **LlamaParse caído**: PDF con LlamaParse forzado a fallar → documento a `error` controlado, no chunks huérfanos.
7. **Dedup multi-canal**: mismo binario por upload y por Drive → un solo `rag_documents` (mismo `source_hash`).
8. **Seguridad**: cliente con solo anon key → `select * from rag_documents` devuelve 0 filas / 401.

## 15. Criterio para considerar CERRADO el sistema de chat documental

Se considera cerrado cuando, **verificable en BD y UI**:
1. Ningún rol anónimo puede leer `rag_*`/`fct_*`/`intel_*`; `/admin` y `/api` de escritura están autenticados.
2. La distribución de `review_status`/`authority_score`/`classification_source` **refleja clasificación real**, no un único DEFAULT; `source_of_record` se emite solo para `authority≥90 + approved` reales.
3. Existe un gestor documental donde el documentalista aprueba/rechaza/reclasifica/retira/supersede y ve el markdown.
4. ≥99% de los documentos tienen `source_hash` y `md_status='generated'`; `queue-processor.ts` es el único writer; los scripts legacy no pueden re-poblar.
5. El chat **no afirma ninguna cifra sin fuente**; toda respuesta crítica expone source cards con review status real y `tool_calls` auditables.
6. Hay OCR, umbral de similitud, keyword con stemming y `embedding_model` por chunk.
7. Existe un eval set recurrente que pasa, y un smoke e2e (cola→reserva→parse→markdown→chunks→embeddings→chat→source card→trazabilidad).
8. La cola se procesa sola (scheduler) y los stuck-jobs se recuperan.

Mientras 1–3 no se cumplan, el sistema **no es un bot documental gobernado**: es un RAG plano con una capa de gobernanza decorativa sobre una base de datos abierta. Funciona como demo; no es defendible ante un CFO, un auditor o el RGPD.

---

### Anexo — Contradicciones entre documentos de memoria (a corregir)
- `chat-rag-ingest-status-vs-mdl.md` dice "SQL 004 no aplicado" → **falso** (aplicado, verificado).
- `CLAUDE.md` dice chat = "GPT-4o" → **falso** (`claude-sonnet-4-20250514`).
- `knowledge-system.md`/`layer3` dicen 150K/27.600 chunks → real **156.898**.
- Todos describen una gobernanza activa; la BD muestra 100% defaults. Los docs describen el *diseño*, no el *estado*. Recomendado: un único `STATE.md` derivado de queries, no de intención.
