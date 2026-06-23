# Análisis de estado del repo y cierre de gaps vs MdL/Teras — 2026-06-23

> Documento de memoria para continuidad. Resume (a) el estado real del repositorio y de la
> última versión, y (b) una revisión de toda la documentación de análisis de gaps del chat
> documental de **Gemswell MIS** frente a la convergencia con **mdl-patrimonio (MdL/Teras)**.
>
> **Limitación de alcance:** en esta sesión solo está montada la carpeta `GEMSWELL_MIS`.
> El repo `/Users/moisesmenendez/Dropbox/DESARROLLO/mdl-patrimonio` **no es accesible** desde
> aquí, así que el "lado MdL" se describe según los docs de convergencia (corte 2026-06-04) y
> **no se ha podido verificar el estado actual de MdL contra su código**. Todo lo de Gemswell sí
> está verificado contra el código y el git del working tree a fecha de hoy.

---

## 1. Estado del repositorio y última versión

### 1.1 Git / despliegue

- Repo de la app: `GEMSWELL_MIS/gemswell-mis-app` (la raíz `GEMSWELL_MIS` **no** es un repo git; el git vive dentro de `gemswell-mis-app`).
- Rama: `main`. `HEAD == origin/main == a3bccfb` → **lo commiteado está desplegado** (Vercel auto-deploy desde `main`).
- Último commit: `a3bccfb — Complete SharePoint RAG ingestion tooling` (2026-06-19).
- `package.json`: `gemswell-mis` **v0.1.0**, sin tags de versión (el versionado real es el historial de commits + las migraciones SQL aplicadas).

**Últimos commits relevantes:**

```
a3bccfb  Complete SharePoint RAG ingestion tooling      (2026-06-19, deployed)
959be5c  docs: add backlog decision pack
89b0a2f  feat(chat): preserve provider metadata for history
e62d483  fix(documents): queue library uploads asynchronously
c660a05  fix(ingest): link failed jobs to document recovery
454ad0c  fix(ingest): stop retrying near-empty parse failures
16fd38e  feat(documents): retry and delete failed ingests
59bcf46  fix(chat): surface high-relevance unreviewed retrieval
da18d47  feat(chat): find_document tool — '¿está subido el documento X?'
741e632  feat(chat): conversation history sidebar
4c9fe37  feat(chat): Gemini fallback (full parity) when Anthropic unavailable
```

### 1.2 Working tree — versión "en vuelo" (NO commiteada, NO desplegada)

Hay trabajo sin commitear: **17 ficheros modificados, +1.478 / −103**. Es el frente activo y aún no está en producción:

| Fichero | Δ | Lectura |
| --- | ---: | --- |
| `src/lib/rag/retrieve.ts` | +499 | Endurecimiento de recuperación híbrida |
| `src/lib/chat/agent.ts` | +403 | Núcleo del agente / tool loop |
| `scripts/eval/run-answers.ts` | +192 | Ampliación del harness de evals |
| `src/lib/chat/agent-gemini.ts` | +71 | Paridad del fallback Gemini |
| `src/app/api/chat/route.ts` | +69 | Ruta de chat |
| `src/lib/chat/__tests__/agent-prompt-guard.test.ts` | +48 | Tests de guardarraíl anti prompt-injection |
| `scripts/eval/golden.json`, `history.ts`, `source-reference.ts`, … | varios | Evals + historial + source cards |

Línea editorial del frente: **fallback Gemini con paridad completa + retrieve más robusto + guardarraíl de prompt + más cobertura de evals**. Conviene cerrarlo (commit + gates + push) o stashearlo antes de empezar trabajo nuevo, para no mezclar pasadas.

### 1.3 Corpus y producción (corte 2026-06-19, tras refresh SharePoint)

- Producción: `https://gemswell-mis-app.vercel.app` (admin-only, corpus RLS-locked, `sql/013` aplicada).
- Supabase prod: `nqxhsjkcvfxygiajdxki`.
- `rag_documents = 6.895`, `rag_chunks = 213.438`, `approved = 3.477`, `needs_review = 1.368`, `source_of_record = 814`.
- Migraciones RAG/chat aplicadas a prod: **013, 014, 015, 019, 022, 023, 025, 026, 028, 031, 034, 035, 036**.
- Refresh SharePoint se hizo por **export ZIP local** (no hay conector Graph ni credenciales Azure). Cola final: `done=1366`, `error=24`, `canceled=1`, `enqueueable=0`. Fallos terminales = 22 paths / 20 docs (sin texto, PDF corrupto o protegido).
- Embedding **pineado a `gemini-embedding-001` (768d)**; `001` y `gemini-embedding-2` **no son interoperables** (no cruzar corpus sin re-embed). `rag_chunks.embedding_model` es el guard de procedencia pero **aún no está enforced en `match_chunks`**.

### 1.4 Arquitectura (4 capas, verificada)

1. **Corpus** — `rag_documents`, `rag_chunks`, fact tables (`fct_capex_snapshot`, `fct_funding_snapshot`, `fct_cash_13w`; solo MAD+BHX).
2. **RAG/Chat** — `/api/chat`: vector (`match_chunks`, HNSW iterative scan) + keyword bilingüe (`keyword_search_chunks`, OR) → rerank Cohere → orden por trust-tier → **Claude** (analítico→`claude-opus-4-8`, simple→`claude-sonnet-4-6`) con pasada verificadora Opus, **SSE-streamed**, project-scoped, con frontera de contenido no confiable (anti prompt-injection). Fallback **Gemini** con paridad.
3. **Extracción (Layer 3)** — tablas `intel_metric_*`, review en `/admin/review`, packs en `/admin/packs`.
4. **Reporting** — `rpt_pack`, dashboards de dominio.

Herramientas del chat verificadas en código: `search_documents`, `find_document`, `get_capex_summary`, `get_funding_status`, `get_cash_runway`, `get_covenant_status`, `get_risk_register`, `get_contradictions`, `get_portfolio_context`, `compare_projects`. (`some_new_tool` es solo de test, no es una herramienta real.)

Modos de grounding del chat: `standard` (default, divulga fuentes sin revisar con badge determinista), `trusted_only` (solo revisadas), `official_only` (solo `source_of_record`).

---

## 2. La documentación de gaps vs MdL — inventario

Los documentos núcleo de la convergencia (todos con corte **2026-06-04**) son:

| Documento | Qué es |
| --- | --- |
| `docs/knowledge-convergence-functional-spec.md` | El **contrato** de convergencia: intake, labels, documento canónico, markdown frontmatter, chunk metadata, chat tools, evidencia. Incluye matriz de cobertura funcional Gemswell vs MdL y checklist del documentalista experto. |
| `docs/chat-rag-ingest-status-vs-mdl.md` | El **comparativo directo** Gemswell vs MdL en chat, RAG/ingesta y evidencia, con semáforo por frente, gaps por lado y plan de convergencia corto/medio/largo. |
| `docs/mdl-convergence-refactor-prompt.md` | El **prompt maestro** para arrancar la convergencia *dentro de* mdl-patrimonio (portar a MdL el tool loop, source verification, Layer 3 y markdown artifact de Gemswell). |
| `docs/chat-rag-ingest-memory-state-2026-06-04.md` | Snapshot de memoria de Gemswell de esa misma fecha (baseline citado por el prompt). |

Documentos posteriores que **trazan el cierre** de esos gaps: `auditoria-critica-chat-documental-2026-06-05/07`, `plan-saneamiento-chat-maxima-calidad-2026-06-07`, `estado-gestor-documental-2026-06-13`, `plan-trabajo-fondo-rag-2026-06-13`, `beta-readiness-p0-chat-documents-2026-06-16`, `sharepoint-rag-ingestion-runbook-2026-06-19`, y `docs/uat/*`.

### 2.1 La tesis de convergencia (bidireccional)

- **Gemswell** = más avanzado en arquitectura conversacional auditable (tool loop, `tool_calls`, source cards, verificación de fuente, Layer 3 de evidencia).
- **MdL/Teras** = más avanzado en harness operativo de ingesta (Gmail bot `bot@terascap.es`, Inngest, `agent_attachment_jobs`, clasificador LLM, OCR Mistral, chunking heading-aware, markdown publish).
- **Regla de convergencia:** Gemswell adopta la disciplina de ingesta de MdL; MdL adopta la disciplina conversacional y de verificación de Gemswell; **ambos comparten contratos** (intake, labels, documento canónico, markdown, chunks, governance, review). Gemswell **no** copia la ingesta legacy de MdL; MdL **no** copia el prompt monolítico de Gemswell.

---

## 3. Cierre de gaps de Gemswell (lo que el comparativo pedía a este chat) — estado hoy

Estado **verificado contra el código actual de Gemswell**. Leyenda: ✅ cerrado · 🟡 parcial · ⛔ abierto/divergido.

| # | Gap original (2026-06-04) | Estado hoy | Evidencia |
| --- | --- | :---: | --- |
| 1 | `sql/004` de governance creado pero **sin aplicar**; sin governance live desde el documento padre | ✅ | Migraciones 013…036 aplicadas a prod; `match_chunks`/`keyword_search_chunks` inyectan metadata viva (review_status, authority, lifecycle) |
| 2 | System prompt con mucho conocimiento Gemswell **hardcoded** | 🟡 | El contexto estructurado ahora se sirve por tools (`get_portfolio_context`, etc.); el prompt sigue teniendo dominio, pero respaldado por herramientas |
| 3 | **Sin eval set** recurrente de preguntas críticas | ✅ | `scripts/eval/golden.json` + `run-answers.ts` + `prompt-behavior-check.ts`; en ampliación activa (working tree) |
| 4 | Faltan tools `get_document_status` / `get_document_inventory` / `compare_sources` | 🟡 | Añadidos `find_document` (existencia), `get_contradictions`, `get_portfolio_context`; `compare_sources` como tal aún no existe |
| 5 | Chunking **financiero, no heading-aware** | 🟡 | El markdown ya es heading-estructurado (`#`/`##` por hoja/sección) + provenance de página; el chunker sigue siendo financiero/paragraph-aware (test `chunk-financial`), no un splitter por heading portado de MdL |
| 6 | **Sin OCR fallback** para escaneados | ✅ | `src/lib/rag/ocr.ts` (Mistral), opt-in `MISTRAL_API_KEY`+`RAG_OCR_ENABLED`, live en Vercel |
| 7 | Sin medición de calidad de parseo | 🟡 | Fallos terminales se marcan `status='error'` y son recuperables/visibles; no hay métrica de calidad formal |
| 8 | Markdown artifact **sin probar** con ingesta real | ✅ | Smoke E2E PASS 2026-06-16 → `artifacts/{id}/v1.md` en Storage (job `60ac7127…`) |
| 9 | Scripts legacy pueden **saltarse** el pipeline | ✅ | `ingestBuffer` (`queue-processor.ts`) es el entrypoint gobernado; jobs durables por defecto; regla "no bypass `ingestBuffer`" |
| 10 | Sin adaptadores maduros de browser upload / Drive / Gmail / Inngest | ⛔/🟡 | Browser upload **maduro** (async durable). Drive/Gmail/Inngest **no adoptados** — divergencia deliberada (ver §4) |
| 11 | Clasificación por folder/cola, no LLM+review | 🟡 | `classification_source` = `agent_auto`/`agent_reviewed`/`rule`; scripts de reclasificación Opus; clasificador-en-intake menos central que en MdL |
| 12 | Sin job table como `agent_attachment_jobs` | ✅ | `knowledge_ingest_jobs` (`sql/031`): leases 2h, claim atómico `FOR UPDATE SKIP LOCKED`, retry/cancel por compare-and-swap, cron `*/5` |
| 13 | Sin workflow events | ✅ | `rag_document_events` + API `GET /api/intel/review/history` (acciones documentales + decisiones de métricas) |
| 14 | Sin reprocess/stuck-job recovery | ✅ | Reaper de `processing` varados + `npm run ingest:jobs-direct` (recuperación de jobs expirados / quota LlamaParse) |

**Capa de evidencia (Layer 3, donde Gemswell ya iba por delante):** la extracción automática de métricas y la publicación a fact tables seguían pendientes de cerrar como pipeline; hoy existe `scripts/publish-pack.mjs` (Layer 3 → 4) y una contradicción real registrada (`intel_contradiction_alert`: CapEx MAD ~€57M vs ~€65M, abierta a la espera de CFO). Estado: 🟡 funcional, en validación con corpus real.

### 3.1 Lectura

De los 14 gaps de ingesta/RAG/chat que el comparativo señalaba en Gemswell, **~8 están cerrados**, **~5 parciales** y **1 es divergencia deliberada** (Drive/Gmail/Inngest). El salto grande desde el 2026-06-04 fue: governance live aplicada, cola de ingesta durable propia (`knowledge_ingest_jobs`), OCR portado, markdown artifact probado E2E, modos de grounding, recuperación de fallos y beta-readiness P0 cerrado.

---

## 4. Divergencias deliberadas respecto a MdL

No todo gap se "cierra copiando MdL". Decisiones tomadas en Gemswell que se apartan a propósito del harness de MdL:

1. **Ingesta sin Inngest ni Gmail bot.** En lugar del harness de eventos de MdL, Gemswell usa una **cola cron durable propia** (`knowledge_ingest_jobs` + worker `*/5`) y, para el corpus masivo, **export ZIP de SharePoint/OneDrive local** (no existe conector Graph ni credenciales Azure en este repo). Es el camino aprobado, no una carencia a "rellenar con MdL".
2. **Chat por defecto `standard`**, no estricto: divulga fuentes sin revisar con badge determinista en vez de bloquearlas. El modo `official_only`/`trusted_only` es opt-in. (Decisión de producto abierta: si el asistente CEO/CFO debe defaultear a `trusted_only`.)
3. **Embedding pineado** a `gemini-embedding-001` (768d) con guard de procedencia `embedding_model` — aún **no enforced** en `match_chunks` (se lee solo en write de ingesta; el enforcement irá en la próxima recreación de RPC clase-023).

---

## 5. La otra mitad: convergencia *dentro de* MdL (no verificable aquí)

`mdl-convergence-refactor-prompt.md` es el prompt maestro para que **mdl-patrimonio adopte de Gemswell**: contratos compartidos (`KnowledgeIntakeItem`, `DocumentLabels`, `CanonicalDocument`, `MarkdownFrontmatter`, `SourceReference`), tool loop explícito, exclusión fail-closed de rechazados, markdown artifact con frontmatter, Layer 3 de evidencia y conversión del chat monolítico de MdL a herramientas.

**No verificable en esta sesión:** mdl-patrimonio no está montado, así que no se ha podido confirmar cuánto de ese prompt se ejecutó en MdL ni el estado actual de su código. Para cerrarlo haría falta montar también esa carpeta.

Criterio de éxito de la convergencia (del SPEC): que un documentalista experto pueda trazar una respuesta del chat **answer → tool call → chunk → documento canónico → markdown artifact → fuente original → review status** en *ambos* sistemas. Gemswell ya lo cumple para uploads nuevos; el backfill legacy (originales en Storage, `source_hash`, `md_path`, `content_hash`) sigue pendiente.

---

## 6. Riesgos actuales (Gemswell)

- **Working tree sin commitear** (+1.478 líneas en agente/retrieve/evals): riesgo de pérdida o de mezcla de pasadas. Cerrar o stashear.
- **Backfill legacy incompleto:** la mayoría del corpus legacy no tiene bytes originales en Storage, `source_hash` ni markdown artifact → dedup robusto, descarga desde cita y reingesta durable limitados para esos docs.
- **Provenance de embedding no enforced** en `match_chunks` → riesgo si algún día entran vectores de otro modelo sin re-embed.
- **CapEx MAD contradictorio** (€57M vs €65M) abierto a la espera de CFO.
- **Layer 3** (extracción/publicación/contradicciones) aún en validación con corpus real.

---

## 7. Próximos pasos sugeridos

1. **Cerrar la pasada en vuelo:** gates (`npx tsc --noEmit`, `npm run lint`, `npx vitest run`, `npm run build`) → commit → push del frente Gemini-parity/retrieve/prompt-guard/evals.
2. **Decidir postura de grounding por defecto** para el asistente CEO/CFO (`standard` vs `trusted_only`), evaluándolo con `scripts/eval`.
3. **Backfill legacy** por prioridad: legal, board, funding, cuentas auditadas, BP models → subir originales, sellar `source_hash`/`md_path`/`content_hash`, regenerar markdown artifacts.
4. **Enforcement de `embedding_model`** en la próxima recreación de RPC clase-023.
5. **Para la convergencia MdL:** montar `mdl-patrimonio` en una sesión y auditar qué partes del prompt maestro se ejecutaron; producir el `docs/knowledge-convergence-mdl-audit.md` que el prompt pedía como primer entregable.
6. **Heading-aware chunking real** (gap 5) si se decide igualar a MdL: splitter por heading sobre el markdown ya estructurado, manteniendo el chunking financiero como caso especial.

---

## Anexo — comandos de verificación usados

```bash
# Estado git / versión
cd gemswell-mis-app && git status && git log --oneline -25 && git diff --stat
git rev-parse --short HEAD origin/main         # a3bccfb == a3bccfb (desplegado)

# Tools del chat (verificación)
grep -rhoE "name: *['\"][a-z_]+['\"]" src/lib/chat src/app/api/chat | sort -u
grep -rn 'some_new_tool' src/                  # solo en tool-call-display.test.ts

# OCR / grounding / chunking
ls src/lib/rag/ocr.ts
grep -nE 'trusted_only|official_only|standard' src/app/api/chat/route.ts
grep -nE '^#|## |section|heading' src/lib/rag/parse.ts
```
