export default function ProjectPage({ params }: { params: { projectId: string } }) {
  return <div className="space-y-4"><h1 className="text-2xl font-bold">Project {params.projectId}</h1><p className="text-slate-500">Coming soon — migrating from Lovable mockup</p></div>
}
