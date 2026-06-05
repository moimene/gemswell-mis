# Spec — Gestor Documental Gobernado (A+B)

Fecha: 2026-06-05
Estado: aprobado para escribir plan de implementación
Origen: `docs/auditoria-critica-chat-documental-2026-06-05.md`
Alcance: sub-proyectos **A (fundación de corpus gobernado)** + **B (gestor documental)**. La consolidación del chat (C), auth/RLS y re-parseo masivo quedan **fuera**.

---

## 1. Problema (verificado en BD `nqxhsjkcvfxygiajdxki`)

- 5.498 `rag_documents`, 156.898 `rag_chunks`.
- **A nivel de documento, la gobernanza es vacía**: los 5.498 docs están `review_status='approved'`, `authority_score=0`, `authority_tier='unverified'`, `classification_source='human'` — todos DEFAULTs que la migración `004` estampó retroactivamente.
- **A nivel de chunk, la clasificación YA existe**: los chunks llevan `authority` real (95: 34k, 85: 32k, 80: 30k, 75: 10k, 90: 9k; null: 41k), `doc_type` rico (legal 55k, monitoring 28k, asset_management 24k, funding, capex, board, financial_statements…), `project_id` (MAD/BHX/PHILAE/KLP/GVF) y `dms_folder`.
- **El RPC `004` pisa la señal buena**: `COALESCE(c.metadata,'{}') || jsonb_build_object('authority_score', d.authority_score, …)` hace que el `authority_score=0` del padre gane sobre el `authority` real del chunk. Esa es la causa raíz de "todo autoridad 0".
- **No existe gestor documental**: solo hay UI de revisión de *métricas* Layer 3 (`/admin/review`); `intel_review_decision=0`, `intel_doc_authority=0` (nunca operado).
- **Tres writers de ingesta**; el corpus vivo (5.496 de 5.498) lo construyeron los scripts legacy ingobernados (`scripts/ingest-dms.mjs`, `ingest-key-docs.mjs`), no el pipeline canónico.

## 2. Objetivo

Cerrar el bucle: **clasificador propone gobierno → documentalista decide en el gestor → el chat solo ve lo aprobado/disponible, con metadata máximamente rica.**

### Principio rector (decisión de diseño explícita del usuario)
**Transparencia sobre bloqueo.** El chat ve el máximo de documentos; cada fuente lleva la metadata más rica y precisa posible. `needs_review` es etiqueta + penalización suave de ranking (×0.85), **no** ocultamiento. Solo `rejected` y `retired` salen del retrieval. El enriquecimiento LLM se aplica de forma amplia para maximizar la información de las source cards.

### No-objetivos (v1)
- Tocar el system prompt hardcodeado, umbral de similitud, stemming ES/EN, desacoplar el limitador de embeddings → **spec C**.
- Auth / RLS → pre-publicación.
- Re-parseo masivo de originales para generar markdown.
- Adaptadores upload / Drive / Gmail bot → harness MDL posterior.

## 3. Arquitectura — el bucle gobernado

```
ingesta (queue-processor, único writer)
        │  reserva + clasificador (lift-up reglas + Haiku amplio)
        ▼
 rag_documents  ◄──────── PATCH gestor (approve/reject/reclassify/retire/supersede)
   (gobierno     ─────────► rag_document_events (auditoría append-only)
    a nivel doc) │
        │ JOIN gobernanza (RPC arreglado: no pisa señal buena, filtra status+rejected)
        ▼
 match_chunks / keyword_search_chunks
        ▼
 chat  →  source cards con authority/tipo/periodo/ciclo/review reales
```

Unidades con frontera limpia:
- **Clasificador** (`src/lib/knowledge/classify.ts`): entra (título, muestra de chunks, folder) → sale `DocumentLabels` + confianza. Determinista en reglas; Haiku para enriquecer.
- **Backfill** (`scripts/backfill-governance.mjs` + `006`): orquesta lift-up + clasificador sobre el corpus. Idempotente, dry-run por defecto.
- **API de gobierno** (`/api/knowledge/documents*`): CRUD de gobierno sobre `rag_documents` + eventos.
- **Gestor UI** (`/admin/documents`): consume la API. No contiene lógica de negocio.

## 4. Modelo de datos

### Migración `005_governance_lift_and_fix.sql`
- Defaults nuevos (solo inserts futuros): `review_status` → `'needs_review'`, `classification_source` → `'agent_auto'`.
- Columnas de enriquecimiento en `rag_documents` (para maximizar info del chat): `summary text`, `topics text[]`, `currency text`, `entity_ids text[]`. (`project_id`, `doc_type`, `period`, `lifecycle`, `authority_*` ya existen.)
- Nuevo estado de retirada: `ALTER TYPE` no aplica a `status` (es `text`); `status` admite `'retired'`.
- **Fix del RPC** `match_chunks` y `keyword_search_chunks`:
  - No pisar señal buena durante la transición. **Ojo: `d.authority_score` tiene DEFAULT 0 (no NULL)**, así que un `COALESCE` simple devolvería 0 siempre → hay que usar `NULLIF(...,0)`:
    `'authority_score', COALESCE(NULLIF(d.authority_score,0), NULLIF((c.metadata->>'authority'),'')::int)`
    `'doc_type', COALESCE(d.doc_type, c.metadata->>'doc_type')`
    `'project_id', COALESCE(d.project_id, c.metadata->>'project_id')`
    (igual para `authority_tier`: `COALESCE(NULLIF(d.authority_tier::text,'unverified'), …)`)
  - Añadir filtros de exclusión: `AND d.status = 'indexed'` (excluye `retired`/`error`/`processing`) además del `review_status <> 'rejected'` existente.
- Tabla `rag_document_events` (append-only, auditoría = "review decision inmutable" del SPEC):
  `id uuid pk, document_id uuid fk, action text, field text, old_value text, new_value text, actor text, reason text, created_at timestamptz default now()`.

### Migración / script `006` — backfill (ver §5)

## 5. Backfill híbrido (corazón de A)

**Pasada 1 — lift-up por reglas (SQL, gratis, determinista)** por cada `rag_documents`, agregando su conjunto de chunks:
```
authority_score := max(chunk.authority)               -- ya existe (75–95); los chunks de un doc comparten authority, así que max=mode
authority_tier  := score→tier (≥95 audited, 90 executed, 80 controller, 70-75 board_pack, …)
doc_type        := modo(chunk.doc_type)
project_id      := modo(chunk.project_id)
period          := de chunks si presente
classification_source := 'rule'
classification_confidence := proporción de chunks coincidentes en doc_type
```

**Pasada 2 — enriquecimiento LLM amplio (Haiku)** sobre todos los docs con metadata pobre/incompleta (authority null, `doc_type` ausente o `'other'`, sin period/lifecycle, sin summary) — que es donde está la mayor parte de la información que falta para el chat. Produce: `doc_type`, `authority_tier/score`, `lifecycle`, `period`, `currency`, `topics[]`, `summary` (1 línea), `entity_ids[]`, `confidence`, `review_reason`. `classification_source='agent_auto'`. Coste: por documento (≤5.498), no por chunk → asumible.

**Estado de revisión (filosofía transparencia sobre bloqueo):**
```
review_status := 'approved'      si classification_confidence ≥ 0.5
                                  Y doc_type ∉ {null,'other'}
                                  Y authority_tier ≠ 'unverified'
                 'needs_review'  en caso contrario (clasificación genuinamente incierta)

(Umbral 0,5 deliberadamente generoso: prioriza disponibilidad/transparencia; el etiquetado rico
 y el ranking ×0.85 de needs_review gestionan el riesgo, no la exclusión.)
```
`needs_review` NO oculta: el chunk sigue siendo recuperable, con etiqueta "SIN REVISAR" y ranking ×0.85. Nada se excluye salvo `rejected`/`retired`. Generoso en disponibilidad, estricto y rico en etiquetado.

Ejecución: `scripts/backfill-governance.mjs` (dry-run primero, lotes pequeños, log de distribución antes/después; respeta el throttle de embeddings/LLM).

## 6. Un único writer de ingesta
- `src/lib/ingest/queue-processor.ts` = único camino a `rag_documents`/`rag_chunks`.
- Mover `scripts/ingest-dms.mjs` e `ingest-key-docs.mjs` a `scripts/_archive/` con cabecera "NO EJECUTAR — reintroduce datos ingobernados/duplicados".
- `queue-processor` invoca el clasificador (§5) en la reserva, en vez de los defaults `approved/authority 0`.

## 7. Gestor documental `/admin/documents` (UI v1)

```
┌ Documentos ───────────────────────────────── [buscar] [⟳] ┐
│ Filtros: review_status▾ doc_type▾ project▾ authority▾      │
│         origen▾  □ solo sin revisar  □ sin markdown         │
├─────────────────────────────────────────────────────────────┤
│ ✔/⚠/⛔  Título                proj  tipo        auth rev   chk│
│ ⚠ USCL Monthly Rep Sep24      BHX   monitoring   80  needs  12│ → panel
│ ✔ Acta JG Aumento Capital     MAD   legal        95  appr   34│
│ ⛔ Borrador duplicado          MAD   other         0  rej     2│
├── panel lateral (doc seleccionado) ────────────────────────┤
│ Origen · source_hash · versión · created_at                 │
│ Resumen (summary) · topics · periodo · ciclo de vida        │
│ [Aprobar] [Rechazar] [Reclasificar▾] [Retirar] [Superseder…]│
│ ▸ Markdown (artifact si existe; si no, reconstruido)        │
│ ▸ Chunks (índice · contenido · metadata)                    │
│ ▸ Historial (rag_document_events)                           │
└─────────────────────────────────────────────────────────────┘
```
Más una página/cabecera de **salud**: gobierno (n.º approved/needs_review/rejected/retired, autoridad media, % con markdown, % con source_hash) + cola (`queued/processing/done/error`).

### APIs (server; sin cambios de auth en esta fase)
- `GET /api/knowledge/documents?status=&doc_type=&project=&authority_min=&channel=&q=&page=` → lista paginada con campos de gobierno.
- `GET /api/knowledge/documents/[id]` → detalle + chunks (índice/contenido/metadata) + markdown (artifact o reconstruido) + eventos.
- `PATCH /api/knowledge/documents/[id]` → `{ action: 'approve'|'reject'|'reclassify'|'retire'|'restore'|'supersede', fields?, reason?, actor? }`. Escribe `rag_documents` + inserta `rag_document_events`. Validación de transición de estado.
- `GET /api/knowledge/corpus/health` → métricas de gobierno + cola (reusa lógica de `GET /api/ingest/queue`).
- Navegación: enlace "Gestor documental" en `src/components/layout/Sidebar.tsx` (grupo Knowledge System).

## 8. Visor de markdown (decisión: reconstrucción de chunks)
Los originales no están en producción (`DMS_ROOT` local) y solo 2 docs tienen `md_path`. v1: si existe `md_path` → mostrar artifact; si no → **reconstruir** concatenando `rag_chunks.content` ordenado por `chunk_index` (los chunks ya son el markdown parseado). Etiquetar claramente "markdown reconstruido (no es el artifact original)". Re-parseo masivo fuera de alcance.

## 9. "Vinculado" — conexión con el chat
- **Rechazar** → `review_status='rejected'` → RPC ya excluye. Instantáneo.
- **Retirar** → `status='retired'` → RPC (arreglado) excluye por `status='indexed'`. **Restaurar** → `status='indexed'`.
- **Reclasificar `doc_type/authority/project`** → el RPC ahora inyecta esos campos desde el padre (COALESCE) → basta actualizar `rag_documents`; no se tocan 156k chunks. Fuente única de verdad = documento.
- **Aprobar + autoridad real** → fluye por el JOIN; `source_of_record` (authority≥90 + approved) por fin se activa; las source cards muestran autoridad/tipo/periodo/ciclo reales → "máxima información al usuario del chat".

## 10. Manejo de errores
- Backfill: por documento, fail-soft (un doc que falla no aborta el lote; se registra y queda `needs_review` con `review_reason`). Dry-run obligatorio antes de escribir.
- PATCH: transiciones inválidas (p.ej. `restore` sobre doc no retirado) → 409 con mensaje; toda escritura registra evento.
- RPC: el COALESCE evita romper retrieval si el backfill aún no ha corrido (degrada con elegancia a la señal de chunk).
- Markdown reconstruido: si un doc no tiene chunks → mensaje "sin contenido indexado".

## 11. Pruebas (e2e mínimas)
1. Backfill dry-run: la distribución de `review_status`/`authority_score`/`authority_tier` deja de ser un único valor; log antes/después.
2. RPC: una query devuelve `authority_score` real (no 0) tras el backfill; un doc `rejected` y uno `retired` no aparecen.
3. Gestor: aprobar/rechazar/reclasificar/retirar/restaurar/superseder → estado correcto en `rag_documents` + evento en `rag_document_events`.
4. Reclasificar `doc_type` → el filtro `doc_type` del chat lo respeta sin tocar chunks.
5. Visor: markdown reconstruido legible para un doc legacy; artifact real para los 2 que lo tienen.
6. Salud: cifras coinciden con la BD (5.498 docs, cola 2406/267/2).

## 12. Decisiones cerradas
- (a) Markdown por **reconstrucción de chunks** en v1. ✔
- (b) Aprobación **generosa en disponibilidad, rica/estricta en etiquetado**; enriquecimiento LLM amplio; transparencia sobre bloqueo. ✔
- (c) Retirar = `status='retired'` (estado separado de `rejected`). ✔

## 13. Secuencia de implementación (resumen; el plan detallado lo genera writing-plans)
1. `005` (defaults + fix RPC + `rag_document_events` + columnas enriquecimiento).
2. Clasificador `classify.ts` (reglas + Haiku) con tests unitarios.
3. Backfill dry-run → revisión de distribución → ejecución por lotes.
4. APIs `/api/knowledge/documents*` + `corpus/health`.
5. UI `/admin/documents` + nav + visor + dashboard.
6. Quarantine de scripts legacy + clasificador en `queue-processor`.
7. Pruebas e2e.
