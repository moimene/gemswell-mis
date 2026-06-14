// find_document tool — title-existence lookup over rag_documents, robust to a long natural-language title
// and to accents. Pure (no server imports) so it is unit-testable; the executor in agent.ts runs the
// queries (exact substring first, then keyword-token fallback) and calls these helpers to rank + format.

export type FoundDocRow = {
  title: string | null
  project_id: string | null
  doc_type: string | null
  review_status: string | null
  lifecycle: string | null
  status: string | null
  chunk_count: number | null
  created_at: string | null
}

const STOPWORDS = new Set([
  'de', 'del', 'la', 'el', 'los', 'las', 'un', 'una', 'unos', 'unas', 'y', 'o', 'a', 'en', 'con', 'para', 'por',
  'the', 'of', 'and', 'for', 'a', 'an', 'to', 'in', 'on', 'is', 'esta', 'este', 'que', 'sobre',
])

/** Strip diacritics so "financiación" ~ "financiacion" (titles aren't consistently accented). */
export function deburr(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/** Significant search tokens from a (possibly long) title: words ≥4 chars, not stopwords, BOTH the
 *  original (accented) and a deburred variant so an ilike OR can match titles with or without accents. */
export function significantTokens(query: string): string[] {
  const words = query.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 4 && !STOPWORDS.has(deburr(w)))
  const set = new Set<string>()
  for (const w of words) { set.add(w); set.add(deburr(w)) }
  return Array.from(set)
}

/** How many of the user's distinct (deburred) keywords appear in this doc's (deburred) title. */
export function tokenScore(title: string | null, deburredKeywords: string[]): number {
  const t = deburr((title ?? '').toLowerCase())
  return deburredKeywords.filter((k) => t.includes(k)).length
}

/** Human label for a document's real availability, distinguishing the cases the gestor hides by default. */
export function docStatusLabel(r: FoundDocRow): string {
  if (r.status === 'error') return 'SUBIDO pero la INGESTA FALLÓ (no consultable — hay que re-subirlo/re-procesarlo)'
  if (r.status === 'retired') return 'retirado'
  if (r.lifecycle === 'superseded') return 'subido pero SUPERSEDED (reemplazado por una versión más reciente; el chat no lo usa)'
  if (r.status === 'indexed') return `indexado y consultable en el chat (${r.chunk_count ?? 0} fragmentos)`
  return r.status ?? 'estado desconocido'
}

// live (indexed & not superseded) first, then failed ingest, then the rest.
function rank(r: FoundDocRow): number {
  if (r.status === 'indexed' && r.lifecycle !== 'superseded') return 0
  if (r.status === 'error') return 1
  if (r.lifecycle === 'superseded') return 2
  return 3
}

export function formatFoundDocuments(rows: FoundDocRow[], query: string, opts: { partial?: boolean } = {}): string {
  if (rows.length === 0) {
    return `NO se ha encontrado ningún documento cuyo título contenga "${query}". No parece estar subido, o el título del fichero es distinto al buscado. Sugiere al usuario probar otra parte del nombre o confirmar el nombre exacto del archivo. (Esta búsqueda es por NOMBRE de fichero; para buscar por contenido usa search_documents.)`
  }
  // stable sort: live-first by `rank`; the executor passes rows already ordered by relevance/date, which
  // is preserved WITHIN each status group (Array.prototype.sort is stable).
  const sorted = [...rows].sort((a, b) => rank(a) - rank(b))
  const live = sorted.filter((r) => r.status === 'indexed' && r.lifecycle !== 'superseded').length
  const failed = sorted.filter((r) => r.status === 'error').length

  let out = opts.partial
    ? `No hay coincidencia exacta de título, pero SÍ hay ${sorted.length} documento(s) con un nombre PARECIDO (por palabras clave de "${query}") — ${live} consultable(s) en el chat`
    : `Documentos cuyo título contiene "${query}": ${sorted.length} encontrado(s) — ${live} consultable(s) en el chat`
  out += failed ? `, ${failed} con la ingesta FALLIDA.\n\n` : `.\n\n`
  sorted.forEach((r, i) => {
    out += `${i + 1}. "${r.title ?? '(sin título)'}" — ${docStatusLabel(r)}`
    out += ` · proyecto ${r.project_id ?? '—'} · tipo ${r.doc_type ?? '—'} · revisión ${r.review_status ?? '—'}`
    if (r.created_at) out += ` · subido ${String(r.created_at).slice(0, 10)}`
    out += '\n'
  })
  out += opts.partial
    ? '\nNOTA: son coincidencias por palabras clave del nombre (no exactas) — confirma con el usuario si alguno es el documento que busca. "ingesta fallida" = subido pero NO procesado.'
    : '\nNOTA: responde a la EXISTENCIA del fichero por su nombre, no a su contenido. "indexado y consultable" = se puede usar en el chat; "ingesta fallida" = está subido pero NO se procesó (avisar de re-subirlo); "superseded" = hay una versión más nueva.'
  return out
}
