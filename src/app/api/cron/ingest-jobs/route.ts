import { NextRequest, NextResponse } from 'next/server'
import { createApiClient } from '@/lib/supabase-server'
import { processIngestJobs } from '@/lib/ingest/jobs'
import { isAuthorizedCronRequest } from '@/lib/cron-auth'

export const maxDuration = 800

function numberEnv(name: string, fallback: number): number {
  const value = Number(process.env[name])
  return Number.isFinite(value) && value > 0 ? value : fallback
}

export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const result = await processIngestJobs(createApiClient(), {
      limit: numberEnv('INGEST_JOBS_BATCH_LIMIT', 3),
      budgetMs: numberEnv('INGEST_JOBS_BUDGET_MS', 700_000),
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    console.error('[cron/ingest-jobs] failed:', err instanceof Error ? err.message : err)
    return NextResponse.json({ ok: false, error: 'ingest jobs failed' }, { status: 500 })
  }
}
