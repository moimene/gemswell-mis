import { hitAtK, mean } from './_harness'

export const CRITICAL_SMART_SEARCH_DOC_AT_1 = [
  'smart-mad-santander-bbva-cost',
  'smart-mad-buenavista-conditions',
] as const

export type SmartSearchEvalTopItem = {
  id: string
  title: string | null
  score: number
  role: string
}

export type SmartSearchEvalRow = {
  id: string
  ms: number
  rank: number
  snippetOk: boolean
  entityOk: boolean
  pass: boolean
  top: SmartSearchEvalTopItem[]
}

export type SmartSearchSummary = {
  ok: boolean
  failures: string[]
  total: number
  pass: number
  docAt1: number
  docAt3: number
  avgMs: number
  criticalAt1: Record<string, boolean>
}

export function buildSmartSearchSummary(
  rows: SmartSearchEvalRow[],
  criticalIds: readonly string[] = CRITICAL_SMART_SEARCH_DOC_AT_1,
): SmartSearchSummary {
  const failures: string[] = []
  const criticalAt1: Record<string, boolean> = {}

  if (rows.length === 0) failures.push('No smart-search rows were evaluated.')

  for (const row of rows) {
    if (!row.pass) failures.push(`${row.id} did not pass smart-search checks.`)
  }

  for (const id of criticalIds) {
    const row = rows.find((candidate) => candidate.id === id)
    const at1 = row?.rank === 1
    criticalAt1[id] = at1
    if (!at1) failures.push(`${id} was not retrieved at rank #1.`)
  }

  return {
    ok: failures.length === 0,
    failures,
    total: rows.length,
    pass: rows.filter((row) => row.pass).length,
    docAt1: rows.filter((row) => hitAtK(row.rank, 1)).length,
    docAt3: rows.filter((row) => hitAtK(row.rank, 3)).length,
    avgMs: rows.length ? mean(rows.map((row) => row.ms)) : 0,
    criticalAt1,
  }
}
