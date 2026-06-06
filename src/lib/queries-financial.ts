import { createClient } from './supabase'

// ─── CapEx Queries ───────────────────────────────────────────────
export async function getCapexByProject(projectId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('fct_capex_snapshot')
    .select('*, dim_capex_category(category_name, category_type)')
    .eq('project_id', projectId)
    .order('budget_baseline', { ascending: false })
  if (error) throw error
  return data
}

export async function getCapexSummary() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('fct_capex_snapshot')
    .select('project_id, budget_baseline, budget_approved_current, committed_amount, invoiced_amount, paid_amount, eac')
  if (error) throw error

  const summary: Record<string, {
    budget: number; approved: number; committed: number;
    invoiced: number; paid: number; eac: number
  }> = {}

  for (const row of data || []) {
    if (!summary[row.project_id]) {
      summary[row.project_id] = { budget: 0, approved: 0, committed: 0, invoiced: 0, paid: 0, eac: 0 }
    }
    summary[row.project_id].budget += row.budget_baseline || 0
    summary[row.project_id].approved += row.budget_approved_current || 0
    summary[row.project_id].committed += row.committed_amount || 0
    summary[row.project_id].invoiced += row.invoiced_amount || 0
    summary[row.project_id].paid += row.paid_amount || 0
    summary[row.project_id].eac += row.eac || 0
  }
  return summary
}

// ─── Cash Flow Queries ───────────────────────────────────────────
export async function getCashFlowByProject(projectId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('fct_cash_13w')
    .select('*')
    .eq('project_id', projectId)
    .order('week_start', { ascending: true })
  if (error) throw error
  return data
}

export async function getCashFlowSummary() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('fct_cash_13w')
    .select('project_id, cash_flow_type, amount_eur, confidence_level')
  if (error) throw error

  const summary: Record<string, {
    totalInflow: number; totalOutflow: number;
    actualInflow: number; actualOutflow: number
  }> = {}

  for (const row of data || []) {
    if (!summary[row.project_id]) {
      summary[row.project_id] = { totalInflow: 0, totalOutflow: 0, actualInflow: 0, actualOutflow: 0 }
    }
    const amt = row.amount_eur || 0
    if (amt > 0) {
      summary[row.project_id].totalInflow += amt
      if (row.confidence_level === 'Actual') summary[row.project_id].actualInflow += amt
    } else {
      summary[row.project_id].totalOutflow += amt
      if (row.confidence_level === 'Actual') summary[row.project_id].actualOutflow += amt
    }
  }
  return summary
}

// ─── Funding Queries ─────────────────────────────────────────────
export async function getFundingByProject(projectId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('fct_funding_snapshot')
    .select('*, dim_funding_instrument(instrument_name, instrument_type, currency, facility_limit)')
    .eq('project_id', projectId)
  if (error) throw error
  return data
}

