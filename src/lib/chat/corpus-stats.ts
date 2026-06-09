import type { CorpusHealth } from '@/lib/knowledge/corpus-health'

// Live corpus stats for the chat "Contexto activo" strip (ported-idea from MDL's sidebar stats): replace
// the hardcoded "Semana 23/2026" text with real numbers from /api/knowledge/corpus/health, so the strip
// can't silently go stale and the figures build trust in a financial tool. Pure (unit-tested); the chat
// page fetches the health object and renders these.

export type CorpusStat = { label: string; value: string }

type StatsInput = Pick<CorpusHealth, 'total' | 'governance' | 'source_of_record'> | null | undefined

/** Spanish thousands grouping ('.'), deterministic across environments (Intl/ICU varies between the
 *  Node test runner and the browser, so we don't rely on it). */
function group(n: number): string {
  return Math.trunc(Math.max(0, n || 0)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

/** Map a corpus-health response to the strip's stats. Returns [] when health is missing/malformed so the
 *  UI can fall back gracefully (never render `undefined` figures). */
export function formatCorpusStats(h: StatsInput): CorpusStat[] {
  if (!h || typeof h.total !== 'number') return []
  return [
    { label: 'documentos', value: group(h.total) },
    { label: 'aprobados', value: group(h.governance?.approved ?? 0) },
    { label: 'fuente oficial', value: group(h.source_of_record ?? 0) },
  ]
}
