/**
 * Fase 5 / WS5-T5/T6 — citation deep-linking. Turns a retrieved source's metadata into (a) the page it
 * resolves to and (b) a link that opens the ORIGINAL artifact at that page. Pure (no React/DOM) so it is
 * unit-tested in the node vitest env; the chat page renders the result. `page`/`storage_path` reach the
 * source metadata via WS2-T4 (chunk stamping) + sql/023 (RPC surfaces them) for newly-ingested docs.
 */

/** 1-based source page if the chunk carries a valid one, else undefined. Accepts number or numeric string. */
export function citationPage(metadata: Record<string, unknown> | undefined): number | undefined {
  const raw = metadata?.page
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN
  return Number.isInteger(n) && n >= 1 ? n : undefined
}

/** True when the document has an original artifact in Storage (so "open original" is offered). */
export function hasStoredOriginal(metadata: Record<string, unknown> | undefined): boolean {
  if (!metadata) return false
  return typeof metadata.storage_path === 'string' && metadata.storage_path.trim() !== ''
    || metadata.source_kind === 'storage'
}

/** Link to the signed-download endpoint, with a `#page=N` fragment the PDF viewer honours. */
export function originalDownloadHref(documentId: string, page?: number): string {
  const base = `/api/knowledge/documents/${encodeURIComponent(documentId)}/download`
  return page && page >= 1 ? `${base}#page=${page}` : base
}
