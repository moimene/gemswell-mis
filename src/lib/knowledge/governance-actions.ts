import {
  AUTHORITY_TIER_SCORE, AUTHORITY_TIERS, DOC_TYPES, HUMAN_VALIDATED_SOURCES,
  LIFECYCLES, PROJECT_IDS, RETIRED_STATUS,
} from '@/lib/knowledge/contracts'
import type {
  ClassificationSource, DocGovernanceState, GovernanceAction, ReclassifyFields,
} from '@/lib/knowledge/contracts'

export class InvalidTransitionError extends Error {
  constructor(message: string) { super(message); this.name = 'InvalidTransitionError' }
}

export type DocEventInsert = {
  document_id: string
  action: string
  field: string | null
  old_value: string | null
  new_value: string | null
  actor: string
  reason: string | null
}

export type GovernanceActionResult = {
  /** patch to apply to the primary document (documentId) */
  patch: Record<string, unknown>
  /** patch + id for a related document (the superseded old doc), if any */
  related?: { id: string; patch: Record<string, unknown> }
  /** append-only audit rows, each with explicit document_id */
  events: DocEventInsert[]
}

export type GovernanceActionInput = {
  action: GovernanceAction
  documentId: string
  current: DocGovernanceState
  actor: string
  reason?: string
  fields?: ReclassifyFields
  supersede?: { oldId: string; oldDoc: DocGovernanceState }
}

function ev(
  documentId: string, action: string, field: string | null,
  oldValue: unknown, newValue: unknown, actor: string, reason?: string,
): DocEventInsert {
  return {
    document_id: documentId, action, field,
    old_value: oldValue == null ? null : String(oldValue),
    new_value: newValue == null ? null : String(newValue),
    actor, reason: reason ?? null,
  }
}

export function computeGovernanceAction(input: GovernanceActionInput): GovernanceActionResult {
  const { action, documentId, current, actor, reason, fields, supersede } = input

  switch (action) {
    case 'approve': {
      // F3: a doc the agent explicitly rejected (sticky agent_rejected) must not be silently
      // resurrected by approve — force an explicit reclassify/restore decision first.
      if (current.classification_source === 'agent_rejected')
        throw new InvalidTransitionError('document was auto-rejected (agent_rejected); reclassify or restore it explicitly before approving')
      // approve is idempotent: always (re)assert review_status='approved', and endorse
      // machine-classified docs to agent_reviewed (never downgrading human-validated sources).
      // Emits a single consolidated 'approve' event regardless of how many fields it touches.
      const patch: Record<string, unknown> = { review_status: 'approved' }
      if (!HUMAN_VALIDATED_SOURCES.has(current.classification_source)) {
        patch.classification_source = 'agent_reviewed' as ClassificationSource
      }
      return {
        patch,
        events: [ev(documentId, 'approve', 'review_status', current.review_status, 'approved', actor, reason)],
      }
    }

    case 'reject': {
      if (current.review_status === 'rejected') throw new InvalidTransitionError('document already rejected')
      return {
        patch: { review_status: 'rejected' },
        events: [ev(documentId, 'reject', 'review_status', current.review_status, 'rejected', actor, reason)],
      }
    }

    case 'reclassify': {
      if (!fields || Object.keys(fields).length === 0) throw new InvalidTransitionError('reclassify requires fields')
      // F2: validate against the allow-lists so bad values fail loud (409) instead of
      // silently corrupting the row or surfacing as a raw 22P02/23514 500 from Postgres.
      if (fields.doc_type !== undefined && !(DOC_TYPES as readonly string[]).includes(fields.doc_type))
        throw new InvalidTransitionError(`invalid doc_type: ${fields.doc_type}`)
      if (fields.project_id != null && !(PROJECT_IDS as readonly string[]).includes(fields.project_id))
        throw new InvalidTransitionError(`invalid project_id: ${fields.project_id}`)
      if (fields.lifecycle !== undefined && !(LIFECYCLES as readonly string[]).includes(fields.lifecycle))
        throw new InvalidTransitionError(`invalid lifecycle: ${fields.lifecycle}`)
      if (fields.authority_tier !== undefined && !(AUTHORITY_TIERS as readonly string[]).includes(fields.authority_tier))
        throw new InvalidTransitionError(`invalid authority_tier: ${fields.authority_tier}`)
      const patch: Record<string, unknown> = {}
      const events: DocEventInsert[] = []
      // F5: log the real prior value (from current) as old_value, not null.
      for (const key of ['project_id', 'doc_type', 'period', 'lifecycle'] as const) {
        if (fields[key] !== undefined) {
          patch[key] = fields[key]
          events.push(ev(documentId, 'reclassify', key, current[key] ?? null, fields[key], actor, reason))
        }
      }
      if (fields.authority_tier !== undefined) {
        patch.authority_tier = fields.authority_tier
        const score = fields.authority_score !== undefined
          ? fields.authority_score
          : AUTHORITY_TIER_SCORE[fields.authority_tier]
        patch.authority_score = score
        events.push(ev(documentId, 'reclassify', 'authority_tier', current.authority_tier, fields.authority_tier, actor, reason))
        events.push(ev(documentId, 'reclassify', 'authority_score', current.authority_score, score, actor, reason))
      } else if (fields.authority_score !== undefined) {
        patch.authority_score = fields.authority_score
        events.push(ev(documentId, 'reclassify', 'authority_score', current.authority_score, fields.authority_score, actor, reason))
      }
      // human correction
      patch.classification_source = 'agent_corrected' as ClassificationSource
      events.push(ev(documentId, 'reclassify', 'classification_source', current.classification_source, 'agent_corrected', actor, reason))
      return { patch, events }
    }

    case 'retire': {
      if (current.status === RETIRED_STATUS) throw new InvalidTransitionError('document already retired')
      return {
        patch: { status: RETIRED_STATUS },
        events: [ev(documentId, 'retire', 'status', current.status, RETIRED_STATUS, actor, reason)],
      }
    }

    case 'restore': {
      if (current.status !== RETIRED_STATUS) throw new InvalidTransitionError('document is not retired')
      // F4: a superseded doc was retired by a successor — restoring it would silently re-create a
      // duplicate source of record. Force the successor relationship to be undone explicitly first.
      if (current.lifecycle === 'superseded')
        throw new InvalidTransitionError('document was superseded; restore its successor relationship explicitly')
      return {
        patch: { status: 'indexed' },
        events: [ev(documentId, 'restore', 'status', current.status, 'indexed', actor, reason)],
      }
    }

    case 'supersede': {
      if (!supersede) throw new InvalidTransitionError('supersede requires an old document id')
      if (supersede.oldId === documentId) throw new InvalidTransitionError('a document cannot supersede itself')
      const newVersion = Math.max(current.current_version, supersede.oldDoc.current_version + 1)
      return {
        patch: { supersedes_document_id: supersede.oldId, current_version: newVersion },
        related: { id: supersede.oldId, patch: { status: RETIRED_STATUS, lifecycle: 'superseded' } },
        events: [
          ev(documentId, 'supersede', 'supersedes_document_id', null, supersede.oldId, actor, reason),
          ev(supersede.oldId, 'superseded_by', 'status', supersede.oldDoc.status, RETIRED_STATUS, actor, reason),
          // F5: the old doc's lifecycle moves to 'superseded' — record it as a faithful audit event.
          ev(supersede.oldId, 'superseded_by', 'lifecycle', supersede.oldDoc.lifecycle ?? null, 'superseded', actor, reason),
        ],
      }
    }

    default:
      throw new InvalidTransitionError(`unknown action: ${action as string}`)
  }
}
