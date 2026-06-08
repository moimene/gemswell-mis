/**
 * M4 (audit) — make structured-answer provenance inspectable in the chat UI.
 *
 * The chat persists/streams `tool_calls` (ToolCallAudit[]) but the UI never showed them, so the user
 * could not see WHY a structured answer (capex / funding / cash / contradictions …) said what it said.
 * This pure mapper turns a raw audited tool call into a friendly, render-ready display model. Kept pure
 * (no React) so it is unit-tested in the node vitest env, with the chat page rendering the result.
 */
import type { ToolCallAudit } from '@/lib/chat/agent'

export type ToolCallDisplay = {
  label: string        // friendly Spanish label for the tool
  detail: string       // compact one-line summary of the call input (project, query, …)
  isError: boolean
  sourceCount: number  // # of documentary sources this call produced (search_documents)
}

const TOOL_LABELS: Record<string, string> = {
  search_documents: 'Búsqueda documental',
  get_capex_summary: 'Resumen de CapEx',
  get_funding_status: 'Estado de financiación',
  get_cash_runway: 'Caja / runway 13 semanas',
  get_covenant_status: 'Estado de covenants',
  get_risk_register: 'Registro de riesgos',
  get_contradictions: 'Alertas de contradicción',
  get_portfolio_context: 'Contexto de portfolio',
  compare_projects: 'Comparación de proyectos',
}

/** Read a string-ish field from an unknown JSON input without throwing. */
function readField(input: unknown, key: string): string | null {
  if (input == null || typeof input !== 'object' || Array.isArray(input)) return null
  const value = (input as Record<string, unknown>)[key]
  if (value == null) return null
  if (typeof value === 'string') return value.trim() || null
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return null
}

function summarizeInput(input: unknown): string {
  const parts: string[] = []
  // Project / entity scope first (most useful context), then the free-text query.
  const project = readField(input, 'project_id') ?? readField(input, 'project') ?? readField(input, 'entity_id')
  if (project) parts.push(project)
  const projects = (input != null && typeof input === 'object' && Array.isArray((input as Record<string, unknown>).project_ids))
    ? ((input as Record<string, unknown>).project_ids as unknown[]).filter((p) => typeof p === 'string').join(', ')
    : null
  if (projects) parts.push(projects)
  const query = readField(input, 'query') ?? readField(input, 'question') ?? readField(input, 'metric')
  if (query) parts.push(`"${query}"`)
  return parts.join(' · ')
}

export function formatToolCall(call: ToolCallAudit): ToolCallDisplay {
  return {
    label: TOOL_LABELS[call.name] ?? call.name,
    detail: summarizeInput(call.input),
    isError: call.is_error === true,
    sourceCount: typeof call.source_count === 'number' ? call.source_count : 0,
  }
}
