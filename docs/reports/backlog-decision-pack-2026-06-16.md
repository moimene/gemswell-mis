# Backlog Decision Pack

Fecha: 2026-06-16
Estado: el backlog ejecutable autónomamente está cerrado o preparado. Lo restante requiere decisión de owner, CFO o credencial DB.

## 1. Near-duplicate review CFO

Decisión necesaria: qué clusters del reporte son redundantes de verdad y pueden supersederse.

Artefactos:

- `docs/reports/near-duplicate-review-2026-06-16.md`
- `docs/reports/near-duplicate-review-2026-06-16.csv`

Hechos:

- 508 clusters requieren revisión humana.
- 0 candidatos auto-supersede en la última corrida.
- 249 clusters son `financial-versions`; no deben fusionarse automáticamente porque pueden contener cifras/versiones distintas.
- 161 clusters son `mixed-type`; requieren criterio documental.

Recomendación: no ejecutar `--apply`. Revisar por lotes CFO, empezando por familias legales/board de baja variación y dejando modelos financieros/versionados como familias separadas salvo confirmación explícita.

## 2. Backup tables

Decisión necesaria: cuándo termina la ventana de confianza para borrar backups de chunks.

Inventario:

| Tabla | Filas | Mantener hasta |
|---|---:|---|
| `rag_chunks_superseded_bak_20260613` | 12,394 | Confirmar que no hay rollback de dedup/purga superseded. |
| `rag_chunks_noise_bak_20260613` | 30 | Puede borrarse primero; impacto mínimo. |
| `rag_chunks_rechunk_bak_20260613` | 57,293 | Mantener más tiempo; es rollback del re-chunk legal/board. |

Recomendación: mantener `rag_chunks_rechunk_bak_20260613` hasta después de UAT o una semana de uso real sin regresiones de retrieval. No borrar nada sin export previo o confirmación explícita.

## 3. `AM_MPS-Anexo III.pdf`

Decisión necesaria: cómo tratar el documento legacy audited/approved near-empty.

Datos:

- ID: `32702804-846e-4390-9f50-443a7a82bef0`
- Proyecto/tipo: `MAD` / `legal`
- Authority/review: `95` / `approved`
- `chunk_count=1`, `text_len=75`
- `storage_path=null`

Opciones:

1. Recuperar el PDF original y re-subirlo con OCR aplicado.
2. Aceptarlo como evidencia no-textual legacy y no usarlo para respuestas de contenido.
3. Rebajar autoridad/clasificación si puede competir erróneamente en retrieval.

Recomendación: recuperar/re-subir si el anexo es relevante para decisiones legales. Si no se recupera antes de beta, documentarlo como evidencia no-textual y no hacer mutación automática.

## 4. Chat provider provenance migration

Decisión/credencial necesaria: aplicar `sql/035_chat_message_provider.sql` con credencial DB.

Estado actual:

- Código desplegado en `89b0a2f` es compatible con schema antiguo y nuevo.
- Si las columnas no existen, el API reintenta insert/select legacy.
- La mejora visual del badge histórico solo se activa al aplicar la migración.

SQL versionado:

- Apply: `sql/035_chat_message_provider.sql`
- Rollback: `sql/rollback/035_rollback.sql`

Ejecución sugerida:

```bash
SUPABASE_DB_PASSWORD=... supabase db query --linked -f sql/035_chat_message_provider.sql
```

Verificación:

```sql
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'rag_messages'
  and column_name in ('provider', 'model', 'fallback')
order by column_name;
```

## 5. LLM billing / provider

Decisión necesaria: recuperar Claude como primario ahora o operar beta con Gemini.

Hechos:

- Anthropic sigue como primario en código.
- El workspace de Anthropic está capado por límite de gasto hasta 2026-07-01.
- Gemini Pro funciona como fallback y está probado en producción.

Recomendación: beta ordinaria con Gemini Pro si la latencia es aceptable. Subir límite Anthropic antes de una demo ejecutiva o uso con máxima exigencia documental.

## 6. Grounding default

Decisión necesaria: default de beta `standard` (`Todas`) vs `trusted_only` (`Revisadas`).

Recomendación: mantener `standard` para beta. Motivo: documentos recién subidos entran como `needs_review`; si el default fuera `trusted_only`, los testers podrían creer que una subida válida no funciona hasta aprobarla manualmente.

Uso recomendado:

- Exploración, carga nueva, UAT de ingesta: `Todas`.
- Respuestas para decisión operativa: cambiar manualmente a `Revisadas` u `Oficiales`.

## 7. P3 re-chunk otros `doc_type`

Decisión necesaria: si merece abrir un nuevo pase de re-chunk fuera de legal/board.

Recomendación: no ejecutar de momento. El re-chunk curado ya se justificó por contratos; extenderlo a otros tipos requiere eval positivo y no debe hacerse por intuición.

Gatillo para reabrir: si UAT o eval detecta fallos repetidos en tablas financieras/operativas por cortes de chunk, preparar un piloto read-only y medir recall/MRR antes de cualquier re-embed.

