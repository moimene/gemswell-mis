'use client'
import { useState, useEffect, useMemo } from 'react'
import { projectAccent } from '@/components/shared/terminal'

type DmsFile = {
  name: string
  ext: string
  relPath: string
  size: number
  modified: string
  project: string
  category: string
  relevance: number
  isLatestVersion?: boolean
  isOlderVersion?: boolean
  supersededBy?: string
  versionGroup?: string[]
  // UI state
  selected?: boolean
  status?: string
}

type Manifest = {
  scannedAt: string
  summary: {
    totalFiles: number
    byProject: Record<string, number>
    byCategory: Record<string, number>
    byType: Record<string, number>
    byRelevance: { high: number; medium: number; low: number; skip: number }
    versionGroups: number
    olderVersions: number
  }
  files: DmsFile[]
}

const CATEGORY_LABELS: Record<string, string> = {
  bp_model: 'BP Model',
  bp_underwriting: 'BP Underwriting',
  monthly_reporting: 'Monthly Reporting',
  cash_flow: 'Cash Flow',
  capital_structure: 'Capital Structure',
  annual_accounts: 'Annual Accounts',
  financing: 'Financing',
  due_diligence: 'Due Diligence',
  legal: 'Legal',
  asset_management: 'Asset Management',
  bank_statements: 'Bank Statements',
  sponsor: 'Sponsor',
  board: 'Board',
  coordination: 'Coordination',
  advisors: 'Advisors',
  marketing: 'Marketing',
  people_ops: 'People & Ops',
  retail: 'Retail',
  other: 'Other',
}

export default function IngestPage() {
  const [manifest, setManifest] = useState<Manifest | null>(null)
  const [files, setFiles] = useState<DmsFile[]>([])
  const [loading, setLoading] = useState(true)
  const [queueing, setQueueing] = useState(false)
  const [queueResult, setQueueResult] = useState<string | null>(null)

  // Filters
  const [filterProject, setFilterProject] = useState<string>('all')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [filterType, setFilterType] = useState<string>('all')
  const [filterRelevance, setFilterRelevance] = useState<string>('all')
  const [filterVersion, setFilterVersion] = useState<string>('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch('/dms-manifest.json')
      .then(r => r.json())
      .then((m: Manifest) => {
        setManifest(m)
        // Default to NOTHING selected — queueing inserts real ingest jobs; a stray click must not
        // enqueue hundreds of files. Use "Auto-seleccionar alta" to opt into the relevance>=75 set.
        setFiles(m.files.map(f => ({ ...f, selected: false })))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    return files.filter(f => {
      if (filterProject !== 'all' && f.project !== filterProject) return false
      if (filterCategory !== 'all' && f.category !== filterCategory) return false
      if (filterType !== 'all' && f.ext !== filterType) return false
      if (filterRelevance === 'high' && f.relevance < 75) return false
      if (filterRelevance === 'medium' && (f.relevance < 50 || f.relevance >= 75)) return false
      if (filterRelevance === 'low' && f.relevance >= 50) return false
      if (filterVersion === 'latest' && f.isOlderVersion) return false
      if (filterVersion === 'older' && !f.isOlderVersion) return false
      if (search && !f.name.toLowerCase().includes(search.toLowerCase()) &&
          !f.relPath.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [files, filterProject, filterCategory, filterType, filterRelevance, filterVersion, search])

  const selectedCount = files.filter(f => f.selected).length
  const selectedSize = files.filter(f => f.selected).reduce((s, f) => s + f.size, 0)

  function toggleFile(relPath: string) {
    setFiles(prev => prev.map(f =>
      f.relPath === relPath ? { ...f, selected: !f.selected } : f
    ))
  }

  function selectAll(select: boolean) {
    const filteredPaths = new Set(filtered.map(f => f.relPath))
    setFiles(prev => prev.map(f =>
      filteredPaths.has(f.relPath) ? { ...f, selected: select } : f
    ))
  }

  function selectHighRelevance() {
    setFiles(prev => prev.map(f => ({
      ...f,
      selected: f.relevance >= 75 && !f.isOlderVersion
    })))
  }

  async function queueSelected() {
    const selected = files.filter(f => f.selected)
    if (selected.length === 0) return
    if (!window.confirm(`¿Encolar ${selected.length} archivo(s) para ingesta? Esto crea trabajos de procesamiento reales.`)) return

    setQueueing(true)
    setQueueResult(null)

    try {
      const res = await fetch('/api/ingest/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: selected.map(f => ({
            relPath: f.relPath,
            fileName: f.name,
            fileExt: f.ext,
            fileSize: f.size,
            projectId: f.project,
            category: f.category,
            relevance: f.relevance,
          }))
        })
      })
      const data = await res.json()
      if (res.ok) {
        setQueueResult(`${data.queued} archivo(s) encolado(s) para ingesta`)
        // Mark as queued in UI
        const selectedPaths = new Set(selected.map(f => f.relPath))
        setFiles(prev => prev.map(f =>
          selectedPaths.has(f.relPath) ? { ...f, status: 'queued', selected: false } : f
        ))
      } else {
        setQueueResult(`Error: ${data.error}`)
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Fallo al encolar la solicitud'
      setQueueResult(`Error: ${message}`)
    } finally {
      setQueueing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] flex-col items-center justify-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
        <p className="font-mono text-xs text-slate-400">Cargando manifiesto DMS…</p>
      </div>
    )
  }

  if (!manifest) {
    return (
      <div className="flex h-[calc(100vh-4rem)] flex-col items-center justify-center p-8">
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-8 py-10 text-center shadow-sm">
          <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">Sin manifiesto</p>
          <p className="mt-2 text-sm text-slate-600">No se encontró el manifiesto DMS. Ejecuta primero el escáner.</p>
          <code className="mt-3 inline-block rounded bg-slate-100 px-2 py-1 font-mono text-xs text-slate-600">npm run dms:scan</code>
        </div>
      </div>
    )
  }

  const s = manifest.summary

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex-none border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Gemswell Ventures · MIS</p>
            <h1 className="mt-0.5 text-xl font-bold tracking-tight text-slate-900">Ingesta de Documentos</h1>
            <p className="mt-0.5 font-mono text-[11px] text-slate-500">
              {s.totalFiles} archivos escaneados — {s.byRelevance.high} de alta relevancia — {s.versionGroups} grupos de versión ({s.olderVersions} versiones antiguas)
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs tabular-nums text-slate-500">
              {selectedCount} seleccionados ({(selectedSize / 1024 / 1024).toFixed(1)} MB)
            </span>
            <button
              onClick={queueSelected}
              disabled={selectedCount === 0 || queueing}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {queueing ? 'Encolando…' : `Encolar ${selectedCount} para ingesta`}
            </button>
          </div>
        </div>
        {queueResult && (
          <div className={`mt-2 rounded px-3 py-2 text-sm ${queueResult.startsWith('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
            {queueResult}
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="flex-none border-b border-slate-200 bg-slate-50 px-6 py-3">
        <div className="flex flex-wrap items-start gap-x-8 gap-y-3">
          <div className="min-w-0">
            <p className="mb-1.5 font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">Por proyecto</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {Object.entries(s.byProject).map(([p, count]) => {
                const active = filterProject === p
                return (
                  <button key={p} onClick={() => setFilterProject(active ? 'all' : p)}
                    className={`min-w-[5rem] rounded-lg border bg-white p-2 text-center text-sm transition-colors hover:bg-slate-100 ${active ? 'border-slate-400 ring-2 ring-slate-300' : 'border-slate-200'}`}>
                    <div className="font-mono text-xs font-bold" style={{ color: projectAccent(p) }}>{p}</div>
                    <div className="font-mono text-[11px] tabular-nums text-slate-500">{count} archivos</div>
                  </button>
                )
              })}
            </div>
          </div>
          <div className="min-w-0">
            <p className="mb-1.5 font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">Por tipo</p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
              {Object.entries(s.byType).map(([t, count]) => {
                const active = filterType === t
                return (
                  <button key={t} onClick={() => setFilterType(active ? 'all' : t)}
                    className={`min-w-[4rem] rounded-lg border bg-white p-2 text-center text-sm transition-colors hover:bg-slate-100 ${active ? 'border-slate-400 ring-2 ring-slate-300' : 'border-slate-200'}`}>
                    <div className="font-mono text-xs font-bold text-slate-700">{t}</div>
                    <div className="font-mono text-[11px] tabular-nums text-slate-500">{count}</div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-none flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-6 py-3">
        <input
          type="text"
          placeholder="Buscar archivos…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-64 rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
        />
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400">
          <option value="all">Todas las categorías</option>
          {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select value={filterRelevance} onChange={e => setFilterRelevance(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400">
          <option value="all">Todas las relevancias</option>
          <option value="high">Alta (≥75)</option>
          <option value="medium">Media (50-74)</option>
          <option value="low">Baja (&lt;50)</option>
        </select>
        <select value={filterVersion} onChange={e => setFilterVersion(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400">
          <option value="all">Todas las versiones</option>
          <option value="latest">Solo última</option>
          <option value="older">Versiones antiguas</option>
        </select>
        <div className="flex-1" />
        <div className="inline-flex items-center overflow-hidden rounded-lg border border-slate-200">
          <button onClick={() => selectAll(true)}
            className="border-r border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50">Seleccionar filtrados</button>
          <button onClick={() => selectAll(false)}
            className="border-r border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50">Quitar selección</button>
          <button onClick={selectHighRelevance}
            className="px-2.5 py-1 text-xs font-medium text-[#166534] hover:bg-slate-50">Auto-seleccionar alta</button>
        </div>
      </div>

      {/* File List */}
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-slate-50">
            <tr className="text-left font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">
              <th className="w-8 px-6 py-2">
                <input type="checkbox"
                  checked={filtered.length > 0 && filtered.every(f => f.selected)}
                  onChange={e => selectAll(e.target.checked)}
                  className="rounded" />
              </th>
              <th className="w-12 px-2 py-2">Score</th>
              <th className="w-12 px-2 py-2">Proy</th>
              <th className="w-32 px-2 py-2">Categoría</th>
              <th className="px-2 py-2">Archivo</th>
              <th className="w-16 px-2 py-2 text-right">Tamaño</th>
              <th className="w-20 px-2 py-2">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.slice(0, 200).map(f => (
              <tr key={f.relPath}
                className={`odd:bg-slate-50/30 hover:bg-slate-50 ${f.isOlderVersion ? 'opacity-50' : ''} ${f.selected ? 'bg-blue-50' : ''}`}>
                <td className="px-6 py-2">
                  <input type="checkbox"
                    checked={f.selected || false}
                    onChange={() => toggleFile(f.relPath)}
                    className="rounded" />
                </td>
                <td className="px-2 py-2">
                  <span className={`inline-flex h-5 w-8 items-center justify-center rounded font-mono text-xs font-bold tabular-nums ${
                    f.relevance >= 75 ? 'bg-emerald-100 text-emerald-700' :
                    f.relevance >= 50 ? 'bg-amber-100 text-amber-700' :
                    f.relevance > 0 ? 'bg-slate-100 text-slate-500' :
                    'bg-red-100 text-red-500'
                  }`}>
                    {f.relevance}
                  </span>
                </td>
                <td className="px-2 py-2">
                  <span
                    className="rounded px-1.5 py-0.5 font-mono text-[10px] font-bold"
                    style={{ color: projectAccent(f.project), backgroundColor: `${projectAccent(f.project)}1A` }}
                  >{f.project}</span>
                </td>
                <td className="px-2 py-2 text-xs text-slate-500">
                  {CATEGORY_LABELS[f.category] || f.category}
                </td>
                <td className="px-2 py-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-slate-100 px-1 font-mono text-xs text-slate-600">{f.ext}</span>
                    <span className="max-w-md truncate" title={f.relPath}>
                      {f.name}
                    </span>
                    {f.isLatestVersion && (
                      <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-mono text-xs font-bold text-emerald-700">
                        ÚLTIMA ({f.versionGroup?.length})
                      </span>
                    )}
                    {f.isOlderVersion && (
                      <span className="rounded bg-slate-200 px-1.5 py-0.5 font-mono text-xs font-bold text-slate-500">
                        ANTIGUA → {f.supersededBy}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-2 py-2 text-right font-mono text-xs tabular-nums text-slate-500">
                  {f.size > 1048576 ? `${(f.size / 1048576).toFixed(1)}M` :
                   f.size > 1024 ? `${(f.size / 1024).toFixed(0)}K` :
                   `${f.size}B`}
                </td>
                <td className="px-2 py-2">
                  {f.status && (
                    <span className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide ${
                      f.status === 'queued' ? 'bg-blue-100 text-blue-700' :
                      f.status === 'done' ? 'bg-green-100 text-green-700' :
                      f.status === 'error' ? 'bg-red-100 text-red-700' :
                      'bg-slate-100 text-slate-500'
                    }`}>{
                      f.status === 'queued' ? 'Encolado' :
                      f.status === 'done' ? 'Listo' :
                      f.status === 'error' ? 'Error' :
                      f.status
                    }</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length > 200 && (
          <div className="p-4 text-center font-mono text-xs text-slate-400">
            Mostrando 200 de {filtered.length} archivos. Usa los filtros para acotar.
          </div>
        )}
      </div>
    </div>
  )
}
