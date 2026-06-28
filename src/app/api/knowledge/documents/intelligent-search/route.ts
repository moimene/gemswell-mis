import { NextRequest, NextResponse } from 'next/server'
import { createApiClient, requireUser } from '@/lib/supabase-server'
import { searchDocumentsIntelligently, type SmartDocumentSearchFilters } from '@/lib/knowledge/intelligent-search'

function internalError(context: string, err: unknown): NextResponse {
  console.error(`[knowledge/documents/intelligent-search] ${context}:`, err instanceof Error ? err.message : err)
  return NextResponse.json({ error: 'Error interno al procesar la búsqueda inteligente.' }, { status: 500 })
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

export async function POST(request: NextRequest) {
  try {
    if (!(await requireUser())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    let body: Record<string, unknown>
    try {
      body = await request.json() as Record<string, unknown>
    } catch {
      return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
    }

    const query = asString(body.query)
    if (!query) return NextResponse.json({ error: 'query required' }, { status: 400 })

    const filtersIn = body.filters && typeof body.filters === 'object'
      ? body.filters as Record<string, unknown>
      : {}
    const filters: SmartDocumentSearchFilters = {
      project: asString(filtersIn.project),
      doc_type: asString(filtersIn.doc_type),
      review_status: asString(filtersIn.review_status),
      authority_min: asNumber(filtersIn.authority_min),
      channel: asString(filtersIn.channel),
      includeRetired: asBoolean(filtersIn.includeRetired),
      onlyNoMarkdown: asBoolean(filtersIn.onlyNoMarkdown),
      onlyErrors: asBoolean(filtersIn.onlyErrors),
    }
    const limit = asNumber(body.limit)
    const supabase = createApiClient()
    const result = await searchDocumentsIntelligently(supabase, { query, filters, limit })
    return NextResponse.json(result)
  } catch (err) {
    return internalError('handler', err)
  }
}
