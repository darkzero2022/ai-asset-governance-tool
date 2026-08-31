import { useState, type ReactNode } from "react";

type Asset = { id: string; name: string };
type Project = { id: string; name: string; status: string };
type Control = { id: string; name: string; mappedFramework: string; mappedControlId: string; description?: string | null };
type RiskControl = Control & { implementationStatus?: string; evidenceNotes?: string | null };

type RiskDetailData = {
  id: string;
  description: string;
  sourceFramework: string;
  sourceCategoryId: string;
  euAiActRiskTier?: string | null;
  strideAiCategory?: string | null;
  atlasTechnique?: string | null;
  likelihood: number;
  impact: number;
  inherentRiskScore: number;
  residualRiskScore?: number | null;
  severity?: string | null;
  treatmentPlan?: string | null;
  owner?: string | null;
  dueDate?: string | null;
  status: string;
  assets?: Array<{ assetId: string; asset: Asset }>;
  projects?: Array<{ projectId: string; project: Project }>;
  controls?: RiskControl[];
};

type AuditLog = {
  id: string;
  action: string;
  timestamp: string;
  actor?: { name: string; email: string };
};

type Props = {
  risk: RiskDetailData | null;
  assets: Asset[];
  projects: Project[];
  controls: Control[];
  auditLogs: AuditLog[];
  selectedAssetId: string;
  selectedProjectId: string;
  selectedControlId: string;
  selectedControlStatus: string;
  label: (value: string) => string;
  onBack: () => void;
  onSelectedAssetChange: (id: string) => void;
  onSelectedProjectChange: (id: string) => void;
  onSelectedControlChange: (id: string) => void;
  onSelectedControlStatusChange: (status: string) => void;
  onLinkAsset: () => void;
  onUnlinkAsset: (assetId: string) => void;
  onLinkProject: () => void;
  onUnlinkProject: (projectId: string) => void;
  onLinkControl: () => void;
  onUpdateControl: (controlId: string, implementationStatus: string) => void;
  onUnlinkControl: (controlId: string) => void;
};

export default function RiskDetail(props: Props) {
  const [controlSearch, setControlSearch] = useState("");

  if (!props.risk) {
    return (
      <section className="mx-auto max-w-7xl px-6 py-8">
        <button className="text-sm font-semibold text-cyan-700" onClick={props.onBack}>Back to Risk Register</button>
        <div className="mt-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">Loading risk...</div>
      </section>
    );
  }

  const linkedAssetIds = new Set(props.risk.assets?.map((link) => link.assetId) ?? []);
  const linkedProjectIds = new Set(props.risk.projects?.map((link) => link.projectId) ?? []);
  const linkedControlIds = new Set(props.risk.controls?.map((control) => control.id) ?? []);
  const availableAssets = props.assets.filter((asset) => !linkedAssetIds.has(asset.id));
  const availableProjects = props.projects.filter((project) => !linkedProjectIds.has(project.id));
  const availableControls = props.controls.filter((control) => !linkedControlIds.has(control.id));
  const normalizedControlSearch = controlSearch.trim().toLowerCase();
  const suggestedControls = normalizedControlSearch
    ? availableControls.filter((control) => `${control.name} ${control.mappedControlId}`.toLowerCase().includes(normalizedControlSearch))
    : availableControls;

  return (
    <section className="mx-auto grid max-w-7xl gap-6 px-6 py-8 xl:grid-cols-[1.1fr_0.9fr]">
      <div className="space-y-6">
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <button className="text-sm font-semibold text-cyan-700" onClick={props.onBack}>Back to Risk Register</button>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold">{props.risk.description}</h2>
              <p className="text-sm text-slate-500">{props.risk.sourceFramework} / {props.risk.sourceCategoryId}</p>
            </div>
            <span className="rounded-full bg-slate-950 px-3 py-1 text-sm font-bold text-white">{props.risk.severity ?? "UNKNOWN"}</span>
          </div>
          <dl className="mt-5 grid gap-3 text-sm md:grid-cols-2">
            <Info label="Status" value={props.label(props.risk.status)} />
            <Info label="Owner" value={props.risk.owner} />
            <Info label="OWASP / NIST reference" value={`${props.risk.sourceFramework} / ${props.risk.sourceCategoryId}`} />
            <Info label="EU AI Act tier" value={props.risk.euAiActRiskTier ? props.label(props.risk.euAiActRiskTier) : null} />
            <Info label="STRIDE-AI category" value={props.risk.strideAiCategory ? props.label(props.risk.strideAiCategory) : null} />
            <Info label="MITRE ATLAS technique" value={props.risk.atlasTechnique} />
            <Info label="Due Date" value={props.risk.dueDate ? new Date(props.risk.dueDate).toLocaleDateString() : null} />
            <Info label="Inherent Score" value={String(props.risk.inherentRiskScore)} />
            <Info label="Likelihood" value={String(props.risk.likelihood)} />
            <Info label="Impact" value={String(props.risk.impact)} />
            <Info label="Residual Score" value={props.risk.residualRiskScore ? String(props.risk.residualRiskScore) : null} />
            <Info label="Treatment Plan" value={props.risk.treatmentPlan} />
          </dl>
        </div>

        <Panel title="Linked Assets">
          <LinkRow value={props.selectedAssetId} options={availableAssets.map((asset) => ({ id: asset.id, label: asset.name }))} placeholder="Select asset" onChange={props.onSelectedAssetChange} onLink={props.onLinkAsset} />
          <ItemList items={(props.risk.assets ?? []).map((link) => ({ id: link.assetId, title: link.asset.name, subtitle: "Asset link" }))} onRemove={props.onUnlinkAsset} />
        </Panel>

        <Panel title="Linked Projects">
          <LinkRow value={props.selectedProjectId} options={availableProjects.map((project) => ({ id: project.id, label: project.name }))} placeholder="Select project" onChange={props.onSelectedProjectChange} onLink={props.onLinkProject} />
          <ItemList items={(props.risk.projects ?? []).map((link) => ({ id: link.projectId, title: link.project.name, subtitle: props.label(link.project.status) }))} onRemove={props.onUnlinkProject} />
        </Panel>
      </div>

      <aside className="space-y-6">
        <Panel title="Linked Controls">
          <input className="mb-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Search controls by name or ID" value={controlSearch} onChange={(event) => setControlSearch(event.target.value)} />
          <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
            <select className="rounded-lg border border-slate-300 px-3 py-2 text-sm" value={props.selectedControlId} onChange={(event) => props.onSelectedControlChange(event.target.value)}>
              <option value="">Select control</option>
              {suggestedControls.map((control) => <option key={control.id} value={control.id}>{control.mappedControlId} - {control.name}</option>)}
            </select>
            <select className="rounded-lg border border-slate-300 px-3 py-2 text-sm" value={props.selectedControlStatus} onChange={(event) => props.onSelectedControlStatusChange(event.target.value)}>
              {controlStatuses.map((status) => <option key={status} value={status}>{props.label(status)}</option>)}
            </select>
            <button className="rounded-lg bg-slate-950 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40" disabled={!props.selectedControlId} onClick={props.onLinkControl}>Link</button>
          </div>
          <div className="mt-4 space-y-3">
            {(props.risk.controls ?? []).map((control) => (
              <div key={control.id} className="rounded-xl border border-slate-200 p-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{control.mappedControlId}</p>
                    <p className="text-slate-500">{control.mappedFramework}</p>
                  </div>
                  <button className="text-xs font-semibold text-red-600" onClick={() => props.onUnlinkControl(control.id)}>Unlink</button>
                </div>
                <select className="mt-3 rounded-lg border border-slate-300 px-3 py-2 text-sm" value={control.implementationStatus ?? "NOT_STARTED"} onChange={(event) => props.onUpdateControl(control.id, event.target.value)}>
                  {controlStatuses.map((status) => <option key={status} value={status}>{props.label(status)}</option>)}
                </select>
              </div>
            ))}
            {!(props.risk.controls ?? []).length && <p className="text-sm text-slate-500">No linked controls.</p>}
          </div>
        </Panel>

        <Panel title="Audit History">
          <div className="space-y-3">
            {props.auditLogs.map((log) => (
              <div key={log.id} className="border-t border-slate-200 pt-3 text-sm first:border-t-0 first:pt-0">
                <p className="font-medium">{props.label(log.action)}</p>
                <p className="text-slate-500">{log.actor?.name ?? "Unknown actor"} on {new Date(log.timestamp).toLocaleString()}</p>
              </div>
            ))}
            {!props.auditLogs.length && <p className="text-sm text-slate-500">No audit entries for this risk yet.</p>}
          </div>
        </Panel>
      </aside>
    </section>
  );
}

const controlStatuses = ["NOT_STARTED", "IN_PROGRESS", "IMPLEMENTED", "VERIFIED"];

function Info(props: { label: string; value?: string | null }) {
  return <div><dt className="font-semibold">{props.label}</dt><dd className="text-slate-600">{props.value || "Not set"}</dd></div>;
}

function Panel(props: { title: string; children: ReactNode }) {
  return <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200"><h3 className="text-lg font-semibold">{props.title}</h3><div className="mt-4">{props.children}</div></div>;
}

function LinkRow(props: { value: string; options: Array<{ id: string; label: string }>; placeholder: string; onChange: (id: string) => void; onLink: () => void }) {
  return (
    <div className="flex gap-2">
      <select className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" value={props.value} onChange={(event) => props.onChange(event.target.value)}>
        <option value="">{props.placeholder}</option>
        {props.options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
      </select>
      <button className="rounded-lg bg-slate-950 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40" disabled={!props.value} onClick={props.onLink}>Link</button>
    </div>
  );
}

function ItemList(props: { items: Array<{ id: string; title: string; subtitle: string }>; onRemove: (id: string) => void }) {
  return (
    <div className="mt-4 space-y-3">
      {props.items.map((item) => (
        <div key={item.id} className="rounded-xl border border-slate-200 p-3 text-sm">
          <div className="flex items-start justify-between gap-3">
            <div><p className="font-medium">{item.title}</p><p className="text-slate-500">{item.subtitle}</p></div>
            <button className="text-xs font-semibold text-red-600" onClick={() => props.onRemove(item.id)}>Unlink</button>
          </div>
        </div>
      ))}
      {!props.items.length && <p className="text-sm text-slate-500">No links yet.</p>}
    </div>
  );
}
