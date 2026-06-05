export type CorpusHealthInput = {
  total: number; approved: number; needs_review: number; rejected: number; pending: number
  retired: number; sourceOfRecord: number; authoritySum: number; authorityCount: number
  withMarkdown: number; withSourceHash: number
  queue: { total: number; queued: number; processing: number; done: number; error: number }
}

export type CorpusHealth = {
  total: number
  governance: { approved: number; needs_review: number; rejected: number; pending: number }
  retired: number
  source_of_record: number
  avg_authority: number
  pct_markdown: number
  pct_source_hash: number
  queue: CorpusHealthInput['queue']
}

const ratio = (n: number, d: number) => (d > 0 ? n / d : 0)

export function buildCorpusHealth(i: CorpusHealthInput): CorpusHealth {
  return {
    total: i.total,
    governance: { approved: i.approved, needs_review: i.needs_review, rejected: i.rejected, pending: i.pending },
    retired: i.retired,
    source_of_record: i.sourceOfRecord,
    avg_authority: i.authorityCount > 0 ? i.authoritySum / i.authorityCount : 0,
    pct_markdown: ratio(i.withMarkdown, i.total),
    pct_source_hash: ratio(i.withSourceHash, i.total),
    queue: i.queue,
  }
}
