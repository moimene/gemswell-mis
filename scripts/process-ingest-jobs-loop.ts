import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { processIngestJobs } from '../src/lib/ingest/jobs'

type Cli = {
  batchSize: number
  budgetMs: number
  sleepMs: number
  maxBatches: number | null
}

function parseArgs(): Cli {
  const argv = process.argv.slice(2)
  let batchSize = 5
  let budgetMs = 700_000
  let sleepMs = 2_000
  let maxBatches: number | null = null
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    const nextNumber = () => {
      const value = Number(argv[++i])
      if (!Number.isFinite(value) || value <= 0) throw new Error(`Invalid value for ${arg}`)
      return value
    }
    if (arg === '--batch-size') batchSize = nextNumber()
    else if (arg === '--budget-ms') budgetMs = nextNumber()
    else if (arg === '--sleep-ms') sleepMs = nextNumber()
    else if (arg === '--max-batches') maxBatches = nextNumber()
    else throw new Error(`Unknown arg: ${arg}`)
  }
  return { batchSize, budgetMs, sleepMs, maxBatches }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function jobCounts(sb: SupabaseClient) {
  const statuses = ['queued', 'processing', 'done', 'error', 'canceled'] as const
  const out: Record<string, number> = {}
  for (const status of statuses) {
    const { count, error } = await sb
      .from('knowledge_ingest_jobs')
      .select('id', { count: 'exact', head: true })
      .eq('status', status)
    if (error) throw new Error(`count ${status} failed: ${error.message}`)
    out[status] = count ?? 0
  }
  return out
}

async function main() {
  const cli = parseArgs()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  const sb = createClient(url, key, { auth: { persistSession: false } })

  for (let batch = 1; cli.maxBatches == null || batch <= cli.maxBatches; batch++) {
    const before = await jobCounts(sb)
    console.log(JSON.stringify({ batch, at: new Date().toISOString(), before }))
    if ((before.queued ?? 0) === 0 && (before.processing ?? 0) === 0) break
    const result = await processIngestJobs(sb, { limit: cli.batchSize, budgetMs: cli.budgetMs })
    const after = await jobCounts(sb)
    console.log(JSON.stringify({ batch, result, after }))
    if (result.processed === 0 && (after.queued ?? 0) === 0) break
    await sleep(cli.sleepMs)
  }
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
