import { createClient } from './supabase'

const supabase = createClient()

export async function getProjects() {
  const { data, error } = await supabase.from('dim_project').select('*').eq('active', true)
  if (error) throw error
  return data
}

export async function getPortfolioKPIs(snapshotDate: string) {
  const { data, error } = await supabase.rpc('get_portfolio_kpis', { snapshot_date: snapshotDate })
  if (error) throw error
  return data
}

export async function getTaskSnapshots(projectId?: string) {
  let query = supabase.from('fct_task_snapshot').select('*, dim_task(*), dim_owner(*)')
  if (projectId) query = query.eq('project_id', projectId)
  const { data, error } = await query.order('as_of_week_ending', { ascending: false })
  if (error) throw error
  return data
}

export async function getCapexSnapshots(projectId?: string) {
  let query = supabase.from('fct_capex_snapshot').select('*, dim_capex_category(*)')
  if (projectId) query = query.eq('project_id', projectId)
  const { data, error } = await query
  if (error) throw error
  return data
}

export async function getFundingSnapshots(projectId?: string) {
  let query = supabase.from('fct_funding_snapshot').select('*, dim_funding_instrument(*)')
  if (projectId) query = query.eq('project_id', projectId)
  const { data, error } = await query
  if (error) throw error
  return data
}

export async function getRisks(projectId?: string) {
  let query = supabase.from('fct_risk_snapshot').select('*, dim_risk_category(*), dim_owner(*)')
  if (projectId) query = query.eq('project_id', projectId)
  const { data, error } = await query.order('severity_score', { ascending: false })
  if (error) throw error
  return data
}

export async function getActions(projectId?: string) {
  let query = supabase.from('fct_action_snapshot').select('*, dim_owner(*), dim_action_status(*)')
  if (projectId) query = query.eq('project_id', projectId)
  const { data, error } = await query
  if (error) throw error
  return data
}

export async function getDecisions(projectId?: string) {
  let query = supabase.from('fct_decision_log').select('*, dim_owner:decision_owner_id(*)')
  if (projectId) query = query.eq('project_id', projectId)
  const { data, error } = await query.order('decision_date', { ascending: false })
  if (error) throw error
  return data
}
