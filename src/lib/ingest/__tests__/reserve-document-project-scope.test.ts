import { describe, it, expect } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { reserveRagDocument, type IngestQueueRow } from '../queue-processor'

// Codex adversarial review (2026-06-13) flagged that reserveRagDocument deduped uploads by a GLOBAL
// source_hash: a byte-identical file uploaded under project B, when an identical file already exists
// under project A, matched the existing row and was REUSED rather than created under B — so it could
// never become visible under B. The fix makes dedup project-aware (source_hash, project_id), mirroring
// the B5 content_hash composite index (uq_rag_documents_content_hash).
//
// This fake models the DB AS IT WILL BE: a partial unique index on (source_hash, project_id)
// WHERE source_hash IS NOT NULL. A NULL source_hash never collides; two rows with the same source_hash
// but different project_id are allowed (the whole point). PostgREST's .maybeSingle() errors on >1 match.

type DocRow = Record<string, unknown>

const norm = (v: unknown) => (v === undefined ? null : v)

function makeFakeSupabase(seed: DocRow[] = []) {
  const docs: DocRow[] = seed.map((r, i) => ({ id: r.id ?? `seed-${i + 1}`, ...r }))
  let seq = docs.length
  const lookupFilters: Array<Record<string, unknown>> = []

  function ragDocuments() {
    return {
      insert(payload: DocRow) {
        return {
          select() {
            return {
              async single() {
                const sh = norm(payload.source_hash)
                const pid = norm(payload.project_id)
                // Composite partial unique index (source_hash, project_id) WHERE source_hash IS NOT NULL.
                if (sh !== null) {
                  const clash = docs.find(
                    (d) => norm(d.source_hash) === sh && norm(d.project_id) === pid
                  )
                  if (clash) return { data: null, error: { code: '23505', message: 'duplicate key value' } }
                }
                const row = { id: `doc-${++seq}`, ...payload }
                docs.push(row)
                return { data: { id: row.id }, error: null }
              },
            }
          },
        }
      },
      select() {
        const filters: Record<string, unknown> = {}
        const builder = {
          eq(col: string, val: unknown) {
            filters[col] = norm(val)
            return builder
          },
          is(col: string, val: unknown) {
            filters[col] = norm(val)
            return builder
          },
          neq() {
            return builder
          },
          async maybeSingle() {
            lookupFilters.push({ ...filters })
            const matches = docs.filter((d) =>
              Object.entries(filters).every(([k, v]) => norm(d[k]) === v)
            )
            if (matches.length > 1) {
              // PostgREST .maybeSingle() returns an error when more than one row matches.
              return { data: null, error: { code: 'PGRST116', message: 'multiple rows returned' } }
            }
            return { data: matches[0] ?? null, error: null }
          },
        }
        return builder
      },
      update(patch: DocRow) {
        return {
          async eq(col: string, val: unknown) {
            for (const d of docs) if (norm(d[col]) === norm(val)) Object.assign(d, patch)
            return { error: null }
          },
        }
      },
    }
  }

  function ragChunks() {
    return {
      delete() {
        return {
          async eq() {
            return { error: null }
          },
        }
      },
    }
  }

  const client = {
    from(table: string) {
      if (table === 'rag_documents') return ragDocuments()
      if (table === 'rag_chunks') return ragChunks()
      throw new Error(`unexpected table ${table}`)
    },
  } as unknown as SupabaseClient

  return { client, docs, lookupFilters }
}

function itemFor(projectId: string | null): IngestQueueRow {
  return {
    id: '',
    rel_path: 'Contrato.pdf',
    file_name: 'Contrato.pdf',
    file_ext: '.pdf',
    project_id: projectId,
    category: null,
    relevance: null,
  }
}

const HASH = 'a'.repeat(64)

describe('reserveRagDocument project-scoped source_hash dedup', () => {
  it('persists project_id when reserving a new document (so the project-scoped unique index can fire)', async () => {
    const { client, docs } = makeFakeSupabase()
    const reserved = await reserveRagDocument(client, itemFor('BHX'), HASH, 'browser_upload')
    expect(reserved.reused).toBe(false)
    expect(docs.find((d) => d.id === reserved.id)?.project_id).toBe('BHX')
  })

  it('creates a SEPARATE document when the same bytes are uploaded under a different project', async () => {
    // Project A (MAD) already has this exact file, fully indexed.
    const { client, docs } = makeFakeSupabase([
      {
        id: 'doc-MAD',
        source_hash: HASH,
        project_id: 'MAD',
        status: 'indexed',
        chunk_count: 7,
        review_status: 'approved',
        classification_source: 'human',
      },
    ])
    const reserved = await reserveRagDocument(client, itemFor('BHX'), HASH, 'browser_upload')
    expect(reserved.reused).toBe(false) // NOT reused from MAD
    expect(reserved.id).not.toBe('doc-MAD')
    expect(docs.find((d) => d.id === reserved.id)?.project_id).toBe('BHX') // created under BHX
  })

  it('still reuses the existing document when the same bytes are re-uploaded under the SAME project', async () => {
    const { client } = makeFakeSupabase([
      {
        id: 'doc-BHX',
        source_hash: HASH,
        project_id: 'BHX',
        status: 'error',
        chunk_count: 0,
        review_status: 'needs_review',
        classification_source: 'agent_auto',
      },
    ])
    const reserved = await reserveRagDocument(client, itemFor('BHX'), HASH, 'browser_upload')
    expect(reserved.reused).toBe(true)
    expect(reserved.id).toBe('doc-BHX')
  })

  it('scopes the reuse lookup to the uploading project (never reuses another project\'s row)', async () => {
    // Same bytes already live under BOTH projects — allowed by the composite index.
    const { client, lookupFilters } = makeFakeSupabase([
      {
        id: 'doc-MAD',
        source_hash: HASH,
        project_id: 'MAD',
        status: 'indexed',
        chunk_count: 9,
        review_status: 'approved',
        classification_source: 'human',
      },
      {
        id: 'doc-BHX',
        source_hash: HASH,
        project_id: 'BHX',
        status: 'indexed',
        chunk_count: 4,
        review_status: 'approved',
        classification_source: 'human',
      },
    ])
    const reserved = await reserveRagDocument(client, itemFor('BHX'), HASH, 'browser_upload')
    expect(reserved.reused).toBe(true)
    expect(reserved.id).toBe('doc-BHX') // BHX's row, not MAD's
    expect(lookupFilters.at(-1)).toMatchObject({ source_hash: HASH, project_id: 'BHX' })
  })

  it('does not let a legacy NULL-project row block a project-scoped upload of the same bytes', async () => {
    const { client, docs } = makeFakeSupabase([
      {
        id: 'doc-legacy',
        source_hash: HASH,
        project_id: null,
        status: 'indexed',
        chunk_count: 3,
        review_status: 'approved',
        classification_source: 'human',
      },
    ])
    const reserved = await reserveRagDocument(client, itemFor('BHX'), HASH, 'browser_upload')
    expect(reserved.reused).toBe(false)
    expect(reserved.id).not.toBe('doc-legacy')
    expect(docs.find((d) => d.id === reserved.id)?.project_id).toBe('BHX')
  })
})
