import { NextRequest, NextResponse } from 'next/server'
import { createApiClient } from '@/lib/supabase-server'
import { isAuthorizedCronRequest } from '@/lib/cron-auth'
import { reapAndRequeue } from '@/lib/ingest/reaper'

// F6 ingest reaper — invoked by the Vercel cron in vercel.json. Re-ingest re-runs the full governed
// pipeline per doc, so give it room (Vercel Pro fluid allows up to 800s).
export const maxDuration = 800

/**
 * GET /api/cron/ingest-reaper
 * CRON_SECRET-gated, fail-closed. Vercel automatically sends `Authorization: Bearer $CRON_SECRET`
 * on cron invocations when the CRON_SECRET env var is set; until it is set, this endpoint returns 401
 * (so it can never be triggered anonymously). Set CRON_SECRET in Vercel to activate.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createApiClient()
    const result = await reapAndRequeue(supabase, { batchLimit: 10, budgetMs: 700_000 })
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    console.error('[cron/ingest-reaper] failed:', err)
    return NextResponse.json({ ok: false, error: 'reaper failed' }, { status: 500 })
  }
}
