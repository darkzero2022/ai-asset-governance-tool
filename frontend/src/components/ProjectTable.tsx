export function ProjectTable({ projects }: { projects: Array<{ id: string; name: string; status: string; _count?: { assetLinks: number; riskLinks: number } }> }) {
  return <div className="space-y-2">{projects.map((project) => <div key={project.id} className="rounded-lg border border-slate-200 p-3"><p className="font-semibold">{project.name}</p><p className="text-sm text-slate-500">{project.status} | {project._count?.assetLinks ?? 0} assets | {project._count?.riskLinks ?? 0} risks</p></div>)}</div>;
}
