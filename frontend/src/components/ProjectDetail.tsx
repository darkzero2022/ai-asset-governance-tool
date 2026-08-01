export function ProjectDetail({ project }: { project: { name: string; description?: string | null; businessOwner?: string | null } }) {
  return <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200"><h2 className="text-xl font-semibold">{project.name}</h2><p className="mt-2 text-sm text-slate-600">{project.description || "No description"}</p><p className="mt-2 text-sm font-medium">Owner: {project.businessOwner || "Unassigned"}</p></section>;
}
