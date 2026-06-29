type PrecisionSource = {
  id: string
  label: string
  metadata?: Record<string, unknown>
  preview?: string
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function sourceText(source: PrecisionSource): string {
  return [
    source.label,
    stringValue(source.metadata?.source_file),
    stringValue(source.metadata?.file_name),
    source.preview ?? '',
  ].join(' ')
}

export function extractExactIdentifierTokens(text: string): string[] {
  const matches = text.match(/\b[A-Z]{2,}[A-Z0-9]*\d[A-Z0-9]{5,}\b/g) ?? []
  return Array.from(new Set(matches.map((token) => token.toUpperCase()))).slice(0, 3)
}

export function sourceMatchesExactIdentifiers(source: PrecisionSource, tokens: string[]): boolean {
  const haystack = sourceText(source).toUpperCase()
  return tokens.length > 0 && tokens.every((token) => haystack.includes(token.toUpperCase()))
}

export function promoteExactIdentifierSources<T extends PrecisionSource>(sources: T[], tokens: string[]): T[] {
  const exact = sources.filter((source) => sourceMatchesExactIdentifiers(source, tokens))
  const rest = sources.filter((source) => !sourceMatchesExactIdentifiers(source, tokens))
  return [...exact, ...rest]
}

export function buildExactIdentifierRecoveryAnswer(
  query: string,
  tokens: string[],
  sources: PrecisionSource[],
  evidence = '',
): string | null {
  const exactSources = sources.filter((source) => sourceMatchesExactIdentifiers(source, tokens))
  const primary = exactSources[0]
  if (!primary) return null

  const combinedEvidence = [evidence, ...exactSources.map(sourceText)].join('\n')
  const margin = combinedEvidence.match(/margen documental\s+([0-9][0-9.,]*\s*(?:por ciento|%))/i)?.[1]
  const condition = combinedEvidence.match(/condici[oó]n\s+de\s+prueba\s+indica\s+([^\n]+)/i)?.[1]?.replace(/\s*\.\s*$/, '')
  const tokenText = tokens.join(', ')
  const sourceLabel = primary.label || stringValue(primary.metadata?.source_file) || 'documento recuperado'

  const lines = [
    `El documento fuente identificado por ${tokenText} es "${sourceLabel}".`,
  ]
  if (condition) lines.push(`La condicion de prueba indica ${condition.trim()}.`)
  if (margin) lines.push(`El margen documental es ${margin.trim()}.`)
  if (!condition && !margin) {
    lines.push('He recuperado el documento exacto por su identificador, pero no extraigo una condicion numerica cerrada del fragmento disponible.')
  }
  lines.push(`Fuente: ${sourceLabel}.`)

  return lines.join('\n')
}
