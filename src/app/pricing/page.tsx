'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { cn, formatCurrency, formatPercent, type RAGColor } from '@/lib/utils'
import { KPICard } from '@/components/shared/KPICard'
import { RAGBadge } from '@/components/shared/RAGBadge'
import { Tag } from 'lucide-react'

type ProjectTab = 'MAD' | 'BHX'
type Slot = {
  id: string; product_id: string; timeband_id: string
  capacity_units: number; units_sold: number; waitlist_units: number
  floor_price: number; base_price: number; ceiling_price: number; net_price: number
  gross_revenue: number; occupancy_pct: number; service_date: string
  dim_product: { product_name: string; duration_min: number } | null
  dim_timeband: { daypart: string; is_peak: boolean } | null
}
type CorridorRow = {
  product_name: string; daypart: string; is_peak: boolean
  floor_price: number; base_price: number; ceiling_price: number; net_price: number
  occupancy_pct: number; gross_revenue: number; waitlist_units: number
  capacity_units: number; units_sold: number
}

const occRAG = (p: number): RAGColor => p >= 70 ? 'Green' : p >= 40 ? 'Amber' : 'Red'
const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']

export default function PricingPage() {
  const [activeProject, setActiveProject] = useState<ProjectTab>('MAD')
  const [slots, setSlots] = useState<Slot[]>([])
  const [loading, setLoading] = useState(true)
  const [snapshotDate, setSnapshotDate] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const sb = createClient()
      const { data: latest } = await sb
        .from('fct_pricing_slot').select('snapshot_date')
        .eq('project_id', activeProject).order('snapshot_date', { ascending: false }).limit(1).single()
      if (!latest) { setSlots([]); setLoading(false); return }
      setSnapshotDate(latest.snapshot_date)
      const { data } = await sb
        .from('fct_pricing_slot')
        .select('*, dim_product(product_name, duration_min), dim_timeband(daypart, is_peak)')
        .eq('project_id', activeProject).eq('snapshot_date', latest.snapshot_date)
      setSlots((data || []) as Slot[])
      setLoading(false)
    }
    load()
  }, [activeProject])

  const ccy = activeProject === 'BHX' ? 'GBP' : 'EUR'
  const totalCapacity = slots.reduce((s, r) => s + (r.capacity_units || 0), 0)
  const totalSold = slots.reduce((s, r) => s + (r.units_sold || 0), 0)
  const avgOcc = totalCapacity > 0 ? (totalSold / totalCapacity) * 100 : 0
  const grossRev = slots.reduce((s, r) => s + (r.gross_revenue || 0), 0)

  // Corridor: group by product + daypart
  const corridorMap: Record<string, CorridorRow> = {}
  for (const s of slots) {
    const k = `${s.dim_product?.product_name ?? s.product_id}__${s.dim_timeband?.daypart ?? ''}__${s.dim_timeband?.is_peak}`
    if (!corridorMap[k]) corridorMap[k] = {
      product_name: s.dim_product?.product_name ?? s.product_id,
      daypart: s.dim_timeband?.daypart ?? '—', is_peak: s.dim_timeband?.is_peak ?? false,
      floor_price: s.floor_price, base_price: s.base_price,
      ceiling_price: s.ceiling_price, net_price: s.net_price,
      occupancy_pct: 0, gross_revenue: 0, waitlist_units: 0, capacity_units: 0, units_sold: 0,
    }
    const r = corridorMap[k]
    r.gross_revenue += s.gross_revenue || 0; r.waitlist_units += s.waitlist_units || 0
    r.capacity_units += s.capacity_units || 0; r.units_sold += s.units_sold || 0
  }
  const corridorRows = Object.values(corridorMap).map(r => ({
    ...r, occupancy_pct: r.capacity_units > 0 ? (r.units_sold / r.capacity_units) * 100 : 0,
  })).sort((a, b) => a.product_name.localeCompare(b.product_name) || a.daypart.localeCompare(b.daypart))

  // Heatmap: next 4 weeks
  const today = new Date()
  const in28 = new Date(today); in28.setDate(today.getDate() + 28)
  const heatMap: Record<string, Record<number, number>> = {}
  for (const s of slots) {
    if (!s.service_date) continue
    const d = new Date(s.service_date)
    if (d < today || d > in28) continue
    const wk = `W+${Math.floor((d.getTime() - today.getTime()) / (7 * 86400000)) + 1}`
    const dow = (d.getDay() + 6) % 7
    if (!heatMap[wk]) heatMap[wk] = {}
    heatMap[wk][dow] = (heatMap[wk][dow] || 0) + (s.occupancy_pct || 0)
  }
  const heatWeeks = Object.keys(heatMap).sort()
  const hasFuture = heatWeeks.length > 0

  const TAB_CLS = (active: boolean) =>
    `rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${active ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Pricing & Ticketing</h1>
          <p className="text-sm text-slate-500">
            {snapshotDate ? `Snapshot: ${new Date(snapshotDate).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })}` : 'Revenue pricing by product & timeband'}
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
        <div className="flex items-center justify-center h-64"><p className="text-slate-400">Loading pricing data...</p></div>
      ) : slots.length === 0 ? (
        <div className="rounded-lg border bg-white p-12 text-center">
          <Tag className="h-10 w-10 mx-auto mb-3 text-slate-300" />
          <h3 className="text-base font-semibold text-slate-700 mb-1">Pricing data not yet available</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            {activeProject === 'MAD'
              ? 'Pricing data will be available when operations begin (Q1 2027 for MAD). The tariff structure is currently in design.'
              : 'Pricing data will be available when Birmingham moves into operational planning.'}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KPICard title="Total Capacity" value={totalCapacity.toLocaleString()} subtitle="Units across all slots" />
            <KPICard title="Units Sold" value={totalSold.toLocaleString()} subtitle={`${formatPercent(avgOcc)} occupancy`} />
            <KPICard title="Avg Occupancy" value={formatPercent(avgOcc)} subtitle="Sold / Capacity" rag={occRAG(avgOcc)} />
            <KPICard title="Gross Revenue" value={formatCurrency(grossRev, ccy)} subtitle="Sum of all slots" />
          </div>

          <div className="rounded-lg border bg-white overflow-hidden">
            <div className="px-6 py-4 border-b flex items-center gap-2">
              <h3 className="text-sm font-medium text-slate-700">Pricing Corridor</h3>
              <span className="text-xs text-slate-400">Floor · Base · Ceiling by product & daypart</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-left">
                    {['Product','Daypart','Floor','Base','Ceiling','Net Price','Occupancy','Revenue'].map((h, i) => (
                      <th key={h} className={`px-4 py-3 font-medium text-slate-600 ${i >= 2 && i !== 6 ? 'text-right' : i === 6 ? 'text-center' : ''}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {corridorRows.map((row, i) => (
                    <tr key={i} className="border-b hover:bg-slate-50">
                      <td className="px-4 py-2.5 font-medium text-slate-900">
                        <span className="flex items-center gap-1.5">
                          {row.product_name}
                          {row.is_peak && <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">Peak</span>}
                          {row.waitlist_units > 0 && <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">Waitlist</span>}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-600 text-xs">{row.daypart}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-slate-500 text-xs">{formatCurrency(row.floor_price, ccy)}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs">{formatCurrency(row.base_price, ccy)}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-slate-500 text-xs">{formatCurrency(row.ceiling_price, ccy)}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-semibold text-xs">{formatCurrency(row.net_price, ccy)}</td>
                      <td className="px-4 py-2.5 text-center"><RAGBadge status={occRAG(row.occupancy_pct)} label={formatPercent(row.occupancy_pct)} /></td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs font-medium">{formatCurrency(row.gross_revenue, ccy)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {hasFuture && (
            <div className="rounded-lg border bg-white overflow-hidden">
              <div className="px-6 py-4 border-b"><h3 className="text-sm font-medium text-slate-700">Occupancy Heatmap — Next 4 Weeks</h3></div>
              <div className="overflow-x-auto p-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left">
                      <th className="px-3 py-2 font-medium text-slate-500 text-xs w-16">Week</th>
                      {DAYS.map(d => <th key={d} className="px-3 py-2 font-medium text-slate-500 text-xs text-center">{d}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {heatWeeks.map(wk => (
                      <tr key={wk} className="border-t">
                        <td className="px-3 py-2 text-xs font-medium text-slate-600">{wk}</td>
                        {DAYS.map((_, dow) => {
                          const occ = heatMap[wk][dow] ?? null
                          const bg = occ === null ? 'bg-slate-100' : occ >= 70 ? 'bg-green-200' : occ >= 40 ? 'bg-amber-200' : 'bg-red-200'
                          return (
                            <td key={dow} className="px-3 py-2 text-center">
                              <span className={cn('inline-block rounded px-2 py-1 text-xs font-mono', bg)}>
                                {occ !== null ? `${occ.toFixed(0)}%` : '—'}
                              </span>
                            </td>
                          )
                        })}
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
