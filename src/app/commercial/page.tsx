'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { formatCurrency, formatCompact, formatPercent, type RAGColor } from '@/lib/utils'
import { KPICard } from '@/components/shared/KPICard'
import { PageHeader, RagChip } from '@/components/shared/terminal'
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
const fmtWeek = (d: string) => new Date(d).toLocaleDateString('es-ES', { day:'2-digit', month:'short', year:'2-digit' })

export default function CommercialPage() {
  const [activeProject, setActiveProject] = useState<ProjectTab>('MAD')
  const [rows, setRows] = useState<CommRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [latestWeek, setLatestWeek] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setLoadError(false)
      try {
        const sb = createClient()
        const { data: latest, error: latestErr } = await sb
          .from('fct_commercial').select('as_of_week_ending')
          .eq('project_id', activeProject).order('as_of_week_ending', { ascending: false }).limit(1).single()
        if (latestErr && latestErr.code !== 'PGRST116') throw latestErr
        if (cancelled) return
        if (!latest) { setRows([]); setLatestWeek(null); return }
        setLatestWeek(latest.as_of_week_ending)
        const since = new Date(latest.as_of_week_ending)
        since.setDate(since.getDate() - 55)
        const { data, error } = await sb
          .from('fct_commercial')
          .select('*, dim_channel(channel_name, channel_type)')
          .eq('project_id', activeProject)
          .gte('as_of_week_ending', since.toISOString().split('T')[0])
          .order('as_of_week_ending', { ascending: false })
        if (error) throw error
        if (cancelled) return
        setRows((data || []) as CommRow[])
      } catch (e) {
        if (cancelled) return
        console.error(e)
        setLoadError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [activeProject, reloadKey])

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
      <PageHeader
        band={false}
        eyebrow="Comercial · MIS"
        title="Comercial"
        subtitle={latestWeek ? `Semana hasta ${fmtWeek(latestWeek)} — rendimiento de canales y pipeline` : 'Reservas, pipeline y rendimiento de marketing'}
        right={
          <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1">
            {(['MAD','BHX'] as const).map(t => (
              <button key={t} type="button" onClick={() => setActiveProject(t)} className={TAB_CLS(activeProject === t)}>
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
            <p className="font-mono text-xs text-slate-500">Cargando datos comerciales...</p>
          </div>
        </div>
      ) : loadError ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center shadow-sm">
          <BarChart3 className="mx-auto mb-3 h-10 w-10 text-slate-400" />
          <h3 className="mb-1 text-base font-semibold text-slate-700">No se pudo cargar</h3>
          <p className="mx-auto mb-4 max-w-md text-sm text-slate-500">
            La sesión pudo expirar. Reintenta o inicia sesión.
          </p>
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setReloadKey(k => k + 1)}
              className="rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
            >
              Reintentar
            </button>
            <a href="/login" className="rounded-md border border-slate-200 px-4 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100">
              Iniciar sesión
            </a>
          </div>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center shadow-sm">
          <BarChart3 className="mx-auto mb-3 h-10 w-10 text-slate-400" />
          <h3 className="mb-1 text-base font-semibold text-slate-700">Seguimiento comercial aún no activo</h3>
          <p className="mx-auto max-w-md text-sm text-slate-500">
            El seguimiento comercial se activará desde 12 meses antes de la apertura. El rendimiento de
            canales, el pipeline de reservas y el ROI de marketing aparecerán aquí cuando comience la preventa.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KPICard title="Reservas totales" value={kpi.reservations.toLocaleString('es-ES')} subtitle="Última semana, todos los canales" />
            <KPICard title="Ingresos confirmados" value={formatCompact(kpi.revenue, ccy)} subtitle="Ingresos confirmados" rag={kpi.revenue > 0 ? 'Green' : 'Grey'} />
            <KPICard title="Depósitos totales" value={formatCompact(kpi.deposits, ccy)} subtitle="Depósitos cobrados" />
            <KPICard
              title="Inversión en marketing"
              value={formatCompact(kpi.spend, ccy)}
              subtitle={kpi.spend > 0 ? `ROAS ${overallRoas.toFixed(1)}x` : 'En todos los canales'}
              rag={kpi.spend > 0 ? roasRAG(overallRoas) : undefined}
            />
          </div>

          {/* Rendimiento por canal */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-4"><h3 className="font-mono text-[11px] font-bold uppercase tracking-widest text-slate-500">Rendimiento por canal</h3></div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left">
                    {['Canal','Tipo','Leads','Conv.%','Reservas','Ingresos','Inversión','ROAS'].map((h, i) => (
                      <th key={h} className={`px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400 ${[2,4,5,6].includes(i) ? 'text-right' : [3,7].includes(i) ? 'text-center' : ''}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {channelRows.map(ch => {
                    const convPct = ch.leads > 0 ? (ch.qualified_leads / ch.leads) * 100 : 0
                    const roas = ch.marketing_spend > 0 ? ch.revenue_booked / ch.marketing_spend : 0
                    return (
                      <tr key={ch.channel_id} className="border-b border-slate-200 odd:bg-slate-50/30 hover:bg-slate-50">
                        <td className="px-4 py-2.5 font-medium text-slate-900">{ch.channel_name}</td>
                        <td className="px-4 py-2.5">
                          <span className="inline-flex rounded-[2px] bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide text-slate-600">{ch.channel_type}</span>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-xs tabular-nums">{ch.leads.toLocaleString('es-ES')}</td>
                        <td className="px-4 py-2.5 text-center"><RagChip status={convRAG(convPct)} label={formatPercent(convPct)} /></td>
                        <td className="px-4 py-2.5 text-right font-mono text-xs tabular-nums">{ch.reservations.toLocaleString('es-ES')}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-xs font-medium tabular-nums">{formatCurrency(ch.revenue_booked, ccy)}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-xs tabular-nums text-slate-600">{ch.marketing_spend > 0 ? formatCompact(ch.marketing_spend, ccy) : '—'}</td>
                        <td className="px-4 py-2.5 text-center">
                          {ch.marketing_spend > 0
                            ? <RagChip status={roasRAG(roas)} label={`${roas.toFixed(1)}x`} />
                            : <span className="font-mono text-xs text-slate-400">—</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Tendencia semanal */}
          {weekRows.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-6 py-4"><h3 className="font-mono text-[11px] font-bold uppercase tracking-widest text-slate-500">Tendencia semanal — Últimas 8 semanas</h3></div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-left">
                      {['Semana','Reservas','Ingresos','Depósitos','Inversión'].map((h, i) => (
                        <th key={h} className={`px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400 ${i > 0 ? 'text-right' : ''}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {weekRows.map((w, i) => (
                      <tr key={w.week_ending} className={`border-b border-slate-200 hover:bg-slate-50 ${i === 0 ? 'bg-slate-50' : 'odd:bg-slate-50/30'}`}>
                        <td className="px-4 py-2.5 font-mono text-xs text-slate-600">
                          {fmtWeek(w.week_ending)}
                          {i === 0 && <span className="ml-2 rounded-[2px] bg-slate-200 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide text-slate-600">Última</span>}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-xs tabular-nums">{w.reservations.toLocaleString('es-ES')}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-xs tabular-nums">{formatCompact(w.revenue, ccy)}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-xs tabular-nums">{formatCompact(w.deposits, ccy)}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-xs tabular-nums text-slate-600">{w.spend > 0 ? formatCompact(w.spend, ccy) : '—'}</td>
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
