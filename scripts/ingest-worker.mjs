#!/usr/bin/env node
/**
 * Queue ingestion worker.
 *
 * The canonical ingest pipeline lives in src/lib/ingest/queue-processor.ts and
 * is exposed through /api/ingest/process. This script only drives that endpoint
 * in batches, so the queue path has one implementation.
 *
 * Usage:
 *   node scripts/ingest-worker.mjs --batch=5 --max=0
 *   INGEST_API_URL=http://localhost:3000/api/ingest/process node scripts/ingest-worker.mjs
 */

import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const args = Object.fromEntries(
  process.argv.slice(2).map(arg => {
    const [key, value] = arg.replace('--', '').split('=')
    return [key, value || 'true']
  })
)

const BATCH_SIZE = Number.parseInt(args.batch || '5', 10)
const MAX_FILES = Number.parseInt(args.max || '0', 10)
const API_URL = args.api || process.env.INGEST_API_URL || 'http://localhost:3000/api/ingest/process'

function log(message) {
  const ts = new Date().toISOString().slice(11, 19)
  console.log(`${ts} ${message}`)
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function processBatch(batchSize) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ batchSize }),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error || `Ingest API returned ${res.status}`)
  }
  return data
}

async function main() {
  log(`Ingestion worker - batch=${BATCH_SIZE}, max=${MAX_FILES || 'unlimited'}`)
  log(`API: ${API_URL}`)

  let totalProcessed = 0
  let round = 0

  while (true) {
    if (MAX_FILES && totalProcessed >= MAX_FILES) {
      log(`Reached max files (${MAX_FILES}). Stopping.`)
      break
    }

    const limit = MAX_FILES ? Math.min(BATCH_SIZE, MAX_FILES - totalProcessed) : BATCH_SIZE
    round++
    log(`Round ${round}: requesting ${limit} file(s)`)

    const result = await processBatch(limit)
    const processed = Number(result.processed || 0)

    if (!processed) {
      log(result.message || 'Queue empty.')
      break
    }

    totalProcessed += processed
    for (const item of result.results || []) {
      const suffix = item.status === 'done'
        ? `${item.chunks || 0} chunks (${item.parser || 'unknown parser'})`
        : item.error || 'error'
      log(`${item.status.toUpperCase()}: ${item.file} - ${suffix}`)
    }

    await sleep(1000)
  }

  log(`Done. Processed ${totalProcessed} file(s).`)
}

main().catch(err => {
  console.error('FATAL:', err.message)
  console.error('Start the Next.js server first, or set INGEST_API_URL to the process endpoint.')
  process.exit(1)
})
