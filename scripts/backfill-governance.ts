import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { liftUpFromChunks, decideReviewStatus, classifyDocument, type ChunkMetaLite } from '../src/lib/knowledge/classify'

const DRY_RUN = process.argv.includes('--dry-run')
const LIMIT = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || '0', 10)

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(url, key)
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

type DocRow = { id: string; title: string | null; doc_type: string | null; authority_score: number | null }
type ChunkRow = { metadata: Record<string, unknown> | null; content: string | null }

async function classifyWithRetry(
  doc: { title: string; sample: string; dmsFolder?: string | null },
  max = 4
): Promise<Awaited<ReturnType<typeof classifyDocument>>> {
  for (let attempt = 0; attempt <= max; attempt++) {
    try {
      return await classifyDocument(doc, anthropic)
    } catch (e: unknown) {
      const err = e as { status?: number; headers?: { get?: (k: string) => string | null } }
      const status = err?.status ?? 0
      if (attempt < max && (status === 429 || status === 529 || status >= 500)) {
        // @anthropic-ai/sdk error.headers is a Web Headers object — must use .get(), not index access.
        const retryAfter = Number(err?.headers?.get?.('retry-after')) || 0
        await sleep((retryAfter ? retryAfter * 1000 : 2000 * 2 ** attempt) + Math.random() * 500)
        continue
      }
      throw e
    }
  }
  return null
}

async function main() {
  const page = 200
  const dist: Record<string, number> = {}
  let processed = 0, enriched = 0, failed = 0
  const cap = LIMIT || Number.MAX_SAFE_INTEGER

  // Drain pattern: process rows whose governance has not been computed yet
  // (governance_backfilled_at IS NULL). Each processed row is marked, so the pool
  // shrinks and re-runs converge — no offset paging, no summary sentinel (which never
  // marked rule-resolved docs and caused re-processing + duplicate events). F6.
  for (;;) {
    if (processed >= cap) break
    const { data, error } = await supabase
      .from('rag_documents')
      .select('id, title, doc_type, authority_score')
      .is('governance_backfilled_at', null)
      .order('id', { ascending: true })
      .limit(Math.min(page, cap - processed))
    if (error) throw new Error(error.message)
    const docs = (data ?? []) as DocRow[]
    if (!docs.length) break

    for (const doc of docs) {
      if (processed >= cap) break

      const { data: chunkData } = await supabase
        .from('rag_chunks')
        .select('metadata, content')
        .eq('document_id', doc.id)
        .order('chunk_index', { ascending: true })
        .limit(60)
      const chunks = (chunkData ?? []) as ChunkRow[]
      const metas: ChunkMetaLite[] = chunks.map(c => (c.metadata ?? {}) as ChunkMetaLite)
      const lifted = liftUpFromChunks(metas)

      let docType = lifted.doc_type
      let tier = lifted.authority_tier
      let score = lifted.authority_score
      let confidence = lifted.confidence
      let summary: string | null = null
      let topics: string[] = []
      let currency: string | null = null
      let lifecycle: string | null = null
      let period: string | null = lifted.period
      let source = 'rule'

      const ambiguous = !docType || docType === 'other' || tier === 'unverified'
      if (ambiguous) {
        const sample = chunks.slice(0, 6).map(c => c.content ?? '').join('\n').slice(0, 4000)
        let cls = null
        try {
          cls = await classifyWithRetry({ title: doc.title ?? '', sample, dmsFolder: lifted.dms_folder })
        } catch (e) {
          failed++
          console.error(`[backfill] classify failed for ${doc.id}: ${(e as Error).message}`)
        }
        if (cls) {
          docType = cls.result.doc_type
          tier = cls.result.authority_tier
          score = cls.authority_score
          confidence = cls.result.confidence
          summary = cls.result.summary || null
          topics = cls.result.topics
          currency = cls.result.currency
          lifecycle = cls.result.lifecycle
          period = cls.result.period ?? period
          source = 'agent_auto'
          enriched++
        }
      }

      const review = decideReviewStatus({ doc_type: docType, authority_tier: tier, confidence })
      dist[review] = (dist[review] ?? 0) + 1
      processed++

      if (!DRY_RUN) {
        // Write enrichment + the backfill marker unconditionally: a rule-resolved or
        // classify-failed doc clears any stale enrichment and is still marked done so
        // the drain converges (and re-runs don't re-charge / double-write events).
        const update: Record<string, unknown> = {
          doc_type: docType,
          authority_tier: tier,
          authority_score: score ?? 0,
          classification_source: source,
          classification_confidence: confidence,
          review_status: review,
          period,
          summary,
          topics,
          currency,
          lifecycle,
          governance_backfilled_at: new Date().toISOString(),
        }
        const { error: upErr } = await supabase.from('rag_documents').update(update).eq('id', doc.id)
        // A persistent update failure would otherwise re-fetch the same NULL row forever — stop instead.
        if (upErr) { failed++; throw new Error(`[backfill] update failed for ${doc.id}, stopping: ${upErr.message}`) }
        await supabase.from('rag_document_events').insert({
          document_id: doc.id,
          action: 'backfill_classify',
          field: 'review_status',
          old_value: null,
          new_value: review,
          actor: 'backfill',
          reason: source,
        })
      }

      if (processed % 50 === 0) {
        console.log(`[backfill] processed=${processed} enriched=${enriched} failed=${failed} dist=${JSON.stringify(dist)}`)
      }
    }

    if (DRY_RUN) break  // dry-run doesn't mark rows, so don't re-fetch the same NULL pool
  }

  console.log(`[backfill] DONE ${DRY_RUN ? '(dry-run)' : ''} processed=${processed} enriched=${enriched} failed=${failed} dist=${JSON.stringify(dist)}`)
}

main().catch(e => { console.error(e); process.exit(1) })
