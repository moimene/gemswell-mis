import { AUTHORITY_TIER_SCORE, HUMAN_VALIDATED_SOURCES, RETIRED_STATUS } from '@/lib/knowledge/contracts'
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
      const patch: Record<string, unknown> = {}
      const events: DocEventInsert[] = []
      for (const key of ['project_id', 'doc_type', 'period', 'lifecycle'] as const) {
        if (fields[key] !== undefined) {
          patch[key] = fields[key]
          events.push(ev(documentId, 'reclassify', key, null, fields[key], actor, reason))
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
        ],
      }
    }

    default:
      throw new InvalidTransitionError(`unknown action: ${action as string}`)
  }
}
