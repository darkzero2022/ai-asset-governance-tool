import { FormEvent } from "react";

type Project = {
  id: string;
  name: string;
  description?: string | null;
  businessOwner?: string | null;
  status: string;
  _count?: { assetLinks?: number; riskLinks?: number };
};

type ProjectForm = {
  name: string;
  description: string;
  businessOwner: string;
  status: string;
};

type Props = {
  projects: Project[];
  projectForm: ProjectForm;
  editingProjectId: string | null;
  label: (value: string) => string;
  onFormChange: (form: ProjectForm) => void;
  onSubmit: (event: FormEvent) => void;
  onNewProject: () => void;
  onOpenProject: (id: string) => void;
  onEditProject: (project: Project) => void;
};

export default function ProjectList(props: Props) {
  const updateForm = (key: keyof ProjectForm, value: string) => props.onFormChange({ ...props.projectForm, [key]: value });

  return (
    <section className="mx-auto grid max-w-7xl gap-6 px-6 py-8 xl:grid-cols-[1.2fr_0.8fr]">
      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Projects</h2>
            <p className="text-sm text-slate-500">Manage business AI use cases and their linked assets and risks.</p>
          </div>
          <button className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold" onClick={props.onNewProject}>New project</button>
        </div>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="py-3">Name</th><th>Status</th><th>Owner</th><th>Assets</th><th>Risks</th><th /></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {props.projects.map((project) => (
                <tr key={project.id}>
                  <td className="py-4"><button className="font-medium hover:text-cyan-700" onClick={() => props.onOpenProject(project.id)}>{project.name}</button><span className="block text-xs text-slate-500">{project.description || "No description"}</span></td>
                  <td>{props.label(project.status)}</td>
                  <td>{project.businessOwner || "Unassigned"}</td>
                  <td>{project._count?.assetLinks ?? 0}</td>
                  <td>{project._count?.riskLinks ?? 0}</td>
                  <td className="text-right"><button className="font-semibold text-slate-700" onClick={() => props.onEditProject(project)}>Edit</button></td>
                </tr>
              ))}
              {!props.projects.length && <tr><td className="py-8 text-center text-slate-500" colSpan={6}>No projects yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <form onSubmit={props.onSubmit} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-xl font-semibold">{props.editingProjectId ? "Edit Project" : "New Project"}</h2>
        <div className="mt-4 grid gap-4">
          <Field label="Name" value={props.projectForm.name} onChange={(value) => updateForm("name", value)} />
          <Field label="Business Owner" value={props.projectForm.businessOwner} onChange={(value) => updateForm("businessOwner", value)} />
          <label className="block text-sm font-medium text-slate-700">
            Status
            <select className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950" value={props.projectForm.status} onChange={(event) => updateForm("status", event.target.value)}>
              {[
                "ACTIVE",
                "INACTIVE",
                "RETIRED",
              ].map((status) => <option key={status} value={status}>{props.label(status)}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Description
            <textarea className="mt-1 min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950" value={props.projectForm.description} onChange={(event) => updateForm("description", event.target.value)} />
          </label>
        </div>
        <button className="mt-5 rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white">{props.editingProjectId ? "Save project" : "Create project"}</button>
      </form>
    </section>
  );
}

function Field(props: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {props.label}
      <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950" value={props.value} onChange={(event) => props.onChange(event.target.value)} />
    </label>
  );
}
