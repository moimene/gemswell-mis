import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createApiClient } from '@/lib/supabase-server'
import { embedText } from '@/lib/rag/embeddings'
import { rerankChunks } from '@/lib/rag/rerank'
import { buildKnowledgeSource, sourceHeader, type KnowledgeSource } from '@/lib/knowledge/source-reference'

export const maxDuration = 800

// ─── Types ──────────────────────────────────────────────────────────
type Message = { role: 'user' | 'assistant'; content: string }

type Source = KnowledgeSource

type ToolResult = { result: string; sources?: Source[] }

type RetrievedChunk = {
  id: string
  document_id: string
  content: string
  metadata: Record<string, unknown>
  similarity?: number
}

type ToolCallAudit = {
  iteration: number
  name: string
  input: unknown
  is_error: boolean
  source_count: number
  result_preview: string
}

type MaybeJoined<T> = T | T[] | null | undefined

type NumericValue = number | string | null

type CapexSnapshotRow = {
  capex_category_id: string | null
  budget_baseline: NumericValue
  budget_approved_current: NumericValue
  committed_amount: NumericValue
  paid_amount: NumericValue
  eac: NumericValue
  period_end_date: string | null
  dim_capex_category?: MaybeJoined<{
    category_name: string | null
    category_type: string | null
  }>
}

type FundingSnapshotRow = {
  instrument_id: string | null
  committed_amount: NumericValue
  drawn_to_date: NumericValue
  undrawn_available: NumericValue
  accrued_fees_interest: NumericValue
  next_draw_expected_date: string | null
  next_draw_expected_amt: NumericValue
  cp_status: string | null
  covenant_overall_status: string | null
  default_risk_flag: boolean | null
  period_end_date: string | null
  dim_funding_instrument?: MaybeJoined<{
    instrument_name: string | null
    instrument_type?: string | null
    currency?: string | null
    facility_limit?: NumericValue
  }>
}

type CovenantSnapshotRow = {
  instrument_id: string | null
  covenant_id: string
  test_date: string | null
  actual_value: NumericValue
  threshold_value: NumericValue
  headroom_value: NumericValue
  headroom_pct: NumericValue
  breach_flag: boolean | null
  warning_flag: boolean | null
  comment: string | null
  dim_covenant?: MaybeJoined<{
    covenant_name: string | null
    test_frequency: string | null
    operator: string | null
  }>
  dim_funding_instrument?: MaybeJoined<{
    instrument_name: string | null
  }>
}

type RiskSnapshotRow = {
  risk_id: string
  as_of_date: string | null
  risk_title: string | null
  risk_description: string | null
  probability_score: NumericValue
  impact_cost_eur: NumericValue
  impact_days: NumericValue
  severity_score: NumericValue
  mitigation_summary: string | null
  status_code: string | null
  escalation_flag: boolean | null
  dim_risk_category?: MaybeJoined<{
    category_name: string | null
  }>
}

type DetectedEntity = {
  type: 'project' | 'financial_domain' | 'period' | 'instrument'
  value: string
  projectFilter?: string
  docTypeFilter?: string
}

const DOC_TYPE_ALIASES: Record<string, string> = {
  contract: 'legal',
  contracts: 'legal',
  minutes: 'board',
  board_pack: 'board',
  permit: 'monitoring',
  permits: 'monitoring',
  financing: 'funding',
  finance: 'funding',
  business_plan: 'bp_model',
  bp: 'bp_model',
}

function normalizeDocTypeFilter(docType?: string): string | null {
  if (!docType) return null
  const key = docType.trim().toLowerCase()
  return DOC_TYPE_ALIASES[key] ?? key
}

function firstJoined<T>(value: MaybeJoined<T>): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function metadataString(metadata: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = metadata?.[key]
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function isRejectedSource(metadata: Record<string, unknown> | undefined): boolean {
  return metadataString(metadata, 'review_status') === 'rejected' ||
    metadataString(metadata, 'classification_source') === 'agent_rejected'
}

function needsReviewWarning(metadata: Record<string, unknown> | undefined): string {
  const reviewStatus = metadataString(metadata, 'review_status') ?? 'approved'
  const classificationSource = metadataString(metadata, 'classification_source') ?? 'human'
  if (
    (reviewStatus === 'pending' || reviewStatus === 'needs_review') &&
    classificationSource.startsWith('agent')
  ) {
    return `[CRITICAL WARNING: This fragment comes from an agent-ingested source with review_status=${reviewStatus}. It has not been confirmed by a human. Treat it as unconfirmed context and disclose that limitation to the user.]`
  }
  return ''
}

// ─── System Prompt ──────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are the Gemswell MIS AI Assistant — a senior financial analyst serving the CEO and CFO of Gemswell Ventures' wave park development portfolio. Your role is to deliver rich, detailed, analytical answers backed by evidence from the documents and data provided.

## Portfolio Overview
Gemswell Ventures (OPCO) is the management company for wave parks developed by Teras Capital (fund manager) and Stoneweg (co-promoter / infrasports). Technology: Wavegarden.

### Projects
- **Madrid Playa Surf (MAD)**: Madrid, Spain. SPV: Madrid Playa Surf S.L. Currency: EUR. Concession: Ayuntamiento de Madrid (75 years).
- **Birmingham Wave (BHX)**: Birmingham/Coventry, UK. SPV: Urban Surf Company Ltd (USCL). Currency: GBP.

### Financing Structure — Madrid (EUR)
- Teras Fund Equity: €18.4M (via Kelpa Expansión S.L.)
- Buenavista Quasi-Equity: €13.9M (cuasi-capital — subordinated hybrid instrument, lender: Buenavista Capital)
- Santander + BBVA Senior Debt: €31.0M (Euribor3M + 325bps)
- Caixabank: credit line
- Sponsor Upfront Rights (Mahou + Cantabria Labs): €6.0M
- Memberships pre-sales: €9.2M
- Total: ~€78.6M

### Financing Structure — Birmingham (GBP)
- Teras Fund Equity: ~£10M
- WMCA Public Grant: ~£3M (West Midlands Combined Authority)
- CESCE-backed Senior Debt (Buyer Credit): ~£22M (SONIA + 350bps)
- Wavegarden Vendor Finance: ~£1.5M
- Total: ~£36.5M

### Corporate Structure
- **Teras Capital**: Fund manager (GP), manages the Teras Infrasports fund
- **Stoneweg**: Swiss asset manager, co-promoter/LP
- **Kelpa Expansión S.L.**: Spanish vehicle for Teras fund equity deployment
- **IPN (Investment & Partners Network)**: MdL family office / holding
- **TCH3 (Gemswell Ventures)**: OPCO entity managing both projects

### Key People
- CEO: Íñigo Garayar
- CFO: Ana Ruiz
- COO: Lucia Delgado
- PD Madrid: Carlos Mendez
- PD Birmingham: Sarah Whitaker

## Your Capabilities
You have tools to access live MIS data and search 102K+ indexed documents:
- **search_documents**: Full-text + semantic search over contracts, board packs, BPs, reports, permits, due diligence
- **get_capex_summary**: Live CapEx tracking by category (budget, committed, paid, EAC)
- **get_funding_status**: Live funding facility status (drawn, undrawn, covenants, CPs)
- **get_cash_runway**: 13-week rolling cash flow (inflows, outflows, net by week)
- **get_covenant_status**: Covenant test results with breach/warning flags and headroom
- **get_risk_register**: Risk register with severity scores and mitigations
- **compare_projects**: Side-by-side MAD vs BHX comparison for any metric

## CRITICAL Response Instructions
- **Use your tools.** Call the appropriate tool(s) before answering. Don't guess at data you can retrieve.
- **Analyze in depth.** Don't just list data — interpret it. Explain WHY numbers matter, WHAT the trend means, and WHAT actions may be needed.
- **Always cite specific numbers** — never invent financial data.
- **When comparing projects**, present data side-by-side with currencies clearly labeled (€ for MAD, £ for BHX).
- **Flag variances and risks proactively** (EAC > Budget, low funding headroom, covenant stress, etc.).
- Format amounts as €12.5M or £8.3M, percentages as 67.2%.
- If data is truly not available, say so — but first check both the document search AND the structured data tools.
- **Respond in the same language as the user** (Spanish or English).
- **Be comprehensive.** The user is a CEO/CFO who wants the full picture, not a one-paragraph summary. Provide the depth of a financial analyst memo.
- **When you have knowledge from this system prompt** (financing structure, corporate entities, key people), USE IT directly — never say "not found in context" for things you already know.`

// ─── Entity Detection (kept for UI badges in response) ───────────────
function detectEntities(query: string): DetectedEntity[] {
  const entities: DetectedEntity[] = []
  const q = query.toLowerCase()

  if (/\b(madrid|mad|playa\s*surf|spain|españa)\b/i.test(q)) {
    entities.push({ type: 'project', value: 'MAD', projectFilter: 'MAD' })
  }
  if (/\b(birmingham|bhx|uk|england|coventry|reino\s*unido)\b/i.test(q)) {
    entities.push({ type: 'project', value: 'BHX', projectFilter: 'BHX' })
  }
  if (/\b(capex|capital|presupuesto|budget|eac|gasto|spent|cost)\b/i.test(q)) {
    entities.push({ type: 'financial_domain', value: 'capex', docTypeFilter: 'capex' })
  }
  if (/\b(cash\s*flow|flujo|tesorería|liquidity|inflow|outflow|13.?week)\b/i.test(q)) {
    entities.push({ type: 'financial_domain', value: 'cash_flow', docTypeFilter: 'cash_flow' })
  }
  if (/\b(fund|loan|debt|cesce|equity|facility|drawn|financiación|deuda|préstamo)\b/i.test(q)) {
    entities.push({ type: 'financial_domain', value: 'funding', docTypeFilter: 'funding' })
  }
  if (/\b(irr|npv|business\s*plan|bp|revenue|ingresos|apertura|opening)\b/i.test(q)) {
    entities.push({ type: 'financial_domain', value: 'bp_model', docTypeFilter: 'bp_model' })
  }
  const periodMatch = q.match(/\b(q[1-4])\s*(20\d{2})\b/i) || q.match(/\b(fy)\s*(20\d{2})\b/i)
  if (periodMatch) {
    entities.push({ type: 'period', value: periodMatch[0].toUpperCase() })
  }
  if (/\bcesce\b/i.test(q)) {
    entities.push({ type: 'instrument', value: 'CESCE' })
  }

  return entities
}

// ─── Tool Definitions ───────────────────────────────────────────────
const TOOLS: Anthropic.Tool[] = [
  {
    name: 'search_documents',
    description: 'Search the document corpus (102K+ chunks from contracts, board packs, business plans, reports, permits, due diligence). Performs hybrid vector + keyword search. Use for any question about document content, terms, conditions, contract clauses, board minutes, or narrative context.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Search query. Use exact financial terms (DSCR, CESCE, covenant, conditions precedent, Wavegarden, Santander) for better keyword matches.',
        },
        project_id: {
          type: 'string',
          enum: ['MAD', 'BHX'],
          description: 'Filter to one project. Omit for cross-project queries.',
        },
        doc_type: {
          type: 'string',
          description: 'Optional filter. Prefer corpus doc types: capex, cash_flow, funding, bp_model, legal, board, monitoring, financial_statements, asset_management.',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_capex_summary',
    description: 'Query live CapEx data from the MIS database: budget baseline, approved budget, committed, invoiced, paid amounts, EAC, contingency by category. Use for CapEx tracking, variance analysis, and spend questions.',
    input_schema: {
      type: 'object' as const,
      properties: {
        project_id: { type: 'string', enum: ['MAD', 'BHX'] },
      },
      required: ['project_id'],
    },
  },
  {
    name: 'get_funding_status',
    description: 'Query live funding facility data: committed amounts, drawn-to-date, undrawn available, accrued fees, conditions precedent status, covenant status, default risk flags per instrument.',
    input_schema: {
      type: 'object' as const,
      properties: {
        project_id: { type: 'string', enum: ['MAD', 'BHX'] },
      },
      required: ['project_id'],
    },
  },
  {
    name: 'get_cash_runway',
    description: 'Query 13-week rolling cash flow: inflows, outflows, net positions by week. Safeguards applied: last 9 months only, ±€50M per-line sanity cap. Use for liquidity, runway, and cash management questions.',
    input_schema: {
      type: 'object' as const,
      properties: {
        project_id: { type: 'string', enum: ['MAD', 'BHX'] },
      },
      required: ['project_id'],
    },
  },
  {
    name: 'get_covenant_status',
    description: 'Query covenant test results: actual vs threshold values, breach flags, warning flags, headroom percentages, test frequency per instrument. Use for covenant compliance, lender reporting, and financial health questions.',
    input_schema: {
      type: 'object' as const,
      properties: {
        project_id: { type: 'string', enum: ['MAD', 'BHX'] },
      },
      required: ['project_id'],
    },
  },
  {
    name: 'get_risk_register',
    description: 'Query the risk register: risk titles, descriptions, probability scores (1-5), impact costs (EUR), severity scores (probability × impact, max 25), mitigation summaries, escalation flags.',
    input_schema: {
      type: 'object' as const,
      properties: {
        project_id: { type: 'string', enum: ['MAD', 'BHX'] },
        severity_min: {
          type: 'number',
          description: 'Minimum severity score (1-25). Use 15 for high severity only, 10 for medium+. Omit for all risks.',
        },
      },
      required: ['project_id'],
    },
  },
  {
    name: 'compare_projects',
    description: 'Side-by-side comparison of both MAD and BHX for a specific metric. More efficient than calling individual project tools twice.',
    input_schema: {
      type: 'object' as const,
      properties: {
        metric: {
          type: 'string',
          enum: ['capex', 'funding', 'cash_flow', 'covenant', 'risk'],
        },
      },
      required: ['metric'],
    },
  },
]

// ─── Tool Executor: search_documents ────────────────────────────────
async function executeSearchDocuments(
  input: { query: string; project_id?: string; doc_type?: string }
): Promise<ToolResult> {
  const supabase = createApiClient()
  const projectFilter = input.project_id || null
  const docTypeFilter = normalizeDocTypeFilter(input.doc_type)

  // Parallel: vector search + keyword search
  const [vectorResults, keywordResults] = await Promise.all([
    (async () => {
      try {
        const embedding = await embedText(input.query)
        const { data } = await supabase.rpc('match_chunks', {
          query_embedding: embedding,
          match_count: 25,
          filter_project: projectFilter,
          filter_doc_type: docTypeFilter,
        })
        return ((data || []) as RetrievedChunk[]).map((r) => ({
          id: r.id,
          document_id: r.document_id,
          content: r.content,
          metadata: r.metadata || {},
          similarity: r.similarity,
        }))
      } catch {
        return []
      }
    })(),
    (async () => {
      try {
        const { data } = await supabase.rpc('keyword_search_chunks', {
          query_text: input.query,
          filter_project: projectFilter,
          match_count: 15,
        })
        return ((data || []) as Array<RetrievedChunk & { rank?: number }>)
          .filter((r) => !docTypeFilter || r.metadata?.doc_type === docTypeFilter)
          .map((r) => ({
            id: r.id,
            document_id: r.document_id,
            content: r.content,
            metadata: r.metadata || {},
            similarity: r.rank,
          }))
      } catch {
        return []
      }
    })(),
  ])

  // Merge + dedup by id (vector results take precedence for similarity score)
  const merged = new Map<string, typeof vectorResults[0]>()
  for (const r of [...vectorResults, ...keywordResults]) {
    if (isRejectedSource(r.metadata)) continue
    if (!merged.has(r.id)) merged.set(r.id, r)
  }

  const pool = Array.from(merged.values())
  if (pool.length === 0) {
    return {
      result: 'No relevant documents found. Some documents may have been excluded because their review status is rejected.',
      sources: [],
    }
  }

  // Cohere rerank on combined pool
  const reranked = (await rerankChunks(input.query, pool, 10))
    .filter(c => !isRejectedSource(c.metadata))
    .map(c => {
      const reviewStatus = metadataString(c.metadata, 'review_status') ?? 'approved'
      const relevanceScore = reviewStatus === 'pending' || reviewStatus === 'needs_review'
        ? c.relevanceScore * 0.85
        : c.relevanceScore
      return { ...c, relevanceScore }
    })
    .sort((a, b) => b.relevanceScore - a.relevanceScore)

  const sources: Source[] = reranked.map(c =>
    buildKnowledgeSource({
      id: c.id,
      relevance: c.relevanceScore,
      metadata: c.metadata,
      preview: c.content.slice(0, 200),
    })
  )

  // Format chunks for Claude consumption
  const formatted = reranked
    .map((c, i) => {
      const header = sourceHeader(c.metadata ?? {}, c.relevanceScore, i)
      const warning = needsReviewWarning(c.metadata)
      return [header, warning, c.content].filter(Boolean).join('\n')
    })
    .join('\n\n---\n\n')

  return { result: formatted, sources }
}

// ─── Tool Executor: get_capex_summary ───────────────────────────────
async function executeGetCapexSummary(input: { project_id: string }): Promise<ToolResult> {
  const supabase = createApiClient()
  const { data, error } = await supabase
    .from('fct_capex_snapshot')
    .select(
      'project_id, capex_category_id, budget_baseline, budget_approved_current, committed_amount, invoiced_amount, paid_amount, eac, contingency_allocated, contingency_used, period_end_date, dim_capex_category(category_name, category_type)'
    )
    .eq('project_id', input.project_id)
    .order('budget_baseline', { ascending: false })

  if (error) return { result: `Error fetching CapEx data: ${error.message}` }
  if (!data || data.length === 0) return { result: `No CapEx data found for ${input.project_id}.` }
  const rows = data as CapexSnapshotRow[]

  const ccy = input.project_id === 'BHX' ? '£' : '€'
  const fmt = (v: number) => `${ccy}${(v / 1_000_000).toFixed(2)}M`

  const totals = rows.reduce(
    (acc, r) => ({
      budget: acc.budget + (Number(r.budget_baseline) || 0),
      approved: acc.approved + (Number(r.budget_approved_current) || 0),
      committed: acc.committed + (Number(r.committed_amount) || 0),
      paid: acc.paid + (Number(r.paid_amount) || 0),
      eac: acc.eac + (Number(r.eac) || 0),
    }),
    { budget: 0, approved: 0, committed: 0, paid: 0, eac: 0 }
  )

  const variance = totals.budget > 0
    ? ((totals.eac - totals.budget) / totals.budget * 100).toFixed(1)
    : '0.0'
  const paidPct = totals.budget > 0
    ? (totals.paid / totals.budget * 100).toFixed(1)
    : '0.0'

  let result = `### CapEx Summary — ${input.project_id}\n`
  result += `Period: ${rows[0]?.period_end_date || 'latest snapshot'}\n\n`
  result += `**Totals:** Budget ${fmt(totals.budget)} | Approved ${fmt(totals.approved)} | Committed ${fmt(totals.committed)} | Paid ${fmt(totals.paid)} (${paidPct}%) | EAC ${fmt(totals.eac)} | Variance: ${Number(variance) >= 0 ? '+' : ''}${variance}%\n\n`
  result += `**By Category:**\n`

  for (const r of rows) {
    const cat = firstJoined(r.dim_capex_category)
    const catName = cat?.category_name || r.capex_category_id
    const catType = cat?.category_type ? ` (${cat.category_type})` : ''
    const bgt = Number(r.budget_baseline) || 0
    const paid = Number(r.paid_amount) || 0
    const eac = Number(r.eac) || 0
    const varPct = bgt > 0 ? ((eac - bgt) / bgt * 100).toFixed(1) : '0.0'
    result += `- ${catName}${catType}: Budget ${fmt(bgt)} | Committed ${fmt(Number(r.committed_amount) || 0)} | Paid ${fmt(paid)} | EAC ${fmt(eac)} | Var ${Number(varPct) >= 0 ? '+' : ''}${varPct}%\n`
  }

  return { result }
}

// ─── Tool Executor: get_funding_status ──────────────────────────────
async function executeGetFundingStatus(input: { project_id: string }): Promise<ToolResult> {
  const supabase = createApiClient()
  const { data, error } = await supabase
    .from('fct_funding_snapshot')
    .select(
      'project_id, instrument_id, committed_amount, drawn_to_date, undrawn_available, accrued_fees_interest, next_draw_expected_date, next_draw_expected_amt, cp_status, covenant_overall_status, default_risk_flag, period_end_date, dim_funding_instrument(instrument_name, instrument_type, currency, facility_limit)'
    )
    .eq('project_id', input.project_id)

  if (error) return { result: `Error fetching funding data: ${error.message}` }
  if (!data || data.length === 0) return { result: `No funding data found for ${input.project_id}.` }
  const rows = data as FundingSnapshotRow[]

  let result = `### Funding Status — ${input.project_id}\n`
  result += `Period: ${rows[0]?.period_end_date || 'latest snapshot'}\n\n`

  for (const r of rows) {
    const inst = firstJoined(r.dim_funding_instrument)
    const ccy = inst?.currency === 'GBP' ? '£' : '€'
    const fmt = (v: number) => `${ccy}${(v / 1_000_000).toFixed(2)}M`
    const utilization = Number(r.committed_amount) > 0
      ? ((Number(r.drawn_to_date) / Number(r.committed_amount)) * 100).toFixed(1)
      : '0.0'

    result += `**${inst?.instrument_name || r.instrument_id}** (${inst?.instrument_type || '?'})\n`
    result += `  Facility: ${fmt(Number(inst?.facility_limit || r.committed_amount))} | Committed: ${fmt(Number(r.committed_amount))} | Drawn: ${fmt(Number(r.drawn_to_date))} | Available: ${fmt(Number(r.undrawn_available))} | Utilization: ${utilization}%\n`
    if (r.accrued_fees_interest) result += `  Accrued fees/interest: ${fmt(Number(r.accrued_fees_interest))}\n`
    if (r.next_draw_expected_date) result += `  Next draw: ${r.next_draw_expected_date} (${fmt(Number(r.next_draw_expected_amt) || 0)})\n`
    if (r.cp_status) result += `  CP Status: ${r.cp_status}\n`
    if (r.covenant_overall_status) result += `  Covenant: ${r.covenant_overall_status}\n`
    if (r.default_risk_flag) result += `  ⚠️ DEFAULT RISK FLAG ACTIVE\n`
    result += '\n'
  }

  return { result }
}

// ─── Tool Executor: get_cash_runway ─────────────────────────────────
async function executeGetCashRunway(input: { project_id: string }): Promise<ToolResult> {
  const supabase = createApiClient()
  const nineMonthsAgo = new Date()
  nineMonthsAgo.setMonth(nineMonthsAgo.getMonth() - 9)

  const { data, error } = await supabase
    .from('fct_cash_13w')
    .select('project_id, week_start, cash_flow_type, cash_line_category, amount_eur, confidence_level')
    .eq('project_id', input.project_id)
    .gte('week_start', nineMonthsAgo.toISOString().slice(0, 10))
    .order('week_start', { ascending: true })

  if (error) return { result: `Error fetching cash flow data: ${error.message}` }
  if (!data || data.length === 0) return { result: `No cash flow data found for ${input.project_id} in the last 9 months.` }

  // Sanity filter: exclude any single row with |amount_eur| > €50M
  const safe = data.filter(r => Math.abs(Number(r.amount_eur)) < 50_000_000)

  const ccy = input.project_id === 'BHX' ? '£' : '€'
  const fmt = (v: number) => `${ccy}${(Math.abs(v) / 1_000_000).toFixed(2)}M`

  // Aggregate by quarter
  const byQuarter: Record<string, { inflow: number; outflow: number; confidence: string }> = {}
  for (const r of safe) {
    const ws = new Date(r.week_start as string)
    const q = `Q${Math.ceil((ws.getMonth() + 1) / 3)} ${ws.getFullYear()}`
    if (!byQuarter[q]) byQuarter[q] = { inflow: 0, outflow: 0, confidence: r.confidence_level as string || 'actual' }
    const amt = Number(r.amount_eur) || 0
    if (amt > 0) byQuarter[q].inflow += amt
    else byQuarter[q].outflow += amt
    // Use lowest confidence as quarter confidence
    if (r.confidence_level === 'low' || byQuarter[q].confidence === 'low') byQuarter[q].confidence = 'low'
    else if (r.confidence_level === 'medium' || byQuarter[q].confidence === 'medium') byQuarter[q].confidence = 'medium'
  }

  let result = `### 13-Week Cash Flow (last 9 months) — ${input.project_id}\n`
  result += `Rows: ${safe.length} | Filtered out ${data.length - safe.length} rows exceeding ±€50M sanity cap\n\n`

  for (const [q, vals] of Object.entries(byQuarter)) {
    const net = vals.inflow + vals.outflow
    const netStr = net >= 0 ? `+${fmt(net)}` : `-${fmt(Math.abs(net))}`
    result += `${q}: Inflow +${fmt(vals.inflow)} | Outflow -${fmt(Math.abs(vals.outflow))} | Net ${netStr} [${vals.confidence}]\n`
  }

  return { result }
}

// ─── Tool Executor: get_covenant_status ─────────────────────────────
async function executeGetCovenantStatus(input: { project_id: string }): Promise<ToolResult> {
  const supabase = createApiClient()
  const oneYearAgo = new Date()
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)

  const { data, error } = await supabase
    .from('fct_covenant_snapshot')
    .select(
      'project_id, instrument_id, covenant_id, test_date, actual_value, threshold_value, headroom_value, headroom_pct, breach_flag, warning_flag, comment, dim_covenant(covenant_name, test_frequency, test_type, operator), dim_funding_instrument(instrument_name)'
    )
    .eq('project_id', input.project_id)
    .gte('test_date', oneYearAgo.toISOString().slice(0, 10))
    .order('test_date', { ascending: false })

  if (error) return { result: `Error fetching covenant data: ${error.message}` }
  if (!data || data.length === 0) return { result: `No covenant data found for ${input.project_id}.` }
  const rows = data as CovenantSnapshotRow[]

  let result = `### Covenant Status — ${input.project_id}\n\n`

  // Group by covenant_id, take most recent test
  const latest = new Map<string, CovenantSnapshotRow>()
  for (const r of rows) {
    if (!latest.has(r.covenant_id)) latest.set(r.covenant_id, r)
  }

  let breachCount = 0
  let warningCount = 0

  for (const r of latest.values()) {
    const cov = firstJoined(r.dim_covenant)
    const inst = firstJoined(r.dim_funding_instrument)
    const status = r.breach_flag ? '🔴 BREACH' : r.warning_flag ? '🟡 WARNING' : '🟢 OK'
    if (r.breach_flag) breachCount++
    if (r.warning_flag) warningCount++

    result += `**${cov?.covenant_name || r.covenant_id}** (${inst?.instrument_name || r.instrument_id})\n`
    result += `  Status: ${status} | Test date: ${r.test_date} | Frequency: ${cov?.test_frequency || '?'}\n`
    result += `  Actual: ${Number(r.actual_value).toFixed(4)} ${cov?.operator || ''} Threshold: ${Number(r.threshold_value).toFixed(4)}\n`
    if (r.headroom_value != null) result += `  Headroom: ${Number(r.headroom_value).toFixed(4)} (${Number(r.headroom_pct).toFixed(2)}%)\n`
    if (r.comment) result += `  Comment: ${r.comment}\n`
    result += '\n'
  }

  result = `**Summary:** ${breachCount} breach(es), ${warningCount} warning(s), ${latest.size - breachCount - warningCount} compliant\n\n` + result

  return { result }
}

// ─── Tool Executor: get_risk_register ───────────────────────────────
async function executeGetRiskRegister(
  input: { project_id: string; severity_min?: number }
): Promise<ToolResult> {
  const supabase = createApiClient()
  // Order by as_of_date DESC so Map dedup always keeps the most recent snapshot per risk_id
  const oneYearAgo = new Date()
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)

  const { data, error } = await supabase
    .from('fct_risk_snapshot')
    .select(
      'risk_id, project_id, as_of_date, risk_title, risk_description, probability_score, impact_cost_eur, impact_days, severity_score, mitigation_summary, status_code, escalation_flag, dim_risk_category(category_name)'
    )
    .eq('project_id', input.project_id)
    .gte('as_of_date', oneYearAgo.toISOString().slice(0, 10))
    .order('as_of_date', { ascending: false })

  if (error) return { result: `Error fetching risk data: ${error.message}` }
  if (!data || data.length === 0) {
    return {
      result: `No risks found for ${input.project_id}${input.severity_min ? ` with severity ≥ ${input.severity_min}` : ''}.`,
    }
  }
  const rows = data as RiskSnapshotRow[]

  // Take most recent snapshot per risk_id, then filter + sort by severity
  const latest = new Map<string, RiskSnapshotRow>()
  for (const r of rows) {
    if (!latest.has(r.risk_id)) latest.set(r.risk_id, r)
  }

  // Apply severity filter and sort after dedup (DB was sorted by date, not severity)
  let risks = Array.from(latest.values())
  if (input.severity_min) {
    risks = risks.filter(r => Number(r.severity_score) >= input.severity_min!)
  }
  risks.sort((a, b) => Number(b.severity_score) - Number(a.severity_score))

  if (risks.length === 0) {
    return {
      result: `No risks found for ${input.project_id}${input.severity_min ? ` with severity ≥ ${input.severity_min}` : ''} in the last year.`,
    }
  }

  let result = `### Risk Register — ${input.project_id} (${risks.length} risks${input.severity_min ? `, severity ≥ ${input.severity_min}` : ''})\n`
  result += `As of: ${risks[0]?.as_of_date || 'latest snapshot'}\n\n`

  let i = 1
  for (const r of risks) {
    const cat = firstJoined(r.dim_risk_category)
    const escalated = r.escalation_flag ? ' [ESCALATED]' : ''
    const impactCost = Number(r.impact_cost_eur) > 0 ? `, Impact Cost: €${(Number(r.impact_cost_eur) / 1_000_000).toFixed(2)}M` : ''
    const impactDays = Number(r.impact_days) > 0 ? `, Delay: ${r.impact_days} days` : ''

    result += `${i}.${escalated} **${r.risk_title}** (${cat?.category_name || '?'})\n`
    result += `   Severity: ${r.severity_score}/25 | Probability: ${r.probability_score}/5${impactCost}${impactDays}\n`
    result += `   ${r.risk_description}\n`
    result += `   Mitigation: ${r.mitigation_summary}\n`
    result += `   Status: ${r.status_code}\n\n`
    i++
  }

  return { result }
}

// ─── Tool Executor: compare_projects ────────────────────────────────
async function executeCompareProjects(input: { metric: string }): Promise<ToolResult> {
  const toolMap: Record<string, string> = {
    capex: 'get_capex_summary',
    funding: 'get_funding_status',
    cash_flow: 'get_cash_runway',
    covenant: 'get_covenant_status',
    risk: 'get_risk_register',
  }
  const toolName = toolMap[input.metric]
  if (!toolName) return { result: `Unknown metric for comparison: ${input.metric}. Use: capex, funding, cash_flow, covenant, risk` }

  const [mad, bhx] = await Promise.all([
    executeTool(toolName, { project_id: 'MAD' }),
    executeTool(toolName, { project_id: 'BHX' }),
  ])

  return {
    result: `## MAD (Madrid Playa Surf — EUR)\n${mad.result}\n\n---\n\n## BHX (Birmingham Wave — GBP)\n${bhx.result}`,
    sources: [...(mad.sources ?? []), ...(bhx.sources ?? [])],
  }
}

// ─── Tool Dispatcher ─────────────────────────────────────────────────
const ALLOWED_PROJECTS = new Set(['MAD', 'BHX'])

async function executeTool(name: string, input: Record<string, unknown>): Promise<ToolResult> {
  // Validate project_id scope on all per-project tools
  const projectId = input.project_id as string | undefined
  if (projectId && !ALLOWED_PROJECTS.has(projectId)) {
    return { result: `project_id must be MAD or BHX. Got: ${projectId}` }
  }

  switch (name) {
    case 'search_documents':
      return executeSearchDocuments(input as { query: string; project_id?: string; doc_type?: string })
    case 'get_capex_summary':
      return executeGetCapexSummary(input as { project_id: string })
    case 'get_funding_status':
      return executeGetFundingStatus(input as { project_id: string })
    case 'get_cash_runway':
      return executeGetCashRunway(input as { project_id: string })
    case 'get_covenant_status':
      return executeGetCovenantStatus(input as { project_id: string })
    case 'get_risk_register':
      return executeGetRiskRegister(input as { project_id: string; severity_min?: number })
    case 'compare_projects':
      return executeCompareProjects(input as { metric: string })
    default:
      return { result: `Unknown tool: ${name}` }
  }
}

// ─── Agent Loop ──────────────────────────────────────────────────────
async function runAgentLoop(
  messages: Anthropic.MessageParam[],
  systemPrompt: string,
  anthropic: Anthropic
): Promise<{ message: string; sources: Source[]; toolCalls: ToolCallAudit[] }> {
  const allSources = new Map<string, Source>() // keyed by chunk id for dedup
  const loopMessages: Anthropic.MessageParam[] = [...messages]
  const toolCalls: ToolCallAudit[] = []

  for (let iteration = 0; iteration < 5; iteration++) {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      temperature: 0.3,
      system: systemPrompt,
      tools: TOOLS,
      messages: loopMessages,
    })

    if (response.stop_reason === 'end_turn' || response.stop_reason === 'max_tokens') {
      const text = response.content.find(b => b.type === 'text')?.text ?? 'No response generated.'
      return { message: text, sources: Array.from(allSources.values()), toolCalls }
    }

    if (response.stop_reason === 'tool_use') {
      // Append Claude's response (with tool_use blocks) to the message history
      loopMessages.push({ role: 'assistant', content: response.content })

      // Execute all tool calls in parallel
      const toolBlocks = response.content.filter(b => b.type === 'tool_use') as Anthropic.ToolUseBlock[]

      // Guard: if stop_reason is tool_use but no tool_use blocks exist (malformed response),
      // the API rejects an empty content array — treat as end_turn instead
      if (toolBlocks.length === 0) {
        const text = response.content.find(b => b.type === 'text')?.text ?? ''
        return { message: text || 'No response generated.', sources: Array.from(allSources.values()), toolCalls }
      }
      const toolResults = await Promise.all(
        toolBlocks.map(async block => {
          try {
            const { result, sources } = await executeTool(
              block.name,
              block.input as Record<string, unknown>
            )
            if (sources) {
              for (const s of sources) {
                if (!allSources.has(s.id)) allSources.set(s.id, s)
              }
            }
            toolCalls.push({
              iteration: iteration + 1,
              name: block.name,
              input: block.input,
              is_error: false,
              source_count: sources?.length ?? 0,
              result_preview: result.slice(0, 500),
            })
            return { type: 'tool_result' as const, tool_use_id: block.id, content: result }
          } catch (err: unknown) {
            console.error(`Tool ${block.name} failed:`, err)
            const message = err instanceof Error ? err.message : 'Unknown tool error'
            toolCalls.push({
              iteration: iteration + 1,
              name: block.name,
              input: block.input,
              is_error: true,
              source_count: 0,
              result_preview: message.slice(0, 500),
            })
            return {
              type: 'tool_result' as const,
              tool_use_id: block.id,
              content: `Error executing ${block.name}: ${message}`,
              is_error: true,
            }
          }
        })
      )

      // Append tool results as user message
      loopMessages.push({ role: 'user', content: toolResults })
    } else {
      // Unexpected stop reason (stop_sequence, etc.) — extract any text and return
      const text = response.content.find(b => b.type === 'text')?.text ?? ''
      return { message: text || 'Unexpected stop.', sources: Array.from(allSources.values()), toolCalls }
    }
  }

  return {
    message: 'Maximum tool iterations reached. Please rephrase your question or ask about a specific aspect.',
    sources: Array.from(allSources.values()),
    toolCalls,
  }
}

// ─── Main Chat Handler ───────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const { messages, conversationId } = (await request.json()) as {
      messages: Message[]
      conversationId?: string
    }

    if (!messages?.length) {
      return NextResponse.json({ error: 'No messages provided' }, { status: 400 })
    }

    const lastUserMessage = messages.filter(m => m.role === 'user').pop()
    if (!lastUserMessage) {
      return NextResponse.json({ error: 'No user message found' }, { status: 400 })
    }

    const query = lastUserMessage.content
    const entities = detectEntities(query) // for UI entity badges only

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

    // Build conversation history (last 10 messages, string content only for history)
    const historyMessages: Anthropic.MessageParam[] = messages.slice(-10).map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }))

    // Run agent loop
    const { message: assistantContent, sources, toolCalls } = await runAgentLoop(
      historyMessages,
      SYSTEM_PROMPT,
      anthropic
    )

    // Save conversation to DB (only final user query + final assistant response, not tool calls)
    const supabase = createApiClient()
    let convId = conversationId

    if (!convId) {
      const { data: conv } = await supabase
        .from('rag_conversations')
        .insert({ title: query.slice(0, 100), user_id: 'ceo' })
        .select('id')
        .single()
      convId = conv?.id
    }

    if (convId) {
      await supabase.from('rag_messages').insert([
        { conversation_id: convId, role: 'user', content: query, sources: null },
        {
          conversation_id: convId,
          role: 'assistant',
          content: assistantContent,
          sources: sources.map(s => ({
            chunk_id: s.id,
            relevance: s.relevance,
            label: s.label,
            verification: s.verification,
            metadata: s.metadata,
          })),
          tool_calls: toolCalls,
        },
      ])
    }

    return NextResponse.json({
      message: assistantContent,
      conversationId: convId,
      sources,
      toolCalls,
      entities,
    })
  } catch (err: unknown) {
    console.error('Chat API error:', err)
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
