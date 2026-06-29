# Release readiness chat documental y gestor documental - 2026-06-29

Estado actual: no liberable como release final con OpenAI principal hasta resolver la cuota API. El sistema documental y los E2E estan consolidados en dev/CI previo, pero el gate vigente falla correctamente en el preflight OpenAI.

## Bloqueo externo actual

- `npm run eval:openai-health -- codex-continuation-health` falla con `quota_or_billing`.
- Status OpenAI: `429`.
- Code/type: `insufficient_quota`.
- Modelo objetivo: `gpt-5.5`.
- Run remoto que confirma el bloqueo: `28385163901`.

Accion requerida fuera del repo:

- Revisar billing: https://platform.openai.com/settings/organization/billing
- Revisar limites/spend cap: https://platform.openai.com/settings/organization/limits
- Confirmar que la API key usada por GitHub secret `OPENAI_API_KEY` tiene cuota para `gpt-5.5`.

No rotar la key salvo decision explicita. El usuario indico que se usara la misma key.

## Evidencia verde antes del bloqueo

Ultimo gate live completo verde antes de agotar cuota:

- Workflow: `live-rag-e2e`
- Run: `28380967059`
- SHA: `24752a87500c2abfe0e5083bbe78ad1e7eb111cd`
- Duracion: `30m40s`

Evidencia critica de ese run:

- Santander/BBVA: smart search rank 1, retrieval rank 1, grafo activo, rerank `gpt-5.5`, respuesta judge pass, cita `4140-7692-5542`.
- Buenavista: smart search rank 1, retrieval rank 1, grafo activo, rerank `gpt-5.5`, respuesta judge pass, cita `4148-6073-6102`.
- Governance: 94 citas revisadas, 0 fallos.
- Browser E2E chat/search: passed.
- Browser E2E ingesta/gobernanza: passed.

Evidencia local adicional:

- `npm run e2e:doc-chat`: passed con autoarranque limpio.
- `npm run e2e:doc-ingest`: passed con autoarranque limpio.
- `npm run e2e:documents`: passed con autoarranque limpio.
- Artefactos ultima suite agregada local: `/tmp/gemswell-e2e-documents-suite-1782747384`.

## Gate de release obligatorio

Despues de resolver cuota OpenAI, ejecutar:

```bash
npm run eval:openai-health -- release-openai-health
```

Debe devolver `ok: true`.

Luego disparar el workflow live:

```bash
gh api -X POST repos/moimene/gemswell-mis/actions/workflows/303814927/dispatches -f ref=main
gh run list --repo moimene/gemswell-mis --workflow live-rag-e2e.yml --branch main --limit 3
```

El release queda bloqueado si el workflow no termina en success.

Verificar la evidencia agregada antes de liberar:

```bash
gh run view <live-run-id> --repo moimene/gemswell-mis --json databaseId,workflowName,status,conclusion,headSha > /tmp/live-rag-e2e-latest.json
npm run eval:release-readiness -- --health scripts/eval/results/openai-health-release-openai-health.json --live-run /tmp/live-rag-e2e-latest.json --expected-sha <release-sha> --e2e-dir /tmp/gemswell-e2e-documents-prod --smart-search-eval scripts/eval/results/smart-search-<label>.json --retrieval-eval scripts/eval/results/retrieval-<label>.json
```

Este verificador debe devolver `ok: true`. Si devuelve `quota_or_billing`, falta un `live-rag-e2e` verde para el SHA de release, falta `--expected-sha`, los resumenes E2E no prueban `rerankOrModelUsed: true`, o faltan las evidencias `smart-search`/`retrieval`, no liberar.

## Ultima evidencia offline

- `eval-gate` remoto del ultimo commit de hardening: run `28388533419`, SHA `8906f46a63b3e75d1fc6c4298fae1fce34aeb43d`, success.
- `npm run eval:openai-health` sigue fallando con `quota_or_billing` el 2026-06-29, por lo que no se relanza `live-rag-e2e` hasta resolver cuota.

## Prueba local de produccion

Cuando `eval:openai-health` pase, validar tambien `next start` local:

```bash
npm run build
npm run start -- -p 3127
E2E_BASE_URL=http://localhost:3127 E2E_ARTIFACT_DIR=/tmp/gemswell-e2e-documents-prod E2E_SUMMARY_DIR=/tmp/gemswell-e2e-documents-prod npm run e2e:documents
```

El workflow `live-rag-e2e` debe ejecutar los scripts E2E con `E2E_SERVER_MODE=start` para que el autoarranque use `next start` sobre el build de produccion, no `next dev`.

Resultado esperado:

- `dms-smart-search-santander-bbva`: `ok: true`, `graphUsed: true`, `rerankOrModelUsed: true`, `topExpectedDoc: true`.
- `dms-smart-search-buenavista`: `ok: true`, `graphUsed: true`, `rerankOrModelUsed: true`, `topExpectedDoc: true`.
- `chat-answer-santander-bbva`: `ok: true`.
- `chat-source-link-opens-santander-bbva-document`: `ok: true`.
- `chat-answer-buenavista`: `ok: true`.
- `chat-source-link-opens-buenavista-document`: `ok: true`.
- `chat-recovers-newly-ingested-document`: `ok: true`.
- `chat-source-link-opens-newly-ingested-document`: `ok: true`.
- `failedRequests: []`.
- `consoleMessages: []`.
- `/tmp/gemswell-e2e-documents-prod/document-chat-summary.json`: `ok: true`.
- `/tmp/gemswell-e2e-documents-prod/document-ingest-summary.json`: `ok: true`.
- `scripts/eval/results/smart-search-<label>.json`: todos los casos `pass: true`, Santander/BBVA y Buenavista `rank: 1`.
- `scripts/eval/results/retrieval-<label>.json`: `summary.ok: true`, `summary.documentary.cross.recallAt1: 1`, `summary.documentary.cross.recallAt5: 1`.

Parar el servidor despues de la prueba y confirmar:

```bash
lsof -nP -iTCP:3127 -sTCP:LISTEN || true
git status --short --branch
```

## Criterio de liberacion al equipo

Liberable para test del equipo solo si se cumplen todos:

1. `eval:openai-health` pasa para `gpt-5.5`.
2. `live-rag-e2e` pasa en `main`.
3. La prueba local de produccion `E2E_BASE_URL=http://localhost:3127 npm run e2e:documents` pasa.
4. `eval:smart-search` y `eval:retrieval` pasan y sus JSON se entregan a `eval:release-readiness`.
5. `eval:release-readiness` pasa con `--expected-sha <release-sha>`, resumenes E2E estrictos y evidencias RAG.
6. No quedan servidores locales colgados.
7. `git status --short --branch` no muestra cambios propios sin commit.

Si falla `eval:openai-health` con `quota_or_billing`, no investigar RAG primero: resolver billing/limits de OpenAI y relanzar.

## Smoke degradado mientras OpenAI esta sin cuota

Este smoke no libera release. Sirve solo para confirmar que, durante el bloqueo de cuota, el gestor documental mantiene recuperacion determinista, grafo, enlaces de fuentes e ingesta.

```bash
npm run build
npm run start -- -p 3127
E2E_BASE_URL=http://localhost:3127 E2E_ALLOW_SMART_MODEL_FALLBACK=true E2E_ARTIFACT_DIR=/tmp/gemswell-e2e-documents-prod-degraded npm run e2e:documents
```

No ejecutar `npm run build` en paralelo contra la misma instancia `next start`: puede dejar assets de `.next` en transicion y producir 500 espurios antes del login.

Resultado esperado en modo degradado:

- Los documentos Santander/BBVA y Buenavista siguen como `topExpectedDoc: true`.
- `graphUsed: true`.
- `acceptableRankingMode: true`.
- La UI puede mostrar `Ranking local` en vez de `Rerank`/`Modelo`.
- `failedRequests: []`.
- `consoleMessages: []`.

Este modo solo es aceptable cuando el bloqueo ya esta clasificado por `eval:openai-health` como `quota_or_billing`.
