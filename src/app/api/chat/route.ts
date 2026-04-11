import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createApiClient } from '@/lib/supabase-server'
import { embedText } from '@/lib/rag/embeddings'
import { rerankChunks } from '@/lib/rag/rerank'

// ─── Types ──────────────────────────────────────────────────────────
type Message = { role: 'user' | 'assistant'; content: string }

type StructuredContext = {
  capex: Record<string, unknown>[]
  cashFlow: Record<string, unknown>[]
  funding: Record<string, unknown>[]
}

// ─── System Prompt ──────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are the Gemswell MIS AI Assistant — an expert financial analyst for Gemswell Ventures' wave park development portfolio.

## Portfolio Overview
Gemswell Ventures develops Wavegarden-technology wave parks across Europe. The current portfolio consists of:
- **Madrid Playa Surf (MAD)**: Located in Madrid, Spain. Currency: EUR.
- **Birmingham (BHX)**: Located in Birmingham/Coventry, UK. Currency: GBP.

## Your Capabilities
You have access to real-time financial data from the MIS database, including:
1. **CapEx Tracking**: Budget baselines, approved budgets, committed amounts, invoiced, paid, and Estimate at Completion (EAC) by category
2. **Cash Flow**: 13-week rolling cash flow with inflows, outflows, confidence levels (Actual/Forecast/Budget)
3. **Funding**: Debt facilities (CESCE loans), equity positions, drawn/undrawn amounts, utilization rates
4. **Business Plan Model**: IRR, NPV, revenue projections, opening target dates

## Response Guidelines
- Always cite specific numbers from the provided context — never invent financial data
- When comparing projects, present data side-by-side with currencies clearly labeled
- Flag variances and risks proactively (EAC > Budget, low funding headroom, etc.)
- Use the format: €12.5M or £8.3M for amounts, 67.2% for percentages
- If data is not available in the context, say so explicitly — don't extrapolate
- Respond in the same language as the user's question (Spanish or English)
- Keep answers focused and actionable — this is a CEO-level tool`

// ─── Financial Entity Detection ─────────────────────────────────────
type DetectedEntity = {
  type: 'project' | 'financial_domain' | 'period' | 'instrument'
  value: string
  projectFilter?: string
  docTypeFilter?: string
}

function detectEntities(query: string): DetectedEntity[] {
  const entities: DetectedEntity[] = []
  const q = query.toLowerCase()

  // Projects
  if (/\b(madrid|mad|playa\s*surf|spain|españa)\b/i.test(q)) {
    entities.push({ type: 'project', value: 'MAD', projectFilter: 'MAD' })
  }
  if (/\b(birmingham|bhx|uk|england|coventry|reino\s*unido)\b/i.test(q)) {
    entities.push({ type: 'project', value: 'BHX', projectFilter: 'BHX' })
  }

  // Financial domains
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

  // Periods
  const periodMatch = q.match(/\b(q[1-4])\s*(20\d{2})\b/i) || q.match(/\b(fy)\s*(20\d{2})\b/i)
  if (periodMatch) {
    entities.push({ type: 'period', value: periodMatch[0].toUpperCase() })
  }

  // Instruments
  if (/\bcesce\b/i.test(q)) {
    entities.push({ type: 'instrument', value: 'CESCE' })
  }

  return entities
}

// ─── Structured Data Injection ──────────────────────────────────────
async function getStructuredContext(entities: DetectedEntity[]): Promise<StructuredContext> {
  const supabase = createApiClient()
  const projectIds = entities.filter(e => e.type === 'project').map(e => e.value)
  const domains = entities.filter(e => e.type === 'financial_domain').map(e => e.value)

  const context: StructuredContext = { capex: [], cashFlow: [], funding: [] }

  // If no specific project detected, fetch both
  const projects = projectIds.length > 0 ? projectIds : ['MAD', 'BHX']

  // Fetch relevant structured data based on detected domains
  const fetchAll = domains.length === 0 // no specific domain = fetch overview of all

  if (fetchAll || domains.includes('capex')) {
    const { data } = await supabase
      .from('fct_capex_snapshot')
      .select('project_id, category_id, budget_baseline, budget_approved_current, committed_amount, invoiced_amount, paid_amount, eac, dim_capex_category(category_name, category_type)')
      .in('project_id', projects)
      .order('budget_baseline', { ascending: false })
    context.capex = data || []
  }

  if (fetchAll || domains.includes('cash_flow')) {
    // For cash flow, aggregate by quarter to keep context manageable
    const { data } = await supabase
      .from('fct_cash_13w')
      .select('project_id, week_start, cash_flow_type, category, amount_eur, confidence_level')
      .in('project_id', projects)
      .order('week_start', { ascending: true })
      .limit(200) // latest entries
    context.cashFlow = data || []
  }

  if (fetchAll || domains.includes('funding')) {
    const { data } = await supabase
      .from('fct_funding_snapshot')
      .select('project_id, committed_amount, drawn_to_date, undrawn_available, next_drawdown_date, dim_funding_instrument(instrument_name, instrument_type, currency, total_facility)')
      .in('project_id', projects)
    context.funding = data || []
  }

  return context
}

function formatStructuredContext(ctx: StructuredContext): string {
  const sections: string[] = []

  if (ctx.capex.length > 0) {
    // Group by project and summarize
    const byProject: Record<string, typeof ctx.capex> = {}
    for (const row of ctx.capex) {
      const pid = row.project_id as string
      if (!byProject[pid]) byProject[pid] = []
      byProject[pid].push(row)
    }

    let capexText = '### CapEx Data (from fct_capex_snapshot)\n'
    for (const [pid, rows] of Object.entries(byProject)) {
      type Totals = { budget: number; approved: number; committed: number; paid: number; eac: number }
      const totals = rows.reduce<Totals>(
        (acc, r) => ({
          budget: acc.budget + (Number(r.budget_baseline) || 0),
          approved: acc.approved + (Number(r.budget_approved_current) || 0),
          committed: acc.committed + (Number(r.committed_amount) || 0),
          paid: acc.paid + (Number(r.paid_amount) || 0),
          eac: acc.eac + (Number(r.eac) || 0),
        }),
        { budget: 0, approved: 0, committed: 0, paid: 0, eac: 0 }
      )
      const ccy = pid === 'BHX' ? '£' : '€'
      const fmt = (v: number) => `${ccy}${(v / 1_000_000).toFixed(2)}M`
      capexText += `\n**${pid}** — Budget: ${fmt(totals.budget)} | Approved: ${fmt(totals.approved)} | Committed: ${fmt(totals.committed)} | Paid: ${fmt(totals.paid)} | EAC: ${fmt(totals.eac)} | Variance: ${((totals.eac - totals.budget) / totals.budget * 100).toFixed(1)}%\n`
      // Top categories
      const sorted = [...rows].sort((a, b) => Number(b.budget_baseline) - Number(a.budget_baseline)).slice(0, 5)
      for (const r of sorted) {
        const cat = (r as any).dim_capex_category
        const catName = cat?.category_name || r.category_id
        capexText += `  - ${catName}: Budget ${fmt(Number(r.budget_baseline))} → Paid ${fmt(Number(r.paid_amount))} (EAC ${fmt(Number(r.eac))})\n`
      }
    }
    sections.push(capexText)
  }

  if (ctx.funding.length > 0) {
    let fundingText = '### Funding Data (from fct_funding_snapshot)\n'
    for (const row of ctx.funding) {
      const inst = (row as any).dim_funding_instrument
      const ccy = inst?.currency === 'GBP' ? '£' : '€'
      const fmt = (v: number) => `${ccy}${(v / 1_000_000).toFixed(2)}M`
      fundingText += `- **${inst?.instrument_name || 'Unknown'}** (${inst?.instrument_type || '?'}, ${row.project_id}): Committed ${fmt(Number(row.committed_amount))} | Drawn ${fmt(Number(row.drawn_to_date))} | Available ${fmt(Number(row.undrawn_available))}\n`
    }
    sections.push(fundingText)
  }

  if (ctx.cashFlow.length > 0) {
    // Summarize cash flow by project and quarter
    const byProjectQ: Record<string, Record<string, { inflow: number; outflow: number }>> = {}
    for (const row of ctx.cashFlow) {
      const pid = row.project_id as string
      const ws = new Date(row.week_start as string)
      const q = `Q${Math.ceil((ws.getMonth() + 1) / 3)} ${ws.getFullYear()}`
      if (!byProjectQ[pid]) byProjectQ[pid] = {}
      if (!byProjectQ[pid][q]) byProjectQ[pid][q] = { inflow: 0, outflow: 0 }
      const amt = Number(row.amount_eur) || 0
      if (amt > 0) byProjectQ[pid][q].inflow += amt
      else byProjectQ[pid][q].outflow += amt
    }

    let cfText = '### Cash Flow Summary (from fct_cash_13w)\n'
    for (const [pid, quarters] of Object.entries(byProjectQ)) {
      const ccy = pid === 'BHX' ? '£' : '€'
      const fmt = (v: number) => `${ccy}${(Math.abs(v) / 1_000_000).toFixed(2)}M`
      cfText += `\n**${pid}**:\n`
      for (const [q, vals] of Object.entries(quarters).slice(-6)) {
        cfText += `  ${q}: +${fmt(vals.inflow)} / -${fmt(Math.abs(vals.outflow))} = net ${vals.inflow + vals.outflow >= 0 ? '+' : '-'}${fmt(Math.abs(vals.inflow + vals.outflow))}\n`
      }
    }
    sections.push(cfText)
  }

  return sections.length > 0
    ? '\n\n## Live MIS Data\n' + sections.join('\n')
    : ''
}

// ─── RAG Vector Search ──────────────────────────────────────────────
async function vectorSearch(
  query: string,
  entities: DetectedEntity[],
  matchCount = 15
): Promise<{ id: string; content: string; metadata: Record<string, unknown>; similarity: number }[]> {
  try {
    const supabase = createApiClient()
    const queryEmbedding = await embedText(query)

    const projectFilter = entities.find(e => e.projectFilter)?.projectFilter || null
    const docTypeFilter = entities.find(e => e.docTypeFilter)?.docTypeFilter || null

    const { data, error } = await supabase.rpc('match_chunks', {
      query_embedding: queryEmbedding,
      match_count: matchCount,
      filter_project: projectFilter,
      filter_doc_type: docTypeFilter,
    })

    if (error) {
      console.error('Vector search error:', error)
      return []
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      content: row.content,
      metadata: row.metadata || {},
      similarity: row.similarity,
    }))
  } catch (err) {
    console.error('Vector search failed:', err)
    return []
  }
}

// ─── Main Chat Handler ──────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const { messages, conversationId } = await request.json() as {
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

    // Step 1: Detect financial entities
    const entities = detectEntities(query)

    // Step 2: Parallel — vector search + structured data fetch
    const [vectorResults, structuredCtx] = await Promise.all([
      vectorSearch(query, entities),
      getStructuredContext(entities),
    ])

    // Step 3: Rerank vector results
    const reranked = await rerankChunks(
      query,
      vectorResults.map(r => ({
        id: r.id,
        content: r.content,
        metadata: r.metadata,
        similarity: r.similarity,
      })),
      5
    )

    // Step 4: Build context
    const ragContext = reranked.length > 0
      ? '\n\n## Retrieved Document Chunks\n' +
        reranked.map((c, i) =>
          `[Source ${i + 1}] (relevance: ${(c.relevanceScore * 100).toFixed(0)}%)\n${c.content}`
        ).join('\n\n')
      : ''

    const structuredText = formatStructuredContext(structuredCtx)
    const fullContext = structuredText + ragContext

    // Step 5: Build messages for Claude
    const systemWithContext = SYSTEM_PROMPT +
      (fullContext ? `\n\n## Context for this query\n${fullContext}` : '')

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

    // Keep last 10 messages for conversation history
    const historyMessages = messages.slice(-10).map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }))

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: systemWithContext,
      messages: historyMessages,
    })

    const assistantContent = response.content[0]?.type === 'text'
      ? response.content[0].text
      : 'No response generated.'

    // Step 6: Save to conversation history
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
      // Save both user message and assistant response
      await supabase.from('rag_messages').insert([
        {
          conversation_id: convId,
          role: 'user',
          content: query,
          sources: null,
        },
        {
          conversation_id: convId,
          role: 'assistant',
          content: assistantContent,
          sources: reranked.map(c => ({
            chunk_id: c.id,
            relevance: c.relevanceScore,
            metadata: c.metadata,
          })),
        },
      ])
    }

    return NextResponse.json({
      message: assistantContent,
      conversationId: convId,
      sources: reranked.map(c => ({
        id: c.id,
        relevance: c.relevanceScore,
        metadata: c.metadata,
        preview: c.content.slice(0, 200),
      })),
      entities,
    })

  } catch (err: any) {
    console.error('Chat API error:', err)
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
