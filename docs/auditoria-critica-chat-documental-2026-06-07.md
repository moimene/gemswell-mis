# Auditoría Crítica — Sistema de Chat Documental Gemswell MIS

Fecha: 2026-06-07
Auditor: arquitecto senior RAG / auditor documental / ingeniero de producción / revisor crítico (modo adversarial, sin complacencia)
Método: lectura de código (no de docs), 4 subagentes especializados (RAG interno · ingesta · gobernanza+esquema vivo · convergencia MDL), verificación contra Supabase vivo `nqxhsjkcvfxygiajdxki`, comparación con `mdl-patrimonio`, y contraste con la auditoría previa `auditoria-critica-chat-documental-2026-06-05.md`.

> Regla de esta auditoría: **ningún elogio sin evidencia y ningún reproche sin `file:line` o cifra de BD.** Donde los documentos de memoria y el código se contradicen, manda el código y la base de datos.

---

## 0. Qué cambió desde la auditoría del 2026-06-05 (importa para el veredicto)

Esta es la segunda pasada. La honestidad obliga a reconocer que **los tres CRÍTICOS más ruidosos de junio-5 se han arreglado de verdad** (verificado, no asumido):

| CRÍTICO 2026-06-05 | Estado 2026-06-07 (verificado) |
|---|---|
| **C1 — corpus world-readable** (RLS `USING(true)`, anon key pública) | **CERRADO.** `pg_class.relrowsecurity=true` en `rag_documents/chunks/messages/conversations/ingest_queue/intel/fct`; políticas `authenticated` con `qual = auth.jwt()…role = 'admin'`. (`sql/013`). |
| **C2 — el system prompt recitaba cifras financieras hardcodeadas como verdad** | **CERRADO.** `SYSTEM_PROMPT` reescrito (`agent.ts:150`): *"Do not treat this prompt as a source of financial truth."* Cero importes hardcodeados. |
| **C3 — gobernanza vacía (100% `approved`, autoridad 0)** | **PARCIAL.** Ya hay distribución real: 3.231 approved / 2.267 needs_review; autoridad poblada; 797 docs auth≥90+approved. |
| **Retrieval vector que expiraba en silencio (PostgREST/HNSW)** | **CERRADO.** `match_chunks` iterative-scan (`sql/015` live) + keyword df-aware (`sql/018` live), ambos verificados en la BD. |
| **No había gestor documental** | **PARCIAL→SÍ.** `/admin/documents` con approve/reject/reclassify/retire/supersede operativos + RPC transaccional con optimistic-lock (`sql/010/011`). |

**Por tanto, la tesis ya NO es "RAG plano con gobernanza decorativa sobre una BD abierta".** Es un sistema materialmente más serio. Pero —y aquí está el giro incómodo de esta segunda pasada— **arreglar la gobernanza ha activado un fallo de frontera de confianza que la "deadness" anterior ocultaba.** El centro de gravedad se ha movido de *"la gobernanza es teatro"* a *"la gobernanza es real pero no se aplica donde importa: en el retrieval del chat".*

---

## 1. Veredicto duro (10 líneas)

1. El sistema dio un salto real desde junio-5: RLS cerrado, prompt evidence-disciplined, retrieval arreglado, gestor operativo, SSE+verificador+frontera anti-inyección. **Crédito merecido; no es una demo abierta.**
2. **El nuevo CRÍTICO #1: 7.554 chunks de 2.267 documentos `needs_review` entran al contexto del chat del CEO/CFO**, filtrados solo por una advertencia en prosa que el LLM "debería" honrar (`sql/018:94`, `retrieve.ts:63`, `agent.ts:143`). El filtro de retrieval solo excluye `rejected`.
3. **El tier de confianza superior está decapitado: `source_of_record` = 0 documentos elegibles** (verificado). 797 docs auth≥90+approved no llegan porque `classification_source` nunca es humano/revisado. La "verificación de fuentes" no discrimina por arriba.
4. **Fuga de superseded: 7 docs / 369 chunks** con `lifecycle='superseded'` siguen siendo recuperables (`status='indexed'`, ninguna RPC filtra `lifecycle`). Revisiones obsoletas citables junto a su reemplazo. Fix de una línea.
5. **Degradación silenciosa persiste:** el sistema que murió en silencio DOS veces sigue con `catch { return [] }` en ambas lanes (`retrieve.ts:100,122`). Un 429 de Gemini o un timeout de keyword degrada a media-máquina sin señal, y el mensaje de "0 documentos" llega a atribuir el corte a gobernanza.
6. **La ingesta es un único writer síncrono** (`queue-processor.ts:ingestBuffer`) sin recuperación programada (el reaper solo dispara en la siguiente subida, sin cron), con scaffolding muerto que apunta a endpoints 404 y scripts legacy ingobernados aún ejecutables.
7. **El chunking es la pieza peor diseñada:** corte por caracteres que parte tablas financieras (las pipe-tables markdown que el parser produce no disparan el detector "estructurado") y cero conciencia de cláusula legal; sin provenance de página.
8. **Sin OCR:** LlamaParse-only; ante un PDF escaneado, lanza error (`queue-processor.ts:328`). En un corpus de escrituras/board-packs eso deja documentos enteros fuera.
9. **Convergencia MDL:** forks en ejes opuestos — Gemswell domina el *leer/responder* (tool loop, híbrido+rerank+trust, verificador, anti-inyección), MDL domina el *ingerir* (Inngest durable, bot Gmail, OCR Mistral, Drive, md-repo Git). Portan cosas distintas y casi no se solapan.
10. **No hace falta reescritura.** El orden correcto: (a) cerrar la frontera de confianza en retrieval [días], (b) revisar el backlog de 2.267 `needs_review` o aceptar recall reducido [decisión de negocio], (c) hacer alcanzable `source_of_record`, (d) OCR + ingesta async portando MDL, (e) trazabilidad de página. **Hasta (a)+(b), "production-grade para CEO/CFO" no es defensible.**

---

## 2. Riesgos CRÍTICOS

### C1 — Documentos sin revisar entran al chat como evidencia (gated solo por prosa)
- **Evidencia (BD viva):** `needs_review` = 2.267 docs / **7.554 chunks** recuperables (status=indexed, no rejected). Es el **41% del corpus documental**.
- **Evidencia (código):** las RPC solo filtran `review_status <> 'rejected' and classification_source is distinct from 'agent_rejected' and status='indexed'` (`sql/018:94-96`, `sql/015:63-65`). `isRejectedSource()` (`retrieve.ts:63-66`) replica solo `rejected`. `needs_review` pasa todos los gates, se rankea y se inyecta en el contexto del modelo precedido de un `needsReviewWarning` textual (`agent.ts:140-147`) y un sufijo `[SIN REVISAR]` (`source-reference.ts:102`).
- **Por qué es CRÍTICO:** para un asistente de CEO/CFO, un documento **no validado** puede ser la fuente citada de una cifra/cláusula, con la única protección de que el LLM honre una advertencia en lenguaje natural. Es el fallo exacto que un sistema gobernado existe para impedir. En junio-5 esto era código muerto (todo era `approved`); **hoy es un agujero vivo de 7.554 chunks** porque la gobernanza se hizo real pero el gate no se actualizó.
- **Matiz controvertido (la decisión real):** *no* es un fix trivial. Excluir `needs_review` del chat elimina el 41% del corpus y puede degradar gravemente el recall. **El verdadero blocker no es el SQL: es el backlog de 2.267 docs sin revisar.** O se revisa (gestión), o se acepta menos recall, o se introduce un modo explícito. Cualquiera que diga "es una línea de WHERE" no ha mirado la distribución.

### C2 — El tier `source_of_record` es inalcanzable: la verificación de fuentes no discrimina por arriba
- **Evidencia (BD viva):** docs elegibles como `source_of_record` (auth≥90 ∧ approved ∧ `classification_source ∈ {human, agent_reviewed, agent_corrected}`) = **0**. Docs auth≥90 ∧ approved = **797**. `classification_source`: human=0, agent_corrected=0, agent_reviewed=7.
- **Evidencia (código):** `verificationFromGovernance()` exige validación humana para `source_of_record` (`source-reference.ts:75-80`, `HUMAN_VALIDATED_SOURCES` línea 3). Como ningún doc la tiene, **el techo real de cualquier fuente es `supporting`**; la UI nunca mostrará "fuente oficial" (`page.tsx:47`, `VERIFICATION_LABELS`).
- **Impacto:** `knowledge-system.md:57-59` vende "authority≥90 → source-of-record". En datos reales, **esa categoría no existe**. 797 documentos que deberían ser la columna vertebral probatoria del bot se presentan como mero "respaldo". La jerarquía de confianza que diferencia a Gemswell está **decapitada**.

### C3 — Fuga de documentos superseded en el retrieval
- **Evidencia (BD viva):** 7 docs `lifecycle='superseded'` con `status='indexed'` → **369 chunks recuperables**. Verificado además que **ninguna RPC referencia `lifecycle`** (`bool_or(prosrc like '%lifecycle%superseded%') = false`).
- **Impacto:** una revisión obsoleta (p.ej. *"Proposed Location Plan Rev 2"*, *"Surf Park Light layout"* — BHX/GVF planning) puede citarse **junto a su reemplazo**, produciendo respuestas contradictorias. Es exactamente la patología que un DMS con versionado existe para evitar.
- **Fix:** una línea (`and d.lifecycle is distinct from 'superseded'`) en ambas RPC + añadir `lifecycle==='superseded'` a `isRejectedSource()`. **El más barato de todos los CRÍTICOS.**

### C4 — Degradación de retrieval silenciosa y mensajes que la disfrazan de gobernanza
- **Evidencia:** `retrieve.ts:100-102` (lane vector) y `:104-124` (lane keyword) envuelven la RPC en `try { … } catch { return [] }`. Un 429 de Gemini en query-time o un timeout de keyword devuelven `[]` indistinguible de "no hay coincidencias"; `diagnostics` no lo refleja. Peor: si el pool queda vacío, el chat responde *"No relevant documents found. Some documents may have been excluded because their review status is rejected."* (`agent.ts:386-391`) — **atribuye un corte de infraestructura a la gobernanza.**
- **Por qué es CRÍTICO y no alto:** es la **misma clase de fallo silencioso que ya mató la lane keyword dos veces en producción** (HNSW timeout → `sql/014`; stopword cross-language → `sql/016/018`). Reincidir en `catch{return[]}` tras ese historial, sin instrumentación, es deuda de fiabilidad de primer orden para un bot que asesora sobre dinero.

### C5 — La ingesta no es transaccional, no tiene recuperación programada y conserva caminos peligrosos
- **Evidencia:**
  - Único writer real = `ingestBuffer` vía `POST /api/knowledge/upload` (los paths `/api/ingest/process|queue` del brief **no existen**). Corre **síncrono dentro del request** (`maxDuration=800`), sin transacción: reserva → md a Storage → loop de inserts de chunks → `update status='indexed'`. Si el proceso muere entre el último chunk y el `update`, quedan chunks committeados con el doc en `processing` invisible.
  - `reapStrandedDocuments` (recuperación de stranded) **no tiene scheduler**: solo se invoca fire-and-forget al inicio de la *siguiente* subida (`upload/route.ts:32`); no hay `vercel.json` cron. Si nadie vuelve a subir, los stranded no se recuperan; y el reaper marca `error`, no re-ingesta.
  - `scripts/_archive/ingest-dms.mjs` / `ingest-key-docs.mjs` siguen siendo `.mjs` ejecutables que escriben **directo a `rag_chunks` sin `source_hash`, sin gobernanza, con otro chunker y otro fallback de parseo** (pdftotext/mammoth). La cuarentena es un README, no un guard.
  - `scripts/ingest-worker.mjs` y `_archive/README.md` documentan como canónicos endpoints **404**. Un operador que siga el repo se estrella.
- **Impacto:** la "consolidación de ingesta" es cierta *hoy* solo porque se desconectaron los otros callers; el andamiaje muerto y los scripts ingobernados son una recaída a un comando de distancia. Sin transacción ni cron de recuperación, un board-pack grande que falle a mitad deja estado parcial que nadie recupera.

---

## 3. Riesgos ALTOS

### A1 — Chunking inadecuado para tablas financieras y documentos legales
- `chunkFinancialContent` (`embeddings.ts:203-380`) es un splitter de ~2000 chars con heurística regex. El detector "estructurado" se dispara por tabs o `>3` comas con dígito (`:227-229`), **pero el parser está afinado para emitir pipe-tables markdown** (`parse.ts:54-61`) que no tienen ni tabs ni ese patrón → las tablas caen a `chunkNarrative` y se **parten a mitad de fila** en el límite de 2000 chars, separando cabeceras de valores. El overlap declarado (200 chars) en realidad son "últimas 40 palabras" (`:362`). Cero conciencia de artículo/cláusula/numeración legal: un pacto de socios de 40 páginas se trocea por líneas en blanco. **Es la pieza con peor ingeniería y la más crítica para un corpus legal+financiero.**

### A2 — Sin OCR (LlamaParse es punto único de fallo para lo escaneado)
- `parse.ts` no tiene rama OCR; ante texto <50 chars lanza error con mensaje "documento escaneado" (`queue-processor.ts:328-333`). MDL tiene Mistral OCR con heurística de disparo (`chars<500 || singleCharLineRatio>0.4`). En escrituras/board-packs escaneados, Gemswell deja el documento **fuera del corpus**.

### A3 — Fusión keyword/vector ingenua (sin RRF), keyword es solo recall
- `retrieve.ts:128-138`: merge first-writer-wins con vector primero; un chunk hallado por ambas lanes **descarta su rank keyword**. No hay Reciprocal Rank Fusion. La señal de ranking keyword solo influye en la ruta degradada, donde además se mezcla `ts_rank_cd` (escala ilimitada) con coseno como si fueran comparables (`rerank.ts:89-100`, admitido en `:27-30`). `overlapCount` se vende como "señal de acuerdo" mientras se tira la evidencia keyword del solapamiento.

### A4 — `rag_term_df` (oráculo de selectividad keyword) es un snapshot manual sin refresco
- `sql/016/018` dependen de `rag_term_df` para evitar el timeout de `ts_rank_cd`. La tabla se refresca **a mano tras un bulk ingest** (`sql/016:34`); no hay trigger ni cron. Tras una ingesta grande, el oráculo queda obsoleto y el timeout silencioso (C4) puede volver. La resiliencia keyword es **parcheada, no robusta** (4 migraciones: 012→014→016→018).

### A5 — Sin trazabilidad de página; cita a granularidad de documento
- `parse.ts:117,168` captura `pageCount`/`page_separator` pero **nunca propaga la página al metadata del chunk**; `ChunkMetadata` no tiene campo de página; las RPC no devuelven `chunk_index`. Una cita a un board-pack de 200 páginas resuelve al documento entero, no a la página. Un humano no puede saltar al pasaje que respalda la cifra → la "verificación" del `knowledge-system.md` es inviable en la práctica para documentos largos.

### A6 — Provenance hueco: 0 ficheros originales, ~0 artefactos markdown
- **Evidencia (BD viva, prior + confirmado):** `storage_path` no nulo = 0/5.498; `md_path` no nulo = 2; `source_hash` = 2; `md_status='ready'` = 0. Para el 99,96% del corpus **no hay bytes originales ni artefacto markdown**: el visor del gestor muestra una *reconstrucción desde chunks* (`DocumentPanel`, "no es el artefacto original"), lossy en tablas/imágenes. Un documentalista no puede abrir el PDF real detrás de una cita. La confianza descansa en una reconstrucción.

### A7 — La gobernanza nunca se ha ejercido de verdad
- **Evidencia (BD viva):** `rag_document_events` solo registra acciones `approve` + `backfill_classify`, actores `admin:console` + `backfill`. **Cero rechazos, reclasificaciones, retiros o supersede ejecutados por un humano.** Los 3.231 "approved" salieron de un bulk-approve de consola, no de revisión documento a documento. La maquinaria del gestor es real pero **no probada contra documentos adversariales/edge**; los 2.267 `needs_review` son el verdadero gate de cutover y nadie los ha tocado.

### A8 — Acoplamiento chat/ingesta en el limitador de embeddings y autenticación de superficies de escritura
- `embeddings.ts` mantiene limitadores module-level; la query interactiva usa lane `'interactive'` separada (`retrieve.ts:85`) — mejor que junio-5, pero el modelo y la cuota Gemini siguen compartidos: un bulk ingest concurrente puede competir por cuota con la pregunta del CEO. Verificar que la lane interactiva realmente no encola tras el batch.

---

## 4. Riesgos MEDIOS

- **M1 — `source_channel` hardcodeado a `local_backfill`** para toda subida (`queue-processor.ts:60`); ni siquiera las subidas de navegador se etiquetan bien. Bloquea la atribución de Drive/email y un futuro bot.
- **M2 — Tres vocabularios de estado** (`'done'|'error'` del result vs `'indexed'|'processing'|'error'` de la columna vs `RagStatus 'failed'` del tipo, nunca escrito). Sin enum/CHECK; invita a un desajuste de filtro silencioso.
- **M3 — Dedup solo por hash de bytes y ausente en el legacy.** Índice único parcial `WHERE source_hash IS NOT NULL` + 5.496 NULL ⇒ sin dedup DB para el legacy; un re-export/re-render del mismo documento siempre duplica. Único guard nuevo = un toast por título.
- **M4 — `tool_calls` persistidos pero invisibles en la UI.** El chat guarda `tool_calls` (`route.ts:74`) pero `page.tsx` no los muestra; la procedencia de una respuesta de **dato estructurado** (capex/funding/…) no tiene source card y no se puede inspeccionar desde la UI → el usuario no ve "por qué" en respuestas estructuradas.
- **M5 — `detectEntities`/`detectFinancialMetadata` solo conocen MAD/BHX** (`agent.ts:220-244`, `embeddings.ts:383`); KLP/PHILAE/GVF no son filtrables desde el chat (solo cross-project) y el autotag de `project_id` a nivel chunk no cubre 4 de 6 entidades.
- **M6 — Layer 3 (`intel_*`) sigue mayormente sin operar.** El `get_contradictions` tool ahora cablea **una** alerta (MAD capex) al chat —bien—, pero la cadena de extracción/revisión/publicación (8 tablas, vistas) está construida muy por encima de su uso real; la contradicción MAD sigue abierta esperando CFO.
- **M7 — `CLAUDE.md` afirma "Migrations applied through 015"** mientras la BD tiene 016/017/018 live (verificado: df_ceiling=1500). Doc-rot: el estado real va por delante de su propia documentación (igual que junio-5).
- **M8 — Verificador puede sobre-recortar o no correr.** `verifyAnswer` (`agent.ts:845`) mitiga alucinación, pero ante fallo devuelve el draft sin verificar (badge "sin verificar", `page.tsx:323`) — aceptable, pero significa que la garantía anti-alucinación es best-effort, no dura.

---

## 5. Qué está BIEN y NO debe romperse

1. **El tool loop auditable** (`agent.ts:775-843`): bucle Anthropic limpio, máx 5 iteraciones, ejecución paralela de tools, persistencia de `tool_calls` + `sources` (`route.ts:59-75`). La mejor pieza del sistema.
2. **Separación structured vs documentary a nivel de herramienta**: `search_documents` (RAG) vs 6 tools sobre `fct_*`. El modelo distingue dato de evidencia porque son tools distintas. El prompt y el verificador lo refuerzan.
3. **El JOIN de gobernanza en las RPC** (`sql/015:42-54`, `sql/018:77-90`): inyecta `review_status/authority/lifecycle/...` *fresco* desde el documento padre en cada chunk, en vez de denormalizar (stale). Diseño correcto; el problema es el WHERE, no el JOIN.
4. **Trust-tier rank DESPUÉS del rerank** (`retrieve.ts:154-158`, `rank.ts`): Cohere rerankea el pool completo y luego se ordena por tier antes de truncar, de modo que la relevancia **no puede** sobreponer un chunk de baja confianza por encima de uno gobernado. (El bug es que "baja confianza" hoy incluye `needs_review` que sí entra — C1 — pero la *mecánica* de dominancia de confianza es correcta.)
5. **Frontera anti-inyección + verificador + prompt evidence-disciplined** (`agent.ts:176-183`, `injection.ts`, `verifyAnswer`): genuinamente bueno y raro de ver. El prompt reescrito es un acierto frente a junio-5.
6. **RLS lockdown admin-only + persistencia con ownership-check** (`route.ts:36-44`): cierra el mayor riesgo previo. No tocar salvo para refinar por rol.
7. **Gestor real**: `/admin/documents` con approve/reject(reason)/reclassify(allow-list)/retire/supersede operativos + RPC transaccional con optimistic-lock y guards de doble-supersede (`sql/010/011`). Mejor que el típico "admin panel de RAG".
8. **Upload directo a Storage** (`/api/knowledge/upload/sign`): sortea el cap de 4.5MB de Vercel; correcto para board-packs grandes.
9. **Safeguards de las tools financieras**: cap ±€50M y ventana 9 meses en cash (`agent.ts:524`), dedup de snapshots por fecha en risk/covenant.

---

## 6. Qué está SOBRE-diseñado

- **Layer 3 `intel_*`** (8 tablas + vistas + RPCs + alertas de contradicción): cadena documento→KPI construida casi entera, operada al mínimo (cero decisiones humanas reales; una sola contradicción cableada al chat). Gold-plating dirigido por spec antes de tener un revisor usándola.
- **La RPC keyword re-ingenierizada 4 veces** (012/014/016/018) en SQL cada vez más barroco (df_ceiling + or_cap + and-fallback) para sortear un `statement_timeout` de 8s que es, en el fondo, **un problema operativo** (subir el timeout del rol de retrieval o precomputar) — no de diseño de query.
- **El limitador de embeddings de dos lanes** con tail/nextAt independientes para un corpus descrito como "bulk one-time".
- **Rerank del pool completo** (hasta 40 docs) gastando tokens Cohere para habilitar una promoción de confianza que un post-filtro más simple lograría.
- **`contracts.ts`**: taxonomía riquísima (5 enums, `KnowledgeIntakeItem` con `gmail_bot`/`external_id`) cuyos tipos de intake **no tienen implementación** — dan falsa impresión de capacidad de bot.

Patrón persistente desde junio-5: el sistema invierte antes en *contratos y capas de evidencia* (lo intelectualmente satisfactorio) que en *aplicar la gobernanza en el gate del chat, OCR y trazabilidad de página* (lo aburrido y necesario).

## 7. Qué está INFRA-diseñado

- **Aplicación de gobernanza en retrieval**: una cláusula `<> 'rejected'` sustituyendo a un modelo de 4 estados de revisión + dimensión `lifecycle`. Es el filtro equivocado, no uno débil (C1, C3).
- **Alcanzabilidad de `source_of_record`**: la regla exige validación humana que nunca ocurre → tier vacío (C2). Falta una acción "endorsar como fuente oficial" de un clic.
- **Observabilidad de fallos**: `catch{return[]}` ×2 en el pipeline que ya murió en silencio dos veces (C4). Sin señal estructurada de "lane caída".
- **Chunking** (A1), **OCR** (A2), **trazabilidad de página** (A5), **provenance de bytes originales** (A6).
- **Ingesta async + recuperación programada + dedup del legacy + atribución de canal** (C5, M1, M3).
- **Visibilidad de la procedencia estructurada en la UI** (M4): el "por qué" de una respuesta de fct_* no se ve.

---

## 8. Gaps frente a MDL/Teras — qué portar DESDE MDL (priorizado)

| # | Capacidad | MDL (evidencia) | Gemswell | Acción / esfuerzo |
|---|---|---|---|---|
| P1 | **OCR escaneados** | Mistral `src/lib/agent/ocr.ts` + heurística disparo | lanza error | **Portar** (bajo-medio; adapter standalone). El de mayor leverage. |
| P2 | **Ingesta async durable** | Inngest `process-attachment.ts` (9 pasos, `retries:3`, idempotency, concurrency, event-sourcing) + `reprocess-stuck-jobs.mjs` | síncrona + reaper sin cron | **Adoptar modelo de job** (alto). Resuelve C5. |
| P3 | **Bot Gmail dedicado** (`bot@terascap.es`) | OAuth2 poll 15min + adjuntos→Storage→cola | tipos sin implementación | **Portar** (alto; depende de P2). |
| P4 | **Markdown publish a repo Git** | `publish.ts` → `terasia-md-repo`, frontmatter+hashes, idempotente | artefacto en Storage (2 docs) | **Operacionalizar** (medio; building-blocks ya existen). |
| P5 | **Drive sync** | `src/lib/rag/drive.ts` (googleapis) | ausente | **Portar si las fuentes viven en Drive** (medio). |
| P6 | **Clasificación con keywords sensibles + scoping** | `classify.ts` 13-BL + gate sensible | Haiku-classify sí, pero taxonomía por entidad legal | **Alinear taxonomías** (medio). |

**Matiz:** MDL **sí tiene** inbox/gestor documental autónomo de intake; en *autonomía de ingesta* MDL va por delante de Gemswell.

## 9. Gaps de MDL/Teras frente a Gemswell — qué portar DESDE Gemswell

| # | Capacidad | Gemswell (evidencia) | MDL | Acción |
|---|---|---|---|---|
| Q1 | **Lane keyword/FTS híbrida** | `retrieve.ts` vector+keyword bilingüe | vector-only + parches `criticalKeywords` | Portar `keyword_search_chunks` + GIN (MDL ya necesita la lección del stopword-timeout). |
| Q2 | **Verificador anti-alucinación** | `verifyAnswer` (`agent.ts:845`, ~40 líneas) | sin guardrail más allá del prompt | **Portar ya** (bajo). MDL produce decks para Santander sin red. |
| Q3 | **Trust-tier rank + disclosure** | `rank.ts` + `[SIN REVISAR]` | clasifica confidence pero el ranking lo ignora | Portar (medio). Cierra el loop gobernanza→ranking. |
| Q4 | **Tool-loop multi-paso** | `runAgentLoop` 9 tools | single-shot | Reescritura de control-flow (alto). |
| Q5 | **Frontera anti-inyección** | `injection.ts` + prompt | sin defensa; **ingesta email no confiable** | **Portar** (bajo). MDL lo necesita MÁS por el canal email. |
| Q6 | **Disciplina fail-closed de embedding** | `queue-processor.ts` (insert==chunks o throw) | bug latente modelo embedding | Portar disciplina. |
| Q7 | **Sacar la anon key del código** | nunca inline | hardcodea anon JWT como default (`chat/route.ts:14`) | **Trivial; hacer ya** (seguridad). |

**Veredicto de convergencia:** divergen en la capa de aplicación, convergen en la de datos (Supabase, pgvector, `rag_chunks`, Gemini 768d, `match_chunks`). Un `@teras/rag-core` compartido es factible **si se extrae ya**. **El mayor riesgo de convergencia: dos espinas de esquema documental distintas** (`rag_documents`+`project_id`+authority-governance vs `bl_documents`+`business_line_id`+`agent_attachment_jobs`) **y un pin de modelo de embedding divergente** (`gemini-embedding-001` vs `gemini-embedding-2-preview`, ambos 768d pero hay que verificar compatibilidad de vectores ANTES de cualquier corpus compartido). Portar feature-a-feature sin reconciliar esquema+modelo construye la misma capacidad dos veces y endurece el merge futuro.

---

## 10. Plan de refactorización por fases (sin reescritura)

**Fase 0 — Cerrar la frontera de confianza en retrieval. Bloqueante. Días.**
- C3 (1 línea): `and d.lifecycle is distinct from 'superseded'` en `match_chunks` + `keyword_search_chunks`; añadir `superseded` a `isRejectedSource`.
- C1 (decisión + código): añadir parámetro `review_filter` a las RPC (`approved_only` | `include_unreviewed`), **default seguro `approved_only` para el chat**, con `include_unreviewed` explícito para un modo "exploración" del documentalista. Exponer en `diagnostics` cuántos chunks unreviewed se usaron.
- C4: convertir `catch{return[]}` en `catch → diagnostics.vectorFailed/keywordFailed`; el mensaje de pool vacío debe distinguir "retrieval parcialmente caído" de "sin coincidencias" y **no** atribuirlo a `rejected`.
- Criterio: una query no puede citar un chunk `needs_review`/`superseded` salvo en modo explícito; un 429 produce un aviso, no un silencio.

**Fase 1 — Resolver el backlog de gobernanza (el verdadero gate).**
- Revisar/curar los 2.267 `needs_review` (o un subconjunto priorizado por autoridad). Sin esto, Fase 0 deja al bot con recall recortado.
- Hacer alcanzable `source_of_record` (C2): acción "endorsar como fuente oficial" de un clic que setee `classification_source='agent_reviewed'`/`human` + autoridad en una transacción; o relajar la regla para `agent_auto`+autoridad≥90+approved.
- Criterio: `source_of_record`-eligible > 0; la UI muestra "fuente oficial" para los docs que lo merecen.

**Fase 2 — Fiabilidad de ingesta (portar modelo MDL).**
- Cron de reaper (`vercel.json`) que además re-encole; transaccionalizar insert-chunks+status en una RPC; limpiar el artefacto Storage en el catch; `git rm` o `process.exit` en los scripts legacy; reescribir/eliminar `ingest-worker.mjs`; corregir READMEs.
- Adoptar OCR Mistral (P1) y, después, jobs durables Inngest (P2).
- Criterio: un board-pack que falle a mitad se recupera solo; cero writers ingobernables; PDF escaneado se ingiere.

**Fase 3 — Trazabilidad y calidad del chat.**
- Propagar `page` al metadata del chunk (A5); chunking table-aware que no parta filas y conserve cabeceras; conciencia de cláusula legal (A1). RRF en la fusión (A3). Refresco automático de `rag_term_df` (A4).
- Mostrar `tool_calls` en la UI (M4); `embedding_model` por chunk.
- Criterio: una cita resuelve a página; respuesta estructurada inspeccionable en UI.

**Fase 4 — Provenance e intake multi-canal.**
- Backfill DMS→Storage de los originales (priorizar 797 docs auth≥90); markdown publish a repo Git (P4); atribución de canal (M1); dedup del legacy (M3); bot Gmail (P3) + Drive (P5).
- Criterio: el mismo binario por upload/Drive/email deduplica por `source_hash`; el documentalista abre el original.

**Fase 5 — Operaciones y evals.**
- Set de evals recurrente con fuentes esperadas (ya existe `scripts/eval/` — extender con casos de gobernanza); smoke e2e cola→…→source card→trazabilidad; alertas de degradación.

---

## 11. Primeros 5 cambios concretos

1. **Excluir superseded del retrieval** (C3): `and d.lifecycle is distinct from 'superseded'` en ambas RPC + `isRejectedSource`. Migración `019`. *(1 línea SQL × 2 + 1 TS; horas.)*
2. **Gate de revisión parametrizado en el chat** (C1): añadir `review_filter` a `match_chunks`/`keyword_search_chunks` con default `approved_only` para `search_documents`, y `diagnostics.unreviewedUsed`. Migración `019`. *(medio; decisión de producto sobre el default.)*
3. **Instrumentar la degradación** (C4): `retrieve.ts` deja de tragar errores; el mensaje de pool vacío distingue outage de governance. *(bajo.)*
4. **Hacer alcanzable `source_of_record`** (C2): acción "endorsar como fuente oficial" en `/admin/documents` + RPC que setee class+autoridad atómicamente. *(medio.)*
5. **Neutralizar los caminos de ingesta peligrosos** (C5): `git rm` de `scripts/_archive/ingest-*.mjs` (o `process.exit` con aviso), reescribir/eliminar `ingest-worker.mjs`, corregir READMEs, y añadir cron de reaper en `vercel.json`. *(bajo-medio.)*

---

## 12. Archivos exactos a tocar

- `sql/019_retrieval_governance_filter.sql` (**nuevo**) — `match_chunks` + `keyword_search_chunks`: excluir `lifecycle='superseded'`; parámetro `review_filter`.
- `src/lib/rag/retrieve.ts` — pasar `review_filter`; `isRejectedSource` += superseded; sustituir `catch{return[]}` por diagnósticos de fallo de lane; propagar `unreviewedUsed`.
- `src/lib/chat/agent.ts` — `executeSearchDocuments` pasa `review_filter:'approved_only'` por defecto; mensaje de "sin documentos" no menciona `rejected` cuando hubo outage; (opcional) mostrar conteo de unreviewed usados.
- `src/lib/knowledge/source-reference.ts` — acción/contrato para `source_of_record` alcanzable (o relajar `HUMAN_VALIDATED_SOURCES`).
- `src/app/admin/documents/_components/DocumentPanel.tsx` + `src/lib/knowledge/governance-actions.ts` + `src/app/api/knowledge/documents/[id]/route.ts` — acción "endorsar como fuente oficial".
- `src/lib/rag/parse.ts` + `src/lib/rag/embeddings.ts` — propagar `page` a `ChunkMetadata`; chunking table-aware; hook OCR; `embedding_model` por chunk.
- `src/lib/ingest/queue-processor.ts` — transaccionalizar; limpiar artefacto en catch; `source_channel` parametrizado.
- `vercel.json` (**nuevo/edit**) — cron del reaper.
- `scripts/_archive/ingest-dms.mjs`, `ingest-key-docs.mjs`, `scripts/ingest-worker.mjs` — eliminar/neutralizar; `scripts/_archive/README.md` + `CLAUDE.md` (migraciones a 018) — corregir doc-rot.
- `src/app/chat/page.tsx` — render de `tool_calls` (procedencia estructurada visible).

## 13. Migraciones necesarias

1. `019_retrieval_governance_filter.sql` — recrear `match_chunks` y `keyword_search_chunks` con: `and d.lifecycle is distinct from 'superseded'`; nuevo parámetro `review_filter text default 'approved_only'` (`approved_only` → `d.review_status='approved'`; `include_unreviewed` → comportamiento actual). Rollback que restaure 015/018.
2. `020_chunk_page_provenance.sql` (+ cambio de ingesta) — soporte para `page`/`chunk_index` en el retorno de las RPC y en el metadata.
3. `021_rag_term_df_refresh.sql` — trigger o función programada para refrescar `rag_term_df` post-ingesta (cierra A4).
4. `022_embedding_provenance.sql` — `rag_chunks.embedding_model text`; backfill `'gemini-embedding-001'`.
5. (Fase 4) `0xx_source_channel_and_dedup.sql` — `source_channel` real; estrategia de dedup para el legacy (backfill `source_hash` donde haya bytes).

## 14. Pruebas mínimas end-to-end

1. **No-unreviewed por defecto**: query cuyo único match sea `needs_review` → en modo chat NO se cita (o se cita solo en modo explícito con badge); `diagnostics.unreviewedUsed` correcto.
2. **Superseded excluido**: marcar un doc `superseded` → desaparece de `search_documents` (hoy: 7 docs/369 chunks NO desaparecen).
3. **`source_of_record` alcanzable**: endorsar un doc auth≥90 → la fuente muestra "fuente oficial" en la UI (hoy: imposible).
4. **Degradación visible**: forzar 429 Gemini → respuesta con aviso "retrieval parcial", NO "excluido por rejected"; `diagnostics.vectorFailed=true`.
5. **Ingesta a medias**: matar el proceso tras insertar chunks y antes del `update` → el cron de reaper recupera/re-ingesta, sin chunks huérfanos en `processing`.
6. **PDF escaneado**: subir un PDF imagen → OCR lo ingiere (hoy: error).
7. **Dedup multi-canal**: mismo binario por upload y (futuro) email → un solo `rag_documents`.
8. **Trazabilidad página**: una cifra citada → source card → doc → **página** → original → review_status visible.
9. **Procedencia estructurada**: respuesta de `get_capex_summary` → la UI muestra el `tool_call` que la respalda.

## 15. Criterio para considerar CERRADO el sistema de chat documental

Cerrado cuando, **verificable en BD y UI**:
1. El chat **no puede citar** un documento `needs_review`/`pending`/`superseded`/`rejected` salvo en un modo de exploración explícito y etiquetado; la frontera se aplica en SQL, no en prosa. *(hoy: 7.554+369 chunks filtran).*
2. `source_of_record`-eligible > 0 y la distribución de `verification` discrimina por arriba (no todo `context`/`supporting`). *(hoy: 0).*
3. El backlog `needs_review` está curado o explícitamente segmentado; existe acción de un clic para fuente oficial. *(hoy: 2.267 intactos, 0 acciones humanas).*
4. La degradación de retrieval (429/timeout) es **visible** y nunca se disfraza de gobernanza.
5. La ingesta se recupera sola (cron), es transaccional, OCR-capable, y **no existe writer ingobernable**; ≥99% de docs nuevos con `source_hash` y artefacto.
6. Una cita resuelve a **página** y el original es abrible; la procedencia estructurada es visible en la UI.
7. El eval set de gobernanza (1–4) pasa en CI; smoke e2e verde.

Mientras 1–3 no se cumplan, el sistema es **un RAG bien construido con gobernanza real pero no aplicada en el punto de consumo**: defendible como herramienta interna, **no** como asistente documental gobernado ante un CFO, un auditor o el RGPD. La distancia hasta ahí es mucho menor que en junio-5 — pero el agujero que queda (frontera de confianza en retrieval) es precisamente el que más importa para un bot que asesora sobre dinero.

---

### Anexo A — Verificación en BD viva (2026-06-07, `nqxhsjkcvfxygiajdxki`)

| Métrica | Valor |
|---|---|
| review_status | approved 3.231 · needs_review 2.267 · (rejected 0 · pending 0) |
| status | indexed 5.498 (100%) |
| lifecycle | unknown 3.076 · draft 1.362 · working_paper 483 · executed 357 · signed 164 · filed 49 · **superseded 7** |
| classification_source | agent_auto 3.632 · rule 1.859 · agent_reviewed 7 · **human 0 · agent_corrected 0** |
| **needs_review docs / chunks recuperables por el chat** | **2.267 / 7.554** |
| **superseded docs / chunks recuperables** | **7 / 369** |
| **source_of_record-eligible** | **0** |
| authority≥90 ∧ approved (no llegan a source_of_record) | 797 |
| RLS sensibles | enabled, política admin-only (`auth.jwt()…role='admin'`) |
| ingest_queue | 2.406 done · 0 queued/processing/error |
| RPC live | `match_chunks` iterative-scan ✓ · `keyword_search_chunks` df_ceiling=1500 ✓ · `rag_term_df` existe ✓ · ninguna filtra `lifecycle` ✗ |

### Anexo B — Contradicciones de documentación a corregir
- `CLAUDE.md`: "Migrations applied through 015" → realidad **018 live** (df_ceiling=1500 verificado).
- `knowledge-system.md:22,74`: cita `/api/ingest/process` y `scripts/ingest-dms.mjs|ingest-key-docs.mjs` como canónicos → **endpoints 404 / scripts en `_archive` ingobernados**.
- `readiness-chat-gestor-2026-06-07.md`: etiqueta `/chat` "Production-grade" → con C1–C4 vivos, no defendible como production-grade para CEO/CFO.
- `knowledge-system.md:57-59`: "authority≥90 → source-of-record" → en datos reales, **source_of_record = 0**.
