import { FormEvent, type ReactNode } from "react";
import { ModelCardForm, type ModelCard, type ModelCardCompleteness, type ModelCardFormState } from "../components/ModelCardForm";
import { ApprovalBanner } from "../components/ApprovalBanner";
import { DependencyGraph } from "../components/DependencyGraph";

type Asset = {
  id: string;
  name: string;
  version: string;
  type: string;
  supplier: string;
  provider?: string | null;
  hostingModel: string;
  networkDependency: string;
  license?: string | null;
  dataClassificationTouched?: string | null;
  trainingDataProvenance?: string | null;
  downstreamConsumers?: string | null;
  status: string;
  updatedAt: string;
  _count?: { risks: number };
};

type Risk = {
  id: string;
  assetId: string;
  description: string;
  sourceFramework: string;
  sourceCategoryId: string;
  inherentRiskScore: number;
  status: string;
};

type Project = {
  id: string;
  name: string;
  status: string;
  businessOwner?: string | null;
};

type WorkflowEntry = {
  id: string;
  fromStatus: string;
  toStatus: string;
  comments?: string | null;
  timestamp: string;
  approvedBy: { name: string; email: string };
};

type AssetDetailData = Asset & {
  risks: Risk[];
  workflow: WorkflowEntry[];
  parentDependencies?: Array<{ childAsset: { id: string; name: string; type: string } }>;
  childDependencies?: Array<{ parentAsset: { id: string; name: string; type: string } }>;
};

type AssetForm = {
  name: string;
  version: string;
  type: string;
  supplier: string;
  provider: string;
  hostingModel: string;
  networkDependency: string;
  license: string;
  dataClassificationTouched: string;
  trainingDataProvenance: string;
  downstreamConsumers: string;
};

type Props = {
  asset: AssetDetailData | null;
  assetForm: AssetForm;
  modelCard: ModelCard | null;
  modelCardCompleteness?: ModelCardCompleteness;
  modelCardForm: ModelCardFormState;
  editingAssetId: string | null;
  risks: Risk[];
  projects: Project[];
  linkedProjects: Project[];
  selectedRiskId: string;
  selectedProjectId: string;
  workflowComments: string;
  label: (value: string) => string;
  nextStatuses: Record<string, string[]>;
  onBack: () => void;
  onEditAsset: (asset: Asset) => void;
  onFormChange: (form: AssetForm) => void;
  onSaveAsset: (event: FormEvent) => void;
  onModelCardFormChange: (form: ModelCardFormState) => void;
  onSaveModelCard: (event: FormEvent) => void;
  onSelectedRiskChange: (id: string) => void;
  onSelectedProjectChange: (id: string) => void;
  onLinkRisk: () => void;
  onUnlinkRisk: (riskId: string) => void;
  onLinkProject: () => void;
  onUnlinkProject: (projectId: string) => void;
  onWorkflowCommentsChange: (comments: string) => void;
  onTransitionAsset: (status: string) => void;
};

export default function AssetDetail(props: Props) {
  if (!props.asset) {
    return (
      <section className="mx-auto max-w-7xl px-6 py-8">
        <button className="text-sm font-semibold text-cyan-700" onClick={props.onBack}>Back to assets</button>
        <div className="mt-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">Loading asset...</div>
      </section>
    );
  }

  const asset = props.asset;
  const linkedRiskIds = new Set(props.asset.risks.map((risk) => risk.id));
  const linkedProjectIds = new Set(props.linkedProjects.map((project) => project.id));
  const availableRisks = props.risks.filter((risk) => !linkedRiskIds.has(risk.id));
  const availableProjects = props.projects.filter((project) => !linkedProjectIds.has(project.id));
  const isEditing = props.editingAssetId === props.asset.id;

  return (
    <section className="mx-auto grid max-w-7xl gap-6 px-6 py-8 xl:grid-cols-[1.1fr_0.9fr]">
      <div className="space-y-6">
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <button className="text-sm font-semibold text-cyan-700" onClick={props.onBack}>Back to assets</button>
          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold">{props.asset.name}</h2>
              <p className="text-sm text-slate-500">v{props.asset.version} | {props.label(props.asset.status)} | {props.label(props.asset.type)}</p>
            </div>
            <button className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold" onClick={() => props.onEditAsset(asset)}>Edit asset</button>
          </div>

          <dl className="mt-5 grid gap-3 text-sm md:grid-cols-2">
            <Info label="Supplier" value={props.asset.supplier} />
            <Info label="Provider" value={props.asset.provider} />
            <Info label="Hosting Model" value={props.label(props.asset.hostingModel)} />
            <Info label="Network Dependency" value={props.label(props.asset.networkDependency)} />
            <Info label="License" value={props.asset.license} />
            <Info label="Data Classification" value={props.asset.dataClassificationTouched} />
            <Info label="Training Data" value={props.asset.trainingDataProvenance} />
            <Info label="Downstream Consumers" value={props.asset.downstreamConsumers} />
          </dl>
        </div>

        {isEditing && (
          <form onSubmit={props.onSaveAsset} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h3 className="text-lg font-semibold">Edit Asset Fields</h3>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field label="Name" value={props.assetForm.name} onChange={(value) => props.onFormChange({ ...props.assetForm, name: value })} />
              <Field label="Version" value={props.assetForm.version} onChange={(value) => props.onFormChange({ ...props.assetForm, version: value })} />
              <Select label="Type" value={props.assetForm.type} options={["MODEL", "DATASET", "SERVICE", "LIBRARY"]} onChange={(value) => props.onFormChange({ ...props.assetForm, type: value })} labelValue={props.label} />
              <Select label="Hosting Model" value={props.assetForm.hostingModel} options={["SAAS_API", "SELF_HOSTED", "EMBEDDED_IN_APP"]} onChange={(value) => props.onFormChange({ ...props.assetForm, hostingModel: value })} labelValue={props.label} />
              <Select label="Network Dependency" value={props.assetForm.networkDependency} options={["AIR_GAPPED", "HYBRID", "FULLY_CONNECTED"]} onChange={(value) => props.onFormChange({ ...props.assetForm, networkDependency: value })} labelValue={props.label} />
              <Field label="Supplier" value={props.assetForm.supplier} onChange={(value) => props.onFormChange({ ...props.assetForm, supplier: value })} />
              <Field label="Provider" value={props.assetForm.provider ?? ""} onChange={(value) => props.onFormChange({ ...props.assetForm, provider: value })} />
              <Field label="License" value={props.assetForm.license ?? ""} onChange={(value) => props.onFormChange({ ...props.assetForm, license: value })} />
              <Field label="Data Classification" value={props.assetForm.dataClassificationTouched ?? ""} onChange={(value) => props.onFormChange({ ...props.assetForm, dataClassificationTouched: value })} />
              <TextArea label="Training Data Provenance" value={props.assetForm.trainingDataProvenance ?? ""} onChange={(value) => props.onFormChange({ ...props.assetForm, trainingDataProvenance: value })} />
              <TextArea label="Downstream Consumers" value={props.assetForm.downstreamConsumers ?? ""} onChange={(value) => props.onFormChange({ ...props.assetForm, downstreamConsumers: value })} />
            </div>
            <button className="mt-5 rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Save asset</button>
          </form>
        )}

        <ApprovalBanner risks={props.asset.risks} assetType={props.asset.type} modelCard={props.modelCard} modelCardCompleteness={props.modelCardCompleteness} />
        {(props.asset.type === "MODEL" || props.asset.type === "SERVICE") && <ModelCardForm modelCard={props.modelCard} completeness={props.modelCardCompleteness} form={props.modelCardForm} onFormChange={props.onModelCardFormChange} onSubmit={props.onSaveModelCard} />}
        <DependencyGraph asset={props.asset} />
      </div>

      <aside className="space-y-6">
        <Panel title="Linked Risks">
          <div className="flex gap-2">
            <select className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" value={props.selectedRiskId} onChange={(event) => props.onSelectedRiskChange(event.target.value)}>
              <option value="">Select risk</option>
              {availableRisks.map((risk) => <option key={risk.id} value={risk.id}>{risk.description}</option>)}
            </select>
            <button className="rounded-lg bg-slate-950 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40" disabled={!props.selectedRiskId} onClick={props.onLinkRisk}>Link</button>
          </div>
          <div className="mt-4 space-y-3">
            {props.asset.risks.map((risk) => (
              <div key={risk.id} className="rounded-xl border border-slate-200 p-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{risk.description}</p>
                    <p className="text-slate-500">{props.label(risk.status)} | Score {risk.inherentRiskScore}</p>
                  </div>
                  <button className="text-xs font-semibold text-red-600" onClick={() => props.onUnlinkRisk(risk.id)}>Unlink</button>
                </div>
              </div>
            ))}
            {!props.asset.risks.length && <p className="text-sm text-slate-500">No linked risks.</p>}
          </div>
        </Panel>

        <Panel title="Linked Projects">
          <div className="flex gap-2">
            <select className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" value={props.selectedProjectId} onChange={(event) => props.onSelectedProjectChange(event.target.value)}>
              <option value="">Select project</option>
              {availableProjects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
            <button className="rounded-lg bg-slate-950 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40" disabled={!props.selectedProjectId} onClick={props.onLinkProject}>Link</button>
          </div>
          <div className="mt-4 space-y-3">
            {props.linkedProjects.map((project) => (
              <div key={project.id} className="rounded-xl border border-slate-200 p-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{project.name}</p>
                    <p className="text-slate-500">{props.label(project.status)}{project.businessOwner ? ` | ${project.businessOwner}` : ""}</p>
                  </div>
                  <button className="text-xs font-semibold text-red-600" onClick={() => props.onUnlinkProject(project.id)}>Unlink</button>
                </div>
              </div>
            ))}
            {!props.linkedProjects.length && <p className="text-sm text-slate-500">No linked projects.</p>}
          </div>
        </Panel>

        <Panel title="Governance Workflow">
          <textarea className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Approval comments" value={props.workflowComments} onChange={(event) => props.onWorkflowCommentsChange(event.target.value)} />
          <div className="mt-3 flex flex-wrap gap-2">
            {(props.nextStatuses[props.asset.status] ?? []).map((status) => (
              <button key={status} className="rounded-lg bg-slate-950 px-3 py-2 text-sm font-semibold text-white" onClick={() => props.onTransitionAsset(status)}>
                Move to {props.label(status)}
              </button>
            ))}
            {(props.nextStatuses[props.asset.status] ?? []).length === 0 && <p className="text-sm text-slate-500">No further transitions available.</p>}
          </div>
          <div className="mt-4 space-y-3">
            {props.asset.workflow.map((entry) => (
              <div key={entry.id} className="border-t border-slate-200 pt-3 text-sm">
                <p className="font-medium">{props.label(entry.fromStatus)} to {props.label(entry.toStatus)}</p>
                <p className="text-slate-500">{entry.approvedBy.name} on {new Date(entry.timestamp).toLocaleString()}</p>
                {entry.comments && <p className="mt-1 text-slate-600">{entry.comments}</p>}
              </div>
            ))}
          </div>
        </Panel>
      </aside>
    </section>
  );
}

function Info(props: { label: string; value?: string | null }) {
  return <div><dt className="font-semibold">{props.label}</dt><dd className="text-slate-600">{props.value || "Not set"}</dd></div>;
}

function Panel(props: { title: string; children: ReactNode }) {
  return <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200"><h3 className="text-lg font-semibold">{props.title}</h3><div className="mt-4">{props.children}</div></div>;
}

function Field(props: { label: string; value: string; type?: string; onChange: (value: string) => void }) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {props.label}
      <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950" type={props.type ?? "text"} value={props.value} onChange={(event) => props.onChange(event.target.value)} />
    </label>
  );
}

function TextArea(props: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {props.label}
      <textarea className="mt-1 min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950" value={props.value} onChange={(event) => props.onChange(event.target.value)} />
    </label>
  );
}

function Select(props: { label: string; value: string; options: string[]; onChange: (value: string) => void; labelValue: (value: string) => string }) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {props.label}
      <select className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950" value={props.value} onChange={(event) => props.onChange(event.target.value)}>
        {props.options.map((option) => <option key={option} value={option}>{props.labelValue(option)}</option>)}
      </select>
    </label>
  );
}
