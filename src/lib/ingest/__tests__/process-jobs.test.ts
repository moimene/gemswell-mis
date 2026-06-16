import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ingestBuffer } from '../queue-processor'
import { processIngestJobs } from '../jobs'

vi.mock('../queue-processor', () => ({
  ingestBuffer: vi.fn(),
  errorMessage: (err: unknown) => err instanceof Error ? err.message : 'Unknown error',
}))

type JobRow = Record<string, unknown>

function makeJob(overrides: Partial<JobRow> = {}): JobRow {
  return {
    id: 'job-1',
    created_at: '2026-06-16T00:00:00.000Z',
    updated_at: '2026-06-16T00:00:00.000Z',
    queued_at: '2026-06-16T00:00:00.000Z',
    started_at: '2026-06-16T00:00:00.000Z',
    finished_at: null,
    lease_expires_at: '2026-06-16T00:20:00.000Z',
    status: 'processing',
    stage: 'processing',
    attempts: 1,
    max_attempts: 3,
    storage_bucket: 'documents',
    storage_path: 'uploads/00000000-0000-0000-0000-000000000000/bad.txt',
    file_name: 'bad.txt',
    file_ext: '.txt',
    file_size: 2,
    project_id: 'MAD',
    doc_type_hint: 'legal',
    source_channel: 'browser_upload',
    document_id: null,
    chunks: null,
    parser: null,
    error_message: null,
    requested_by: 'bot@gemswell.surf',
    ...overrides,
  }
}

function makeFakeSupabase(job: JobRow) {
  const docs: JobRow[] = []
  const updates: JobRow[] = []

  const client = {
    async rpc() {
      return { data: [job], error: null }
    },
    storage: {
      from() {
        return {
          async download() {
            return { data: new Blob([Buffer.from('x\n')]), error: null }
          },
        }
      },
    },
    from(table: string) {
      if (table === 'knowledge_ingest_jobs') {
        return {
          update(patch: JobRow) {
            const builder = {
              eq() {
                return builder
              },
              is() {
                return builder
              },
              select() {
                return {
                  async maybeSingle() {
                    Object.assign(job, patch)
                    updates.push({ ...patch })
                    return { data: { id: job.id }, error: null }
                  },
                }
              },
            }
            return builder
          },
        }
      }
      if (table === 'rag_documents') {
        return {
          update(patch: JobRow) {
            return {
              async eq(_col: string, value: unknown) {
                const doc = docs.find((d) => d.id === value)
                if (doc) Object.assign(doc, patch)
                return { error: null }
              },
            }
          },
          insert(payload: JobRow) {
            return {
              select() {
                return {
                  async single() {
                    const row = { id: 'doc-created', ...payload }
                    docs.push(row)
                    return { data: { id: row.id }, error: null }
                  },
                }
              },
            }
          },
        }
      }
      throw new Error(`unexpected table ${table}`)
    },
  } as unknown as SupabaseClient

  return { client, docs, updates }
}

describe('processIngestJobs failed document bookkeeping', () => {
  beforeEach(() => {
    vi.mocked(ingestBuffer).mockReset()
  })

  it('persists the document id returned by a terminal ingestBuffer error', async () => {
    vi.mocked(ingestBuffer).mockResolvedValue({
      file: 'bad.txt',
      status: 'error',
      error: 'LlamaParse returned near-empty result (1 chars) for bad.txt',
      documentId: 'doc-failed',
    })
    const job = makeJob()
    const { client, updates } = makeFakeSupabase(job)

    const result = await processIngestJobs(client, { limit: 1 })

    expect(result.failed).toBe(1)
    expect(job).toMatchObject({
      status: 'error',
      stage: 'error',
      document_id: 'doc-failed',
      error_message: 'LlamaParse returned near-empty result (1 chars) for bad.txt',
    })
    expect(updates.at(-1)).toMatchObject({ status: 'error', document_id: 'doc-failed' })
  })
})
