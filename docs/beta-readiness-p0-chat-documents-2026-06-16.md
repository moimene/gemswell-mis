# Beta readiness P0 - Chat + Documents (2026-06-16)

Scope: make `/admin/documents` and `/chat` beta-ready for the two P0 gaps called out after the
2026-06-13 async ingest work:

1. Real async ingest smoke, through the production app and scheduled worker.
2. Visible recovery for failed ingests in `/admin/documents`.

Production app: `https://gemswell-mis-app.vercel.app`  
Supabase project: `nqxhsjkcvfxygiajdxki`

## P0.1 real async ingest smoke

Result: PASS.

Evidence:

- Uploaded a real synthetic PDF through production APIs and Supabase Storage:
  `ZZZ_GEMSWELL_BETA_E2E_ASYNC_UPLOAD_20260616T133105Z.pdf`.
- Unique content token:
  `GWELL-BETA-E2E-20260616T133105Z-BB1003C8`.
- Async job:
  `60ac7127-b8ff-4a16-a97c-6c46bcba8c44`.
- Worker progression:
  `queued` -> `processing/downloading` -> `processing/indexing` -> `done/indexed`.
- Indexed document:
  `23c12580-b5ef-4956-87da-75c52277f6b5`.
- Resulting metadata:
  `project_id=MAD`, `doc_type=legal`, `review_status=needs_review`,
  `source_channel=browser_upload`, `chunk_count=1`.
- Markdown artifact:
  `artifacts/23c12580-b5ef-4956-87da-75c52277f6b5/v1.md`.
- `/api/knowledge/documents?q=...` and the document detail endpoint both returned the uploaded file.

Follow-up fix discovered by the smoke:

- Initial chat existence lookup found the document, but content grounding did not surface it because
  standard-mode trust ranking buried a high-relevance `needs_review` match under irrelevant approved docs.
- Commit `59bcf46` added standard-mode high-relevance rescue ranking. Strict grounding modes still use the
  trust-first ranking.
- Live chat smoke after deploy returned the synthetic document as source #1 and answered with the unique
  token. Conversation id: `9e3119af-0081-4f78-b523-8cdc61660509`.

Deploy and gates for the retrieval fix:

- Commit: `59bcf46 fix(chat): surface high-relevance unreviewed retrieval`.
- Vercel deployment: `gemswell-mis-3jvbx9jhv...`, Ready.
- Gates: `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`.

## P0.2 failed ingest recovery

Result: PASS.

Implemented:

- Failed document actions:
  `src/lib/knowledge/failed-document-actions.ts`.
- Retry endpoint:
  `POST /api/knowledge/documents/:id/retry-ingest`.
- Delete endpoint:
  `DELETE /api/knowledge/documents/:id`.
- `/admin/documents` detail panel now shows failed ingest state and two recovery actions:
  `Reintentar ingesta` and `Borrar fallido`.

Backend fixes discovered by live smoke:

- Permanent near-empty parser failures were retrying. Commit `454ad0c` marks `near-empty result` as
  non-retryable.
- Terminal job failures could end with `document_id = null` or reuse an old failed source-hash row without
  refreshing the visible title. Commit `c660a05` links terminal failed jobs to the failed document row and
  refreshes reused failed-row metadata.

Final live smoke:

- Failing fixture:
  `ZZZ_GEMSWELL_BETA_E2E_FAIL_20260616T141654Z.txt`.
- Async job:
  `352a7e08-04bd-4c31-9b95-519da35479cd`.
- Worker result:
  `error/error`, `attempts=1`, non-retryable parser error.
- Failed document:
  `01b6c473-52a2-4df9-94c9-1480bb27d306`.
- `onlyErrors=true&q=...` returned the failed document.
- Retry action created queued job:
  `547c17c6-7553-4b26-98f7-fa2d11d7ad1f`.
- Cancel action moved retry job to `canceled/canceled`.
- Delete action removed the failed document; follow-up `onlyErrors` query returned no matching failed docs.

Deploys and gates:

- `16fd38e feat(documents): retry and delete failed ingests`.
- `454ad0c fix(ingest): stop retrying near-empty parse failures`.
- `c660a05 fix(ingest): link failed jobs to document recovery`.
- Latest Vercel deployment for P0.2: `gemswell-mis-b482keio7...`, Ready.
- Gates before `c660a05`: focused ingest tests, full `npm test` (273 tests), `npx tsc --noEmit`,
  `npm run lint`, `npm run build`.

## Current beta status

P0 for `/admin/documents` and `/chat` is complete:

- New browser uploads are processed by the real async production worker.
- A real uploaded document is searchable in the manager and grounded in chat.
- High-relevance unreviewed uploads are not hidden by standard-mode trust ordering.
- Terminal failed ingests appear as failed documents with retry/delete recovery.
- Permanent near-empty parse failures stop after one attempt instead of cycling through retries.

Known non-P0 follow-ups:

- P1: live smoke the chat conversation sidebar/reload path with a tester account.
- P1: write/update tester account guide for beta users.
- P1: decide and document LLM billing owner/limits for beta.
- P1: decide grounding default posture for beta (`standard` vs stricter modes).
