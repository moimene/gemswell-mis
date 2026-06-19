# SharePoint RAG Ingestion Runbook - 2026-06-19

This runbook documents the local SharePoint ingestion fallback built during the June 2026 Gemswell MIS corpus refresh.

It is intentionally operational: future agents should be able to rerun reconciliation, enqueue only missing/changed files, recover failed jobs, and verify coverage without rediscovering the pipeline.

## Scope

- Repo: `/Users/moisesmenendez/Dropbox/DESARROLLO/GEMSWELL_MIS/gemswell-mis-app`
- Supabase prod project: `nqxhsjkcvfxygiajdxki`
- Production app: `https://gemswell-mis-app.vercel.app`
- Source channel used by this workflow: `drive_sync`
- Source export files used on 2026-06-19:
  - `/Users/moisesmenendez/Downloads/OneDrive_2026-06-18 (1).zip`
  - `/Users/moisesmenendez/Downloads/Documentacion.zip` or `/Users/moisesmenendez/Downloads/Documentación.zip`
  - `/Users/moisesmenendez/Downloads/OneDrive_2026-06-18.zip`

The original target was SharePoint Graph ingestion. No Graph connector existed in the codebase, and no Azure app credentials were available. The implemented path is therefore the approved fallback: export/sync SharePoint to local ZIPs, reconcile against `rag_documents`, enqueue only missing/changed files, and use the governed ingestion pipeline.

## Core Invariants

- Do not bypass `ingestBuffer` for normal files. It owns parse -> classify -> markdown artifact -> chunk -> embed -> index.
- `project_id` is mandatory for chat retrieval because chat is project-scoped.
- Idempotency is based on `source_hash` plus `project_id`.
- `content_hash` dedup can mark a newly indexed document as `lifecycle='superseded'` when another live document has identical parsed content.
- Do not reingest `duplicate_content_superseded` rows unless the dedup policy is being intentionally changed.
- Do not treat `legacy_title_match` as missing. Those are existing legacy corpus rows with `source_hash IS NULL`; enqueueing them by default would create duplicates.
- Do not push to `main` casually. `origin/main` is production and auto-deploys on push.

## Environment

Scripts load `.env.local` with `dotenv`.

Required for Supabase write operations:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Recommended for local recovery when LlamaParse quota is exhausted:

```bash
RAG_LOCAL_PARSE_FALLBACK=force
```

The local fallback uses:

- `pdftotext` for PDFs.
- `7z` for ZIP/PPTX/DOCX XML extraction.
- macOS `textutil` for legacy `.doc`.
- `xlsx` library for `.xlsx`/`.xls`.

## Tools Added

### `npm run sharepoint:reconcile`

Backed by `scripts/reconcile-sharepoint-local.ts`.

Purpose:

- Read one or more SharePoint/OneDrive ZIPs or extracted folders.
- Build an inventory of supported and unsupported files.
- Derive `project_id` from folder structure.
- Compute real SHA-256 `source_hash` for supported files, including files over the normal 50 MB job limit.
- Compare inventory against `rag_documents` and `knowledge_ingest_jobs`.
- Produce JSON and CSV reports.
- With `--apply`, upload enqueueable files to Storage and create durable ingest jobs.

Dry run:

```bash
npm run sharepoint:reconcile -- \
  --source '/Users/moisesmenendez/Downloads/OneDrive_2026-06-18 (1).zip' \
  --source '/Users/moisesmenendez/Downloads/Documentación.zip' \
  --source '/Users/moisesmenendez/Downloads/OneDrive_2026-06-18.zip' \
  --report docs/reports/sharepoint-local-reconcile-final-after-ingest.json
```

Apply:

```bash
npm run sharepoint:reconcile -- \
  --source '/Users/moisesmenendez/Downloads/OneDrive_2026-06-18 (1).zip' \
  --source '/Users/moisesmenendez/Downloads/Documentación.zip' \
  --source '/Users/moisesmenendez/Downloads/OneDrive_2026-06-18.zip' \
  --report docs/reports/sharepoint-local-reconcile-apply.json \
  --apply
```

Useful options:

- `--limit N`: process/enqueue only first N enqueueable items.
- `--force-project MAD|BHX|KLP|PHILAE|GVF|ETP`: override folder mapping.
- `--include-legacy-title-matches`: enqueue rows that only matched legacy title rows. Use only after explicit review.

Action meanings:

- `missing`: no hash or title/project match.
- `changed`: same title/project exists with a different hash.
- `already_indexed_hash`: same source bytes/project already indexed and consultable.
- `job_exists`: durable ingest job already exists and is queued/processing/done.
- `duplicate_content_superseded`: same bytes were indexed but superseded by content-hash dedup.
- `failed_unextractable`: same bytes are recorded as a failed document because extraction produced no usable text, password errors, or invalid PDF structure.
- `legacy_title_match`: legacy row exists with `source_hash IS NULL`; skipped by default.
- `duplicate_in_batch`: same bytes/project already appear earlier in the same export.
- `unsupported`: unsupported extension or export sidecar.
- `unmapped`: no folder-to-project rule matched.
- `unavailable`: ZIP extraction failed for source bytes.

Only these are enqueueable by default:

- `missing`
- `changed`
- `reingest_same_hash`

Final 2026-06-19 reconciliation had `enqueueable=0`.

### `npm run ingest:jobs-loop`

Backed by `scripts/process-ingest-jobs-loop.ts`.

Purpose:

- Run the durable queue worker locally around `processIngestJobs`.
- Useful when Vercel cron is too slow or when local parser fallback is needed.

Command:

```bash
RAG_LOCAL_PARSE_FALLBACK=force npm run ingest:jobs-loop -- \
  --batch-size 2 \
  --sleep-ms 1000 \
  --budget-ms 700000
```

Useful options:

- `--batch-size N`: max jobs claimed per loop iteration.
- `--budget-ms N`: max processing time per batch loop.
- `--sleep-ms N`: delay between loops.
- `--max-batches N`: stop after N loop iterations.

Important behavior:

- Claims use `claim_knowledge_ingest_job`.
- Lease length in code and SQL default is now 2 hours.
- The worker should be run with `RAG_LOCAL_PARSE_FALLBACK=force` when LlamaParse credits are exhausted.

### `npm run ingest:jobs-direct`

Backed by `scripts/direct-ingest-jobs.ts`.

Purpose:

- Recover existing `knowledge_ingest_jobs` rows by downloading their existing Storage object and running `ingestBuffer`.
- Useful for expired `processing` rows or `error` rows caused by LlamaParse quota exhaustion.
- Updates the same job row to `done` or `error`.

Dry run:

```bash
RAG_LOCAL_PARSE_FALLBACK=force npm run ingest:jobs-direct -- \
  --llama-402-errors \
  --expired-processing \
  --dry-run
```

Apply:

```bash
RAG_LOCAL_PARSE_FALLBACK=force npm run ingest:jobs-direct -- \
  --llama-402-errors \
  --expired-processing
```

Targeted by ID:

```bash
RAG_LOCAL_PARSE_FALLBACK=force npm run ingest:jobs-direct -- \
  --id '<knowledge_ingest_jobs.id>'
```

Targeted by exact file name:

```bash
RAG_LOCAL_PARSE_FALLBACK=force npm run ingest:jobs-direct -- \
  --file '20260112_Pr Surf_Survey Results_v3.xlsx'
```

Do not use this to skip governance. It still calls `ingestBuffer`.

### `npm run sharepoint:ingest-large`

Backed by `scripts/ingest-sharepoint-large-local.ts`.

Purpose:

- Handle files over `MAX_INGEST_JOB_BYTES` (50 MB) that cannot be placed on the normal durable job queue.
- Extract text locally from large PDF/PPTX sources.
- Call `ingestBuffer` with:
  - `sourceHashOverride`: SHA-256 of original bytes.
  - `parsedContentOverride`: locally extracted text.
  - `parserOverride`: local parser name.
- Record failed large documents as `rag_documents.status='error'` with `source_hash`, so final reconciliation is stable.

Dry run:

```bash
RAG_LOCAL_PARSE_FALLBACK=force npm run sharepoint:ingest-large -- \
  --report docs/reports/sharepoint-local-reconcile-final-after-ingest.json \
  --source '/Users/moisesmenendez/Downloads/OneDrive_2026-06-18 (1).zip' \
  --source '/Users/moisesmenendez/Downloads/Documentación.zip' \
  --source '/Users/moisesmenendez/Downloads/OneDrive_2026-06-18.zip' \
  --output docs/reports/sharepoint-local-large-dry-run.json
```

Apply:

```bash
RAG_LOCAL_PARSE_FALLBACK=force npm run sharepoint:ingest-large -- \
  --report docs/reports/sharepoint-local-reconcile-final-after-ingest.json \
  --source '/Users/moisesmenendez/Downloads/OneDrive_2026-06-18 (1).zip' \
  --source '/Users/moisesmenendez/Downloads/Documentación.zip' \
  --source '/Users/moisesmenendez/Downloads/OneDrive_2026-06-18.zip' \
  --apply \
  --output docs/reports/sharepoint-local-large-final-errors.json
```

Use `--limit N` to process only N oversized files.

## Folder To Project Mapping

The reconciler derives `project_id` from SharePoint path rules:

- `BHX`: `bhx`, `birmingham`.
- `PHILAE`: explicit `philae` or investor/fundraising subfolders.
- `KLP`: `kelpa`, `line sports`, `linesport`, `linesp`, `kenichi`, `lona barcelona` in SL contexts.
- `MAD`: `madrid`, `playa surf`, `waves madrid`, `opco waves madrid`, `mps`, project/financing/DD/monitoring/sales paths.
- `GVF`: Gemswell Ventures root, SL accounts/contracts, portfolio-wide corporate/marketing/BP folders.

If a future SharePoint export changes structure, run dry-run first and inspect `unmapped` rows. Do not force everything to `GVF` unless that is the intended project scope.

## Full Refresh Procedure

1. Confirm source ZIPs are complete.

```bash
ls -lh \
  '/Users/moisesmenendez/Downloads/OneDrive_2026-06-18 (1).zip' \
  '/Users/moisesmenendez/Downloads/Documentación.zip' \
  '/Users/moisesmenendez/Downloads/OneDrive_2026-06-18.zip'
```

2. Run dry-run reconciliation.

```bash
npm run sharepoint:reconcile -- \
  --source '/Users/moisesmenendez/Downloads/OneDrive_2026-06-18 (1).zip' \
  --source '/Users/moisesmenendez/Downloads/Documentación.zip' \
  --source '/Users/moisesmenendez/Downloads/OneDrive_2026-06-18.zip' \
  --report docs/reports/sharepoint-local-reconcile-dry-run.json
```

3. Review summary.

Proceed only if:

- `unmapped` is 0 or reviewed.
- `missing + changed + reingest_same_hash` is expected.
- unsupported formats are acceptable.

4. Apply enqueueable files.

```bash
npm run sharepoint:reconcile -- \
  --source '/Users/moisesmenendez/Downloads/OneDrive_2026-06-18 (1).zip' \
  --source '/Users/moisesmenendez/Downloads/Documentación.zip' \
  --source '/Users/moisesmenendez/Downloads/OneDrive_2026-06-18.zip' \
  --report docs/reports/sharepoint-local-reconcile-apply.json \
  --apply
```

5. Process durable queue locally if needed.

```bash
RAG_LOCAL_PARSE_FALLBACK=force npm run ingest:jobs-loop -- \
  --batch-size 2 \
  --sleep-ms 1000 \
  --budget-ms 700000
```

6. Recover expired processing or Llama quota errors.

```bash
RAG_LOCAL_PARSE_FALLBACK=force npm run ingest:jobs-direct -- \
  --llama-402-errors \
  --expired-processing \
  --dry-run
```

Then remove `--dry-run` if the selection is correct.

7. Process oversized files.

```bash
RAG_LOCAL_PARSE_FALLBACK=force npm run sharepoint:ingest-large -- \
  --report docs/reports/sharepoint-local-reconcile-apply.json \
  --source '/Users/moisesmenendez/Downloads/OneDrive_2026-06-18 (1).zip' \
  --source '/Users/moisesmenendez/Downloads/Documentación.zip' \
  --source '/Users/moisesmenendez/Downloads/OneDrive_2026-06-18.zip' \
  --apply \
  --output docs/reports/sharepoint-local-large-apply.json
```

8. Final reconciliation.

```bash
npm run sharepoint:reconcile -- \
  --source '/Users/moisesmenendez/Downloads/OneDrive_2026-06-18 (1).zip' \
  --source '/Users/moisesmenendez/Downloads/Documentación.zip' \
  --source '/Users/moisesmenendez/Downloads/OneDrive_2026-06-18.zip' \
  --report docs/reports/sharepoint-local-reconcile-final-after-ingest.json
```

Done criteria:

- `enqueueable=0`.
- `byAction` has no `missing`, `changed`, `reingest_same_hash`, `too_large`, `unmapped`, or `unavailable`.
- `knowledge_ingest_jobs` has `queued=0` and `processing=0`.

9. Verify queue counts.

Use a service role query or a small `tsx` script. Expected after the 2026-06-19 run:

```json
{
  "queued": 0,
  "processing": 0,
  "done": 1366,
  "error": 24,
  "canceled": 1
}
```

10. Verify selected documents in `/admin/documents` and chat.

Use document titles from final reports. For chat, ask project-scoped questions and confirm citations deep-link to the gestor.

11. Verify dashboard health.

`sql/036_corpus_health_knowledge_ingest_jobs.sql` updates `knowledge_corpus_health()` so the
dashboard reports the durable queue used by this workflow (`knowledge_ingest_jobs`) rather than the
legacy `ingest_queue` table. Expected live RPC output after the 2026-06-19 run:

```json
{
  "docs": {
    "total": 6895,
    "approved": 3477,
    "needs_review": 1368,
    "source_of_record": 814,
    "with_source_hash": 1399
  },
  "queue": {
    "total": 1391,
    "queued": 0,
    "processing": 0,
    "done": 1366,
    "error": 24,
    "canceled": 1
  }
}
```

## Final 2026-06-19 Result

Final report:

- `docs/reports/sharepoint-local-reconcile-final-after-ingest.json`
- `docs/reports/sharepoint-local-reconcile-final-after-ingest.csv`

Inventory summary:

- Corpus totals after ingestion: `rag_documents=6895`, `rag_chunks=213438`.
- Total files inventoried: `2120`
- `already_indexed_hash`: `1451`
- `legacy_title_match`: `285`
- `duplicate_content_superseded`: `37`
- `failed_unextractable`: `22` paths / `20` unique documents
- `unsupported`: `283`
- `duplicate_in_batch`: `31`
- `job_exists`: `11`
- `enqueueable`: `0`

Failed material documents:

- `17` no usable extractable text after local parse.
- `3` corrupt/invalid PDF structure.
- `2` password-protected PDFs.

The two very large PDFs that initially remained `too_large` were registered as `failed_unextractable` with `source_hash`:

- `AAFF Valla Surf Park 8x3 50.pdf`: near-empty local extraction.
- `240530_Deck Stoneweg.pdf`: invalid PDF XRef/pages structure.

## Parser And Quota Notes

During the 2026-06-19 run:

- LlamaParse returned `402` credits exhausted.
- Anthropic classification also hit workspace usage limits until `2026-07-01T00:00:00Z`.
- Ingestion still completed for extractable files because local parsers and rule governance were used.

This means some newly ingested documents have `classification_source='rule'` instead of `agent_auto`. That is acceptable for ingestion completeness but should be reviewed later in `/admin/documents`.

## Verification Commands Used

```bash
npx tsc --noEmit --pretty false
npm run lint
npx vitest run src/lib/ingest/__tests__/jobs.test.ts
```

These passed after the tooling changes.

## Troubleshooting

### Reconciliation still shows `missing` or `changed`

Run apply again. The workflow is idempotent:

```bash
npm run sharepoint:reconcile -- ... --apply
```

Then process the queue and reconcile again.

### Reconciliation shows `legacy_title_match`

Usually do nothing. These are title/project matches against legacy docs with `source_hash IS NULL`.

Only use `--include-legacy-title-matches` if a human accepts duplicate risk.

### Reconciliation shows `failed_unextractable`

Do not requeue blindly. These already have matching `source_hash` and a recorded extraction failure.

Options:

- Obtain OCRed versions of the files.
- Provide passwords for encrypted PDFs and rebuild source exports.
- Replace corrupt PDFs with valid copies.

### Reconciliation shows `duplicate_content_superseded`

No action. The bytes were ingested, but the parsed content duplicated another live document. The superseded row remains traceable but should not compete in retrieval.

### A job is stuck in `processing`

If the lease is expired:

```bash
RAG_LOCAL_PARSE_FALLBACK=force npm run ingest:jobs-direct -- \
  --expired-processing \
  --dry-run
```

Review selection, then apply without `--dry-run`.

### LlamaParse quota errors

Use local fallback:

```bash
RAG_LOCAL_PARSE_FALLBACK=force npm run ingest:jobs-direct -- --llama-402-errors
```

### Oversized files

Use `sharepoint:ingest-large`. It avoids the 50 MB durable job limit but still records the original `source_hash`.

### Report files are large

Keep final JSON/CSV reports for audit. Intermediate dry-run/apply reports can be regenerated if source ZIPs remain available, but do not delete them during an active handoff.
