'use client'
import { useState, useEffect, useMemo } from 'react'

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
        setFiles(m.files.map(f => ({ ...f, selected: f.relevance >= 75 && !f.isOlderVersion })))
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
        setQueueResult(`Queued ${data.queued} files for ingestion`)
        // Mark as queued in UI
        const selectedPaths = new Set(selected.map(f => f.relPath))
        setFiles(prev => prev.map(f =>
          selectedPaths.has(f.relPath) ? { ...f, status: 'queued', selected: false } : f
        ))
      } else {
        setQueueResult(`Error: ${data.error}`)
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Queue request failed'
      setQueueResult(`Error: ${message}`)
    } finally {
      setQueueing(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-500">
        Loading DMS manifest...
      </div>
    )
  }

  if (!manifest) {
    return (
      <div className="p-8 text-center text-slate-500">
        No manifest found. Run the DMS scanner first.
      </div>
    )
  }

  const s = manifest.summary

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex-none border-b bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Document Ingestion</h1>
            <p className="text-sm text-slate-500">
              Scanned {s.totalFiles} files — {s.byRelevance.high} high relevance — {s.versionGroups} version groups ({s.olderVersions} older versions)
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500">
              {selectedCount} selected ({(selectedSize / 1024 / 1024).toFixed(1)} MB)
            </span>
            <button
              onClick={queueSelected}
              disabled={selectedCount === 0 || queueing}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {queueing ? 'Queueing...' : `Queue ${selectedCount} for Ingestion`}
            </button>
          </div>
        </div>
        {queueResult && (
          <div className={`mt-2 text-sm px-3 py-2 rounded ${queueResult.startsWith('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
            {queueResult}
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="flex-none px-6 py-3 bg-slate-50 border-b grid grid-cols-6 gap-3">
        {Object.entries(s.byProject).map(([p, count]) => (
          <button key={p} onClick={() => setFilterProject(filterProject === p ? 'all' : p)}
            className={`text-center p-2 rounded-lg border text-sm ${filterProject === p ? 'bg-blue-100 border-blue-300' : 'bg-white border-slate-200 hover:bg-slate-100'}`}>
            <div className="font-semibold">{p}</div>
            <div className="text-slate-500">{count} files</div>
          </button>
        ))}
        {Object.entries(s.byType).map(([t, count]) => (
          <button key={t} onClick={() => setFilterType(filterType === t ? 'all' : t)}
            className={`text-center p-2 rounded-lg border text-sm ${filterType === t ? 'bg-blue-100 border-blue-300' : 'bg-white border-slate-200 hover:bg-slate-100'}`}>
            <div className="font-semibold">{t}</div>
            <div className="text-slate-500">{count}</div>
          </button>
        ))}
      </div>

      {/* Filters Bar */}
      <div className="flex-none px-6 py-3 border-b bg-white flex items-center gap-3 flex-wrap">
        <input
          type="text"
          placeholder="Search files..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="px-3 py-1.5 border rounded-lg text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
          className="px-3 py-1.5 border rounded-lg text-sm bg-white">
          <option value="all">All categories</option>
          {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select value={filterRelevance} onChange={e => setFilterRelevance(e.target.value)}
          className="px-3 py-1.5 border rounded-lg text-sm bg-white">
          <option value="all">All relevance</option>
          <option value="high">High (≥75)</option>
          <option value="medium">Medium (50-74)</option>
          <option value="low">Low (&lt;50)</option>
        </select>
        <select value={filterVersion} onChange={e => setFilterVersion(e.target.value)}
          className="px-3 py-1.5 border rounded-lg text-sm bg-white">
          <option value="all">All versions</option>
          <option value="latest">Latest only</option>
          <option value="older">Older versions</option>
        </select>
        <div className="flex-1" />
        <button onClick={() => selectAll(true)}
          className="text-xs text-blue-600 hover:text-blue-800">Select filtered</button>
        <button onClick={() => selectAll(false)}
          className="text-xs text-slate-500 hover:text-slate-700">Deselect filtered</button>
        <button onClick={selectHighRelevance}
          className="text-xs text-emerald-600 hover:text-emerald-800">Auto-select high</button>
      </div>

      {/* File List */}
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 sticky top-0">
            <tr className="text-left text-xs text-slate-500 uppercase">
              <th className="px-6 py-2 w-8">
                <input type="checkbox"
                  checked={filtered.length > 0 && filtered.every(f => f.selected)}
                  onChange={e => selectAll(e.target.checked)}
                  className="rounded" />
              </th>
              <th className="px-2 py-2 w-12">Score</th>
              <th className="px-2 py-2 w-12">Proj</th>
              <th className="px-2 py-2 w-32">Category</th>
              <th className="px-2 py-2">File</th>
              <th className="px-2 py-2 w-16 text-right">Size</th>
              <th className="px-2 py-2 w-20">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.slice(0, 200).map(f => (
              <tr key={f.relPath}
                className={`hover:bg-slate-50 ${f.isOlderVersion ? 'opacity-50' : ''} ${f.selected ? 'bg-blue-50' : ''}`}>
                <td className="px-6 py-2">
                  <input type="checkbox"
                    checked={f.selected || false}
                    onChange={() => toggleFile(f.relPath)}
                    className="rounded" />
                </td>
                <td className="px-2 py-2">
                  <span className={`inline-flex items-center justify-center w-8 h-5 rounded text-xs font-medium ${
                    f.relevance >= 75 ? 'bg-emerald-100 text-emerald-700' :
                    f.relevance >= 50 ? 'bg-amber-100 text-amber-700' :
                    f.relevance > 0 ? 'bg-slate-100 text-slate-500' :
                    'bg-red-100 text-red-500'
                  }`}>
                    {f.relevance}
                  </span>
                </td>
                <td className="px-2 py-2">
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                    f.project === 'MAD' ? 'bg-orange-100 text-orange-700' :
                    f.project === 'BHX' ? 'bg-purple-100 text-purple-700' :
                    'bg-slate-100 text-slate-600'
                  }`}>{f.project}</span>
                </td>
                <td className="px-2 py-2 text-xs text-slate-500">
                  {CATEGORY_LABELS[f.category] || f.category}
                </td>
                <td className="px-2 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono bg-slate-100 px-1 rounded">{f.ext}</span>
                    <span className="truncate max-w-md" title={f.relPath}>
                      {f.name}
                    </span>
                    {f.isLatestVersion && (
                      <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">
                        LATEST ({f.versionGroup?.length} ver)
                      </span>
                    )}
                    {f.isOlderVersion && (
                      <span className="text-[10px] bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded-full">
                        OLD → {f.supersededBy}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-2 py-2 text-right text-xs text-slate-500">
                  {f.size > 1048576 ? `${(f.size / 1048576).toFixed(1)}M` :
                   f.size > 1024 ? `${(f.size / 1024).toFixed(0)}K` :
                   `${f.size}B`}
                </td>
                <td className="px-2 py-2">
                  {f.status && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                      f.status === 'queued' ? 'bg-blue-100 text-blue-700' :
                      f.status === 'done' ? 'bg-green-100 text-green-700' :
                      f.status === 'error' ? 'bg-red-100 text-red-700' :
                      'bg-slate-100 text-slate-500'
                    }`}>{f.status}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length > 200 && (
          <div className="p-4 text-center text-sm text-slate-400">
            Showing 200 of {filtered.length} files. Use filters to narrow.
          </div>
        )}
      </div>
    </div>
  )
}
