export type MaybeJoined<T> = T | T[] | null | undefined

export type RagDocumentHeader = {
  title: string | null
  source_type: string | null
}

export type RagChunkHeader = {
  metadata: Record<string, unknown> | null
}

export type GroundedDocument = {
  title: string | null
  source_type: string | null
  doc_type: string | null
  source_file: string | null
  project_id: string | null
  dms_folder: string | null
  dms_path: string | null
  authority: number | null
  authority_tier: string | null
  lifecycle: string | null
  review_status: string | null
  classification_source: string | null
}

export type GroundingRow = {
  rag_documents?: MaybeJoined<RagDocumentHeader>
  rag_chunks?: MaybeJoined<RagChunkHeader>
}

export function firstJoined<T>(value: MaybeJoined<T>): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

export function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export function numberValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

export function normalizeGroundedDocument(row: GroundingRow): GroundedDocument | null {
  const document = firstJoined(row.rag_documents)
  const chunk = firstJoined(row.rag_chunks)
  const metadata = chunk?.metadata ?? {}
  const sourceFile = stringValue(metadata.source_file)
  const dmsFolder = stringValue(metadata.dms_folder)
  const title = document?.title ?? sourceFile
  const dmsPath = dmsFolder && sourceFile ? `${dmsFolder}/${sourceFile}` : null

  if (!document && !sourceFile) return null

  return {
    title: title ?? null,
    source_type: document?.source_type ?? null,
    doc_type: stringValue(metadata.doc_type),
    source_file: sourceFile,
    project_id: stringValue(metadata.project_id),
    dms_folder: dmsFolder,
    dms_path: dmsPath,
    authority: numberValue(metadata.authority_score) ?? numberValue(metadata.authority),
    authority_tier: stringValue(metadata.authority_tier),
    lifecycle: stringValue(metadata.lifecycle),
    review_status: stringValue(metadata.review_status),
    classification_source: stringValue(metadata.classification_source),
  }
}

export function attachGroundedDocument<T extends GroundingRow>(row: T): T & { rag_documents: GroundedDocument | null } {
  return {
    ...row,
    rag_documents: normalizeGroundedDocument(row),
  }
}

export function validationNotesText(notes: unknown): string {
  if (Array.isArray(notes)) {
    return notes
      .map(note => {
        if (typeof note === 'string') return note
        if (note && typeof note === 'object' && 'message' in note) return String(note.message)
        return String(note)
      })
      .join('; ')
  }
  return typeof notes === 'string' ? notes : ''
}
