export type FailedDocumentActionState = {
  status: string | null
  title?: string | null
  storage_path?: string | null
}

export type FailedDocumentActionCheck = { ok: true } | { ok: false; reason: string }

export function canRetryFailedDocument(doc: FailedDocumentActionState | null | undefined): FailedDocumentActionCheck {
  if (!doc) return { ok: false, reason: 'document not found' }
  if (doc.status !== 'error') return { ok: false, reason: 'Solo se pueden reintentar documentos con ingesta fallida.' }
  if (!doc.storage_path) return { ok: false, reason: 'Este documento fallido no conserva el archivo original en Storage.' }
  if (!doc.title?.trim()) return { ok: false, reason: 'Este documento fallido no tiene nombre de archivo.' }
  return { ok: true }
}

export function canDeleteFailedDocument(doc: FailedDocumentActionState | null | undefined): FailedDocumentActionCheck {
  if (!doc) return { ok: false, reason: 'document not found' }
  if (doc.status !== 'error') return { ok: false, reason: 'Solo se pueden borrar documentos con ingesta fallida.' }
  return { ok: true }
}
