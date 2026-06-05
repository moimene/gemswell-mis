# Spec B — Gestor Documental Gobernado · Addendum de reconciliación + decisiones

Fecha: 2026-06-05
Estado: **aprobado para escribir plan de implementación** (alcance B completo)
Extiende: `2026-06-05-gestor-documental-gobernado-design.md` (§7–§13 siguen vigentes salvo lo aquí ajustado)
Contexto A: `2026-06-05-corpus-gobernado-outcome.md` — sub-proyecto A entregado y **mergeado a `main` local** (merge `7066969`, no pusheado)

---

## 0. Por qué este addendum
El diseño original (A+B) se aprobó **antes** de la doble pasada adversarial de A. A endureció la realidad sobre la que B se construye (gate de `source_of_record`, `agent_rejected` sticky, RPC parent-first + override estricto, migración 008). B se construye sobre el `main` ya mergeado. Este addendum (a) declara A entregado, (b) fija las decisiones abiertas de B, (c) reconcilia §7–§9 con lo que A realmente dejó. El layout, las APIs y la filosofía de §7–§13 del diseño original **siguen vigentes** salvo lo que aquí se ajusta.

## 1. Estado verificado en BD (`nqxhsjkcvfxygiajdxki`, 2026-06-05)
- 5.498 docs, **todos `status='indexed'`**. `review_status`: approved 3.224 (59%) / needs_review 2.274 (41%). **0 rejected, 0 retired** (la capa de decisión humana aún no existe — la crea B).
- `classification_source`: agent_auto 3.639 + rule 1.859 → **0 docs validados por humano** → **0 `source_of_record` hoy**, pese a 831 docs con authority≥90.
- De esos **831** (authority≥90): **797 ya `approved`** (machine) + **34 en needs_review**. Endosar los 797 = activación casi inmediata de `source_of_record`.
- `supersedes_document_id`: 0 usados. `md_path` / `source_hash`: solo **2 docs** (reconstrucción de markdown es la norma; salud %markdown ≈ 0).
- Columnas de gobierno + enriquecimiento (`summary/topics/currency/entity_ids`) + `supersedes_document_id` + `current_version` + tabla `rag_document_events`: **TODAS existen** (migraciones 005–008).
- ⚠️ **CORRECCIÓN (verificación en vivo 2026-06-05):** la suposición "`status` admite `'retired'`" era **falsa** — existía un CHECK `rag_documents_status_check` que solo permitía `pending|processing|indexed|error`. El retire/restore/supersede lo necesita. **B SÍ requiere una migración**: `sql/009_status_allow_retired.sql` (= migración `allow_retired_document_status`, ya aplicada) que añade `'retired'` al constraint. Es aditiva y segura (todas las filas eran `indexed`); el RPC ya filtra `status='indexed'`, así que un doc `retired` queda excluido del chat sin tocar el RPC.
- Enums vivos: `review_status_enum` {pending, approved, rejected, needs_review}; `classification_source_enum` {human, rule, agent_auto, agent_reviewed, agent_corrected, agent_rejected}; `lifecycle_enum` incluye **`superseded`**; `authority_tier_enum` {audited, executed, controller, board_pack, dd_memo, internal, narrative, unverified}.

## 2. Decisiones cerradas (esta sesión)
- **D1 — Alcance: Spec B completo.** §7–§9: workflow de revisión + dashboard de salud + superseder. No se trocea.
- **D2 — Trust gate: implícito al aprobar.** En el `PATCH` del gestor:
  - `approve` → `review_status='approved'` **+ `classification_source='agent_reviewed'`** (endoso humano de las etiquetas del agente).
  - `reclassify` con edición de campos → `classification_source='agent_corrected'`.
  - **Endoso de un doc ya `approved` (machine):** aplicar `approve` sobre un doc que ya está `review_status='approved'` pero con `classification_source` machine (agent_auto/rule) **sube `classification_source` a `agent_reviewed`** sin cambiar el review_status → es el "endoso" de un clic que activa `source_of_record`. Por tanto `approve` sobre approved es una transición **válida** (idempotente en review_status, upgrade en classification_source), no un 409.
  - Efecto: un doc `authority≥90 + approved + (agent_reviewed|agent_corrected|human)` ⇒ `source_of_record`. **Esto ya lo implementa `src/lib/knowledge/source-reference.ts`** (`HUMAN_VALIDATED_SOURCES`, `verificationFromGovernance`) → **no se toca esa lógica**, solo se escribe el `classification_source` correcto. Activa hasta 831 docs a medida que se revisan (797 con un solo endoso).
- **D3 — actor sin auth:** la API usa por defecto `actor='admin:console'` (override por campo opcional del body). `rag_document_events.actor` es `NOT NULL` (default `'system'`).
- **D4 — Semántica de superseder:** "B sustituye a A" ⇒ `B.supersedes_document_id = A.id`; `B.current_version = max(B.current_version, A.current_version + 1)`; **A** pasa a `status='retired'` + `lifecycle='superseded'` (sale del retrieval por el filtro `status='indexed'`). Se emiten eventos en A y en B. **UI**: en el panel del doc B, "Superseder…" abre un selector (buscar por título/proyecto) para elegir **el doc antiguo A** que este B reemplaza; confirmación + motivo obligatorio.
- **D5 — Reject humano:** `review_status='rejected'` (el RPC ya excluye; sticky en re-ingesta por `review_status='rejected'` **y** por `classification_source='agent_rejected'`, CX-3). El reject del gestor fija `review_status='rejected'`; `classification_source` se deja como esté (no se fuerza `agent_rejected`, que es la vía automática del clasificador, no la humana).

## 3. Reconciliación §7–§9 con lo entregado por A
- **§9 "`source_of_record` por fin se activa"**: cierto **solo** con D2 (classification_source validado). Sin D2 quedaría dormido pese a la autoridad. Reconciliado.
- **§9 Reclasificar `doc_type/authority/project` sin tocar 156k chunks**: válido — RPC parent-first (F1) + override estricto (008) propagan desde el padre. El gestor escribe solo `rag_documents`.
- **§9 Retirar/Restaurar**: `status` retired/indexed; el RPC filtra `status='indexed'`. Confirmado.
- **§7 health "cola 2406/267/2"**: cifras de abril; el dashboard las lee **en vivo** de la cola (reusa la lógica de `/api/ingest/queue`). No hardcodear.
- **§8 visor markdown**: solo 2 docs con `md_path` → reconstrucción por concatenación de `rag_chunks.content` ordenado por `chunk_index` es la vía v1 (base: `src/lib/knowledge/markdown-artifact.ts`). Etiquetar "markdown reconstruido (no es el artifact original)".
- **Migraciones**: una migración obligatoria — `009_status_allow_retired.sql` (constraint `status`, ver §1). Opcional: índices para la query de listado (`review_status / doc_type / project_id / authority_score`) — no obligatorio.

## 4. Alcance de construcción (lo que planificará writing-plans)
**APIs** (server, sin auth esta fase) — nuevo árbol `src/app/api/knowledge/...`:
- `GET /documents` — lista paginada + filtros (`status, doc_type, project, authority_min, channel, q, page`; flags `solo-sin-revisar` / `sin-markdown`).
- `GET /documents/[id]` — detalle + chunks (índice/contenido/metadata) + markdown (artifact o reconstruido) + eventos.
- `PATCH /documents/[id]` — `{action: approve|reject|reclassify|retire|restore|supersede, fields?, reason?, actor?}` → escribe `rag_documents` + inserta `rag_document_events`; valida transición; aplica D2/D4/D5.
- `GET /corpus/health` — métricas de gobierno (approved/needs_review/rejected/retired, autoridad media, `source_of_record` count, %markdown, %source_hash) + cola.

**UI** `/admin/documents` (cliente, patrón `useEffect`+`fetch()` como el resto de `/admin`): tabla + filtros + panel lateral con 5 acciones + visor markdown/chunks + historial de eventos; selector de superseder; dashboard de salud (página o cabecera). Nav: enlace "Gestor documental" en `src/components/layout/Sidebar.tsx` (grupo Knowledge System).

**Reutilización:** `source-reference.ts` (verificación, sin cambios), `markdown-artifact.ts` (visor), tipos/enums de `contracts.ts`. Patrón de página: seguir `src/app/admin/{review,packs}/page.tsx`.

## 5. Pruebas e2e (extiende §11)
1. `approve` de un doc `authority≥90` ⇒ `classification_source='agent_reviewed'` ⇒ `verification='source_of_record'` (vía `source-reference.ts`).
2. `reject` ⇒ excluido del RPC; re-ingesta sticky (no re-aprueba).
3. `retire` ⇒ excluido; `restore` ⇒ vuelve a `indexed`.
4. `reclassify doc_type` ⇒ el chat respeta el filtro **sin tocar chunks** (parent-first).
5. `supersede` ⇒ A `retired`+`superseded` + link en B + eventos en ambos; A fuera del retrieval.
6. health ⇒ cifras = BD en vivo (5.498; cola en vivo; `source_of_record` count).
7. `PATCH` transición inválida (`restore` sobre no-retirado) ⇒ 409 + sin escritura.

## 6. Fuera de alcance (sin cambios)
- **Spec C**: system prompt hardcodeado, dominancia de trust-tier en ranking, stemming ES/EN, desacoplar el limitador de embeddings.
- Auth / RLS (pre-publicación). Re-parseo masivo de originales. Adaptadores upload / Drive / Gmail bot.
