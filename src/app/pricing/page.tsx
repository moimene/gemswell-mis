'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { cn, formatCurrency, formatPercent, type RAGColor } from '@/lib/utils'
import { KPICard } from '@/components/shared/KPICard'
import { PageHeader, RagChip } from '@/components/shared/terminal'
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
const DAYS = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom']

export default function PricingPage() {
  const [activeProject, setActiveProject] = useState<ProjectTab>('MAD')
  const [slots, setSlots] = useState<Slot[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [snapshotDate, setSnapshotDate] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setLoadError(false)
      const sb = createClient()
      const { data: latest, error: latestError } = await sb
        .from('fct_pricing_slot').select('snapshot_date')
        .eq('project_id', activeProject).order('snapshot_date', { ascending: false }).limit(1).maybeSingle()
      if (latestError) throw latestError
      if (!latest) { if (!cancelled) { setSlots([]); setSnapshotDate(null) } return }
      if (!cancelled) setSnapshotDate(latest.snapshot_date)
      const { data, error } = await sb
        .from('fct_pricing_slot')
        .select('*, dim_product(product_name, duration_min), dim_timeband(daypart, is_peak)')
        .eq('project_id', activeProject).eq('snapshot_date', latest.snapshot_date)
      if (error) throw error
      if (!cancelled) setSlots((data || []) as Slot[])
    }
    load()
      .catch((e) => { console.error(e); if (!cancelled) setLoadError(true) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [activeProject, reloadKey])

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
    const wk = `S+${Math.floor((d.getTime() - today.getTime()) / (7 * 86400000)) + 1}`
    const dow = (d.getDay() + 6) % 7
    if (!heatMap[wk]) heatMap[wk] = {}
    heatMap[wk][dow] = (heatMap[wk][dow] || 0) + (s.occupancy_pct || 0)
  }
  const heatWeeks = Object.keys(heatMap).sort()
  const hasFuture = heatWeeks.length > 0

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Precios y Ticketing · MIS"
        title="Precios y Ticketing"
        subtitle={
          snapshotDate
            ? `Snapshot: ${new Date(snapshotDate).toLocaleDateString('es-ES', { day:'2-digit', month:'short', year:'numeric' })}`
            : 'Precios de ingresos por producto y franja horaria'
        }
        right={
          <div className="flex gap-1 rounded-lg border border-slate-700 bg-slate-800 p-1">
            {(['MAD','BHX'] as const).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setActiveProject(t)}
                className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${activeProject === t ? 'bg-white text-slate-900' : 'text-slate-300 hover:bg-slate-700'}`}
              >
                {t === 'MAD' ? 'Madrid Playa Surf' : 'Birmingham'}
              </button>
            ))}
          </div>
        }
      />

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="space-y-2 text-center">
            <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
            <p className="font-mono text-xs text-slate-500">Cargando datos de precios…</p>
          </div>
        </div>
      ) : loadError ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center shadow-sm">
          <Tag className="h-10 w-10 mx-auto mb-3 text-slate-400" />
          <h3 className="text-base font-semibold text-slate-700 mb-1">No se pudo cargar</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto mb-4">
            La sesión pudo expirar. Inténtalo de nuevo o inicia sesión.
          </p>
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setReloadKey((k) => k + 1)}
              className="rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-slate-700"
            >
              Reintentar
            </button>
            <a
              href="/login"
              className="rounded-md border border-slate-200 px-4 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
            >
              Iniciar sesión
            </a>
          </div>
        </div>
      ) : slots.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center shadow-sm">
          <Tag className="h-10 w-10 mx-auto mb-3 text-slate-400" />
          <h3 className="text-base font-semibold text-slate-700 mb-1">Datos de precios aún no disponibles</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            {activeProject === 'MAD'
              ? 'Los precios estarán disponibles cuando arranque la operación (Q1 2027 para MAD). La estructura tarifaria está en diseño.'
              : 'Los precios estarán disponibles cuando Birmingham entre en planificación operativa.'}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KPICard title="Capacidad total" value={totalCapacity.toLocaleString('es-ES')} subtitle="Unidades en todos los slots" />
            <KPICard title="Unidades vendidas" value={totalSold.toLocaleString('es-ES')} subtitle={`${formatPercent(avgOcc)} ocupación`} />
            <KPICard title="Ocupación media" value={formatPercent(avgOcc)} subtitle="Vendido / Capacidad" rag={occRAG(avgOcc)} />
            <KPICard title="Ingresos brutos" value={formatCurrency(grossRev, ccy)} subtitle="Suma de todos los slots" />
          </div>

          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center gap-2">
              <h3 className="font-mono text-[11px] font-bold tracking-widest uppercase text-slate-500">Corredor de precios</h3>
              <span className="font-mono text-[10px] text-slate-400">Suelo · Base · Techo por producto y franja</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left">
                    {['Producto','Franja','Suelo','Base','Techo','Precio neto','Ocupación','Ingresos'].map((h, i) => (
                      <th key={h} className={`px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400 ${i >= 2 && i !== 6 ? 'text-right' : i === 6 ? 'text-center' : ''}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {corridorRows.map((row, i) => (
                    <tr key={i} className="border-b border-slate-100 odd:bg-slate-50/30 hover:bg-slate-50">
                      <td className="px-4 py-2.5 font-medium text-slate-900">
                        <span className="flex items-center gap-1.5">
                          {row.product_name}
                          {row.is_peak && <span className="rounded-[2px] bg-amber-100 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide text-amber-700">Pico</span>}
                          {row.waitlist_units > 0 && <span className="rounded-[2px] bg-blue-100 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide text-blue-700">Lista espera</span>}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-600 text-xs">{row.daypart}</td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-500 text-xs">{formatCurrency(row.floor_price, ccy)}</td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-700 text-xs">{formatCurrency(row.base_price, ccy)}</td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-500 text-xs">{formatCurrency(row.ceiling_price, ccy)}</td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums font-semibold text-slate-900 text-xs">{formatCurrency(row.net_price, ccy)}</td>
                      <td className="px-4 py-2.5 text-center"><RagChip status={occRAG(row.occupancy_pct)} label={formatPercent(row.occupancy_pct)} /></td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-xs font-medium text-slate-700">{formatCurrency(row.gross_revenue, ccy)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {hasFuture && (
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200"><h3 className="font-mono text-[11px] font-bold tracking-widest uppercase text-slate-500">Mapa de calor de ocupación — Próximas 4 semanas</h3></div>
              <div className="overflow-x-auto p-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left">
                      <th className="px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400 w-16">Semana</th>
                      {DAYS.map(d => <th key={d} className="px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400 text-center">{d}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {heatWeeks.map(wk => (
                      <tr key={wk} className="border-t border-slate-100">
                        <td className="px-3 py-2 font-mono text-xs font-medium text-slate-600">{wk}</td>
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
