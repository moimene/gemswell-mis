'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

type Project = { project_id: string; project_name: string; status_rag: string }

export function ProjectSelector({ 
  value, 
  onChange 
}: { 
  value?: string; 
  onChange: (projectId: string | undefined) => void 
}) {
  const [projects, setProjects] = useState<Project[]>([])

  useEffect(() => {
    const supabase = createClient()
    supabase.from('dim_project').select('project_id, project_name, status_rag')
      .eq('active', true)
      .then(({ data }) => setProjects(data || []))
  }, [])

  return (
    <select
      value={value || ''}
      onChange={e => onChange(e.target.value || undefined)}
      className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm"
    >
      <option value="">All Projects</option>
      {projects.map(p => (
        <option key={p.project_id} value={p.project_id}>{p.project_name}</option>
      ))}
    </select>
  )
}
