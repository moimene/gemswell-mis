# Backlog Status — Chat/Documentos/UAT

Fecha: 2026-06-16
Entorno verificado: Supabase prod `nqxhsjkcvfxygiajdxki`
Modo de este pase: lectura/verificación; no se ejecutaron mutaciones de Supabase.

## Cierres de este pase

### UAT docs

Se actualizaron los documentos UAT para reflejar el flujo real de ingesta durable y cerrar los gaps de ejecutabilidad:

- `/admin/ingest` y `/admin/documents` suben y encolan con `Subir y encolar`.
- El worker procesa en segundo plano; no hay botón de "procesar ahora".
- Los fallos de ingesta son visibles y recuperables desde Biblioteca (`Reintentar ingesta` / `Borrar fallido`).
- Se corrigieron referencias a `04-limitaciones-conocidas.md`.
- Se añadió una receta operativa para forzar sesión caducada en pruebas opcionales.
- Se añadió un criterio transversal para validar errores de carga por recuperabilidad, no por copy literal.
- Se añadió CP-NAV-04 para pantallas genéricas de error (`error.tsx` / `global-error.tsx`).

Gaps UAT cerrados en `docs/uat/00-cobertura-y-gaps.md`: GAP-1, GAP-2, GAP-3, GAP-4, GAP-5 y GAP-6.

### Near-duplicate review

Se extendió `scripts/dedup-near-dups.mjs` con salida completa de revisión humana:

```bash
node scripts/dedup-near-dups.mjs --review \
  --review-out docs/reports/near-duplicate-review-2026-06-16.md \
  --review-csv docs/reports/near-duplicate-review-2026-06-16.csv
```

Resultado:

- Human-review clusters: 508.
- Auto-supersede candidates en esta corrida: 0.
- Motivos principales: 249 `financial-versions`, 161 `mixed-type`; el resto son pares legales/board por debajo del umbral de similitud/longitud.
- Artefactos: `docs/reports/near-duplicate-review-2026-06-16.md` y `docs/reports/near-duplicate-review-2026-06-16.csv`.

Lectura: esto cierra la tarea de producir el paquete completo para revisión CFO. No habilita un `--apply`; las versiones financieras, traducciones y pares ambiguos deben revisarse manualmente.

### Kelpa/SHA retrieval monitor

Se ejecutó el eval existente:

```bash
npm run eval:retrieval -- kelpa-monitor-20260616
```

Resultado guardado en `scripts/eval/results/retrieval-kelpa-monitor-20260616.json`.

Resumen:

- Cross recall@10: 64%; MRR: 0.320.
- Scoped recall@10: 57%; MRR: 0.393.
- Degraded pools: 0.
- Latencia media cross: 1,149 ms.
- `klp-pacto-socios-es`: cross #2.
- `klp-pacto-socios-en`: cross #7.
- `klp-apoderados`: cross #2.

Lectura: no hay regresión operativa ni timeout en el monitor, pero siguen existiendo misses de calidad en algunas consultas documentales (`bhx-loan-lender`, `bhx-capcall-entity`, `philae-portfolio`, `cross-project-legal`). No conviene marcar el eval documental como "perfecto"; sí queda monitorizado.

### Chat history provider provenance

Se preparó la persistencia de `provider`, `model` y `fallback` en `rag_messages` para que las conversaciones restauradas puedan volver a pintar badges como `Modo contingencia (Gemini)`.

- Código compatible hacia atrás: si la tabla no tiene las columnas, la API reintenta el insert/select legacy sin romper producción.
- Migración versionada: `sql/035_chat_message_provider.sql`.
- Rollback versionado: `sql/rollback/035_rollback.sql`.
- Estado DB: pendiente de aplicar; la CLI linked requiere `SUPABASE_DB_PASSWORD` y no hay RPC SQL expuesto en este proyecto.

Lectura: el rough edge queda preparado de forma segura, pero la mejora visual histórica solo se activa cuando `sql/035` esté aplicado.

### Backup tables

Inventario leído por REST con service role:

| Tabla | Filas | Lectura |
|---|---:|---|
| `rag_chunks_superseded_bak_20260613` | 12,394 | Backup de chunks superseded purgados; incluye los 384 chunks de near-dups purgados. |
| `rag_chunks_noise_bak_20260613` | 30 | Backup de separadores `---` eliminados. |
| `rag_chunks_rechunk_bak_20260613` | 57,293 | Backup completo de chunks legal/board antes del re-chunk curado. |

Recomendación: no dropear automáticamente. Mantener hasta cierre de ventana de confianza y decisión explícita del responsable. Si se decide limpiar, hacerlo en una tarea separada con export previo y runbook de rollback.

### OCR legacy / near-empty audited doc

Consulta de lectura:

- 837 documentos vivos indexados con `chunk_count <= 1` revisados.
- 263 tenían títulos compatibles con plano/dibujo/imagen/anexo.
- 11 resultaron image-like y near-empty (`text_len < 200`).
- 9 ya están rebajados a `authority_score <= 10`.

Documento crítico identificado:

| Campo | Valor |
|---|---|
| Documento | `AM_MPS-Anexo III.pdf` |
| ID | `32702804-846e-4390-9f50-443a7a82bef0` |
| Proyecto / tipo | `MAD` / `legal` |
| Authority / review | 95 / `approved` |
| Chunks / text_len | 1 / 75 |
| `storage_path` | `null` |

Lectura: no hay bytes originales en Storage, por tanto no se puede OCR-ar este documento legacy desde el sistema actual. Opciones reales: recuperar/re-subir el PDF original con OCR aplicado, aceptar el registro como evidencia no-textual, o pedir decisión humana para rebajar autoridad/clasificación.

## Pendiente de decisión humana

- Near-dups: revisión CFO del reporte completo antes de cualquier supersede manual.
- Backups: ventana de confianza y autorización explícita antes de dropear tablas.
- `AM_MPS-Anexo III.pdf`: recuperar fuente/re-subir, aceptar como no-textual o rebajar autoridad.
- Modelo: resolver limitación de billing Anthropic vs seguir con Gemini Pro/Flash.
- Grounding: decidir si el default debe ser `standard` o `trusted_only`.
- P3 opcional: re-chunk adicional por otros `doc_type` si se justifica con eval, no por intuición.
