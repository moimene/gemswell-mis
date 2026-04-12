'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { formatCurrency, formatCompact, formatPercent, type RAGColor } from '@/lib/utils'
import { KPICard } from '@/components/shared/KPICard'
import { RAGBadge } from '@/components/shared/RAGBadge'
import { BarChart3 } from 'lucide-react'

type ProjectTab = 'MAD' | 'BHX'
type CommRow = {
  id: string; project_id: string; as_of_week_ending: string; channel_id: string
  marketing_spend: number; leads: number; qualified_leads: number
  reservations: number; deposits_count: number; deposits_value: number
  revenue_booked: number; campaign_name: string | null
  dim_channel: { channel_name: string; channel_type: string } | null
}
type ChSummary = {
  channel_id: string; channel_name: string; channel_type: string
  leads: number; qualified_leads: number; reservations: number
  revenue_booked: number; marketing_spend: number
}
type WeekRow = { week_ending: string; reservations: number; revenue: number; deposits: number; spend: number }

const convRAG = (p: number): RAGColor => p >= 30 ? 'Green' : p >= 10 ? 'Amber' : 'Red'
const roasRAG = (r: number): RAGColor => r >= 5 ? 'Green' : r >= 2 ? 'Amber' : 'Red'
const fmtWeek = (d: string) => new Date(d).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'2-digit' })
const CH_COLOR: Record<string, string> = {
  Owned: 'bg-blue-50 text-blue-700', Paid: 'bg-purple-50 text-purple-700',
  Earned: 'bg-green-50 text-green-700', Partner: 'bg-amber-50 text-amber-700',
}

export default function CommercialPage() {
  const [activeProject, setActiveProject] = useState<ProjectTab>('MAD')
  const [rows, setRows] = useState<CommRow[]>([])
  const [loading, setLoading] = useState(true)
  const [latestWeek, setLatestWeek] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const sb = createClient()
      const { data: latest } = await sb
        .from('fct_commercial').select('as_of_week_ending')
        .eq('project_id', activeProject).order('as_of_week_ending', { ascending: false }).limit(1).single()
      if (!latest) { setRows([]); setLoading(false); return }
      setLatestWeek(latest.as_of_week_ending)
      const since = new Date(latest.as_of_week_ending)
      since.setDate(since.getDate() - 55)
      const { data } = await sb
        .from('fct_commercial')
        .select('*, dim_channel(channel_name, channel_type)')
        .eq('project_id', activeProject)
        .gte('as_of_week_ending', since.toISOString().split('T')[0])
        .order('as_of_week_ending', { ascending: false })
      setRows((data || []) as CommRow[])
      setLoading(false)
    }
    load()
  }, [activeProject])

  const ccy = activeProject === 'BHX' ? 'GBP' : 'EUR'
  const latestRows = rows.filter(r => r.as_of_week_ending === latestWeek)
  const kpi = {
    reservations: latestRows.reduce((s, r) => s + (r.reservations || 0), 0),
    revenue:      latestRows.reduce((s, r) => s + (r.revenue_booked || 0), 0),
    deposits:     latestRows.reduce((s, r) => s + (r.deposits_value || 0), 0),
    spend:        latestRows.reduce((s, r) => s + (r.marketing_spend || 0), 0),
  }
  const overallRoas = kpi.spend > 0 ? kpi.revenue / kpi.spend : 0

  // Channel summary (latest week)
  const chMap: Record<string, ChSummary> = {}
  for (const r of latestRows) {
    if (!chMap[r.channel_id]) chMap[r.channel_id] = {
      channel_id: r.channel_id, channel_name: r.dim_channel?.channel_name ?? r.channel_id,
      channel_type: r.dim_channel?.channel_type ?? '—',
      leads: 0, qualified_leads: 0, reservations: 0, revenue_booked: 0, marketing_spend: 0,
    }
    const c = chMap[r.channel_id]
    c.leads += r.leads || 0; c.qualified_leads += r.qualified_leads || 0
    c.reservations += r.reservations || 0; c.revenue_booked += r.revenue_booked || 0
    c.marketing_spend += r.marketing_spend || 0
  }
  const channelRows = Object.values(chMap).sort((a, b) => b.revenue_booked - a.revenue_booked)

  // Weekly trend (last 8 weeks)
  const wkMap: Record<string, WeekRow> = {}
  for (const r of rows) {
    if (!wkMap[r.as_of_week_ending]) wkMap[r.as_of_week_ending] = { week_ending: r.as_of_week_ending, reservations: 0, revenue: 0, deposits: 0, spend: 0 }
    const w = wkMap[r.as_of_week_ending]
    w.reservations += r.reservations || 0; w.revenue += r.revenue_booked || 0
    w.deposits += r.deposits_value || 0; w.spend += r.marketing_spend || 0
  }
  const weekRows: WeekRow[] = Object.values(wkMap).sort((a, b) => b.week_ending.localeCompare(a.week_ending)).slice(0, 8)

  const TAB_CLS = (active: boolean) =>
    `rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${active ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Commercial</h1>
          <p className="text-sm text-slate-500">
            {latestWeek ? `Week ending ${fmtWeek(latestWeek)} — channel performance & pipeline` : 'Reservations, pipeline, and marketing performance'}
          </p>
        </div>
        <div className="flex gap-1 rounded-lg border bg-white p-1">
          {(['MAD','BHX'] as const).map(t => (
            <button key={t} type="button" onClick={() => setActiveProject(t)} className={TAB_CLS(activeProject === t)}>
              {t === 'MAD' ? 'Madrid Playa Surf' : 'Birmingham'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64"><p className="text-slate-400">Loading commercial data...</p></div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border bg-white p-12 text-center">
          <BarChart3 className="h-10 w-10 mx-auto mb-3 text-slate-300" />
          <h3 className="text-base font-semibold text-slate-700 mb-1">Commercial tracking not yet active</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            Commercial tracking will be active from 12 months before opening. Channel performance,
            reservation pipeline, and marketing ROI will appear here once pre-sales begin.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KPICard title="Total Reservations" value={kpi.reservations.toLocaleString()} subtitle="Latest week, all channels" />
            <KPICard title="Revenue Booked" value={formatCompact(kpi.revenue, ccy)} subtitle="Confirmed revenue" rag={kpi.revenue > 0 ? 'Green' : 'Grey'} />
            <KPICard title="Total Deposits" value={formatCompact(kpi.deposits, ccy)} subtitle="Deposits collected" />
            <KPICard
              title="Marketing Spend"
              value={formatCompact(kpi.spend, ccy)}
              subtitle={kpi.spend > 0 ? `ROAS ${overallRoas.toFixed(1)}x` : 'Across all channels'}
              rag={kpi.spend > 0 ? roasRAG(overallRoas) : undefined}
            />
          </div>

          {/* Channel Performance */}
          <div className="rounded-lg border bg-white overflow-hidden">
            <div className="px-6 py-4 border-b"><h3 className="text-sm font-medium text-slate-700">Channel Performance</h3></div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-left">
                    {['Channel','Type','Leads','Conv.%','Reservations','Revenue Booked','Spend','ROAS'].map((h, i) => (
                      <th key={h} className={`px-4 py-3 font-medium text-slate-600 ${[2,4,5,6].includes(i) ? 'text-right' : [3,7].includes(i) ? 'text-center' : ''}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {channelRows.map(ch => {
                    const convPct = ch.leads > 0 ? (ch.qualified_leads / ch.leads) * 100 : 0
                    const roas = ch.marketing_spend > 0 ? ch.revenue_booked / ch.marketing_spend : 0
                    return (
                      <tr key={ch.channel_id} className="border-b hover:bg-slate-50">
                        <td className="px-4 py-2.5 font-medium text-slate-900">{ch.channel_name}</td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${CH_COLOR[ch.channel_type] ?? 'bg-slate-50 text-slate-600'}`}>{ch.channel_type}</span>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-xs">{ch.leads.toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-center"><RAGBadge status={convRAG(convPct)} label={formatPercent(convPct)} /></td>
                        <td className="px-4 py-2.5 text-right font-mono text-xs">{ch.reservations.toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-xs font-medium">{formatCurrency(ch.revenue_booked, ccy)}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-xs text-slate-500">{ch.marketing_spend > 0 ? formatCompact(ch.marketing_spend, ccy) : '—'}</td>
                        <td className="px-4 py-2.5 text-center">
                          {ch.marketing_spend > 0
                            ? <RAGBadge status={roasRAG(roas)} label={`${roas.toFixed(1)}x`} />
                            : <span className="text-xs text-slate-400">—</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Weekly Trend */}
          {weekRows.length > 0 && (
            <div className="rounded-lg border bg-white overflow-hidden">
              <div className="px-6 py-4 border-b"><h3 className="text-sm font-medium text-slate-700">Weekly Trend — Last 8 Weeks</h3></div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-slate-50 text-left">
                      {['Week Ending','Reservations','Revenue','Deposits','Spend'].map((h, i) => (
                        <th key={h} className={`px-4 py-3 font-medium text-slate-600 ${i > 0 ? 'text-right' : ''}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {weekRows.map((w, i) => (
                      <tr key={w.week_ending} className={`border-b hover:bg-slate-50 ${i === 0 ? 'bg-slate-50' : ''}`}>
                        <td className="px-4 py-2.5 font-mono text-xs text-slate-600">
                          {fmtWeek(w.week_ending)}
                          {i === 0 && <span className="ml-2 rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">Latest</span>}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-xs">{w.reservations.toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-xs">{formatCompact(w.revenue, ccy)}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-xs">{formatCompact(w.deposits, ccy)}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-xs text-slate-500">{w.spend > 0 ? formatCompact(w.spend, ccy) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
