import { describe, it, expect, vi } from 'vitest'
import { reapAndRequeue, type RecoverableDoc, type ReaperDeps } from '../reaper'

// Fake supabase — the deps are injected, so the client is only an opaque token here.
const sb = {} as never

function deps(over: Partial<ReaperDeps> = {}): ReaperDeps {
  return {
    reapStranded: vi.fn(async () => 0),
    listRecoverable: vi.fn(async () => [] as RecoverableDoc[]),
    downloadBytes: vi.fn(async () => Buffer.from('x')),
    reingest: vi.fn(async () => ({ status: 'done' as const })),
    markFailure: vi.fn(async () => undefined),
    now: () => 0,
    ...over,
  }
}

const doc = (id: string, attempts = 0): RecoverableDoc => ({
  id, storage_path: `uploads/${id}/f.pdf`, title: 'f.pdf', project_id: 'MAD', reingest_attempts: attempts,
})

describe('reapAndRequeue', () => {
  it('flips stranded docs (delegates to reapStranded) and reports the count', async () => {
    const d = deps({ reapStranded: vi.fn(async () => 3) })
    const r = await reapAndRequeue(sb, {}, d)
    expect(d.reapStranded).toHaveBeenCalledOnce()
    expect(r.stranded).toBe(3)
  })

  it('re-ingests each recoverable doc and counts successes (no failures → no markFailure)', async () => {
    const d = deps({ listRecoverable: vi.fn(async () => [doc('a'), doc('b')]) })
    const r = await reapAndRequeue(sb, { batchLimit: 10 }, d)
    expect(d.downloadBytes).toHaveBeenCalledTimes(2)
    expect(d.reingest).toHaveBeenCalledTimes(2)
    expect(d.markFailure).not.toHaveBeenCalled()
    expect(r.reingested).toBe(2)
    expect(r.failed).toBe(0)
    expect(r.scanned).toBe(2)
    expect(r.capDisabled).toBe(false)
  })

  it('FAIL CLOSED: if sql/029 missing (listRecoverable→null) the re-ingest lane no-ops, no loop', async () => {
    const d = deps({ listRecoverable: vi.fn(async () => null), reapStranded: vi.fn(async () => 1) })
    const r = await reapAndRequeue(sb, {}, d)
    expect(r.capDisabled).toBe(true)
    expect(r.stranded).toBe(1) // job 1 still runs
    expect(d.downloadBytes).not.toHaveBeenCalled()
    expect(r.reingested).toBe(0)
  })

  it('a download miss is counted failed AND increments reingest_attempts (retry cap)', async () => {
    const d = deps({
      listRecoverable: vi.fn(async () => [doc('a', 2)]),
      downloadBytes: vi.fn(async () => null),
    })
    const r = await reapAndRequeue(sb, {}, d)
    expect(r.failed).toBe(1)
    expect(r.reingested).toBe(0)
    expect(d.markFailure).toHaveBeenCalledWith(sb, 'a', 3) // 2 + 1
    expect(d.reingest).not.toHaveBeenCalled()
  })

  it('a re-ingest status=error is failed + increments attempts', async () => {
    const d = deps({
      listRecoverable: vi.fn(async () => [doc('a', 0)]),
      reingest: vi.fn(async () => ({ status: 'error' as const })),
    })
    const r = await reapAndRequeue(sb, {}, d)
    expect(r.failed).toBe(1)
    expect(r.reingested).toBe(0)
    expect(d.markFailure).toHaveBeenCalledWith(sb, 'a', 1)
  })

  it('a thrown re-ingest is isolated (failed, attempts bumped, loop continues)', async () => {
    const d = deps({
      listRecoverable: vi.fn(async () => [doc('a', 1), doc('b')]),
      reingest: vi.fn(async (_sb, dd: RecoverableDoc) => { if (dd.id === 'a') throw new Error('boom'); return { status: 'done' as const } }),
    })
    const r = await reapAndRequeue(sb, {}, d)
    expect(r.failed).toBe(1)
    expect(r.reingested).toBe(1)
    expect(d.markFailure).toHaveBeenCalledWith(sb, 'a', 2)
  })

  it('logs a failed attempt counter update instead of swallowing it silently', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const d = deps({
      listRecoverable: vi.fn(async () => [doc('a', 1)]),
      reingest: vi.fn(async () => ({ status: 'error' as const })),
      markFailure: vi.fn(async () => { throw new Error('update failed') }),
    })
    const r = await reapAndRequeue(sb, {}, d)
    expect(r.failed).toBe(1)
    expect(err).toHaveBeenCalledWith(expect.stringContaining('failed to persist reingest_attempts'), 'update failed')
    err.mockRestore()
  })

  it('stops starting new re-ingests once the time budget is exhausted (time-boxed)', async () => {
    let t = 0
    const d = deps({
      listRecoverable: vi.fn(async () => [doc('a'), doc('b'), doc('c')]),
      now: () => (t += 100),
    })
    const r = await reapAndRequeue(sb, { budgetMs: 150 }, d)
    expect(r.reingested).toBeLessThan(3)
    expect(r.timedOut).toBe(true)
  })

  it('no recoverable docs → nothing re-ingested, no failure, cap enabled', async () => {
    const r = await reapAndRequeue(sb, {}, deps())
    expect(r.reingested).toBe(0)
    expect(r.failed).toBe(0)
    expect(r.timedOut).toBe(false)
    expect(r.capDisabled).toBe(false)
  })
})
