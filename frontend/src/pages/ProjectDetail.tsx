type Asset = { id: string; name: string; type: string; status: string };
type Risk = { id: string; description: string; status: string; inherentRiskScore: number; severity?: string | null; origin?: string };
type Project = {
  id: string;
  name: string;
  description?: string | null;
  businessOwner?: string | null;
  status: string;
  assetLinks?: Array<{ assetId: string; asset: Asset }>;
  riskLinks?: Array<{ riskId: string; risk: Risk }>;
};

type Props = {
  project: Project | null;
  assets: Asset[];
  risks: Risk[];
  mergedRisks: Risk[];
  selectedAssetId: string;
  selectedRiskId: string;
  label: (value: string) => string;
  onBack: () => void;
  onSelectedAssetChange: (id: string) => void;
  onSelectedRiskChange: (id: string) => void;
  onLinkAsset: () => void;
  onUnlinkAsset: (assetId: string) => void;
  onLinkRisk: () => void;
  onUnlinkRisk: (riskId: string) => void;
  onExportCycloneDx: () => void;
};

export default function ProjectDetail(props: Props) {
  if (!props.project) {
    return (
      <section className="mx-auto max-w-7xl px-6 py-8">
        <button className="text-sm font-semibold text-cyan-700" onClick={props.onBack}>Back to Projects</button>
        <div className="mt-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">Loading project...</div>
      </section>
    );
  }

  const linkedAssetIds = new Set(props.project.assetLinks?.map((link) => link.assetId) ?? []);
  const linkedRiskIds = new Set(props.project.riskLinks?.map((link) => link.riskId) ?? []);
  const availableAssets = props.assets.filter((asset) => !linkedAssetIds.has(asset.id));
  const availableRisks = props.risks.filter((risk) => !linkedRiskIds.has(risk.id));

  return (
    <section className="mx-auto grid max-w-7xl gap-6 px-6 py-8 xl:grid-cols-[1.1fr_0.9fr]">
      <div className="space-y-6">
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <button className="text-sm font-semibold text-cyan-700" onClick={props.onBack}>Back to Projects</button>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold">{props.project.name}</h2>
              <p className="text-sm text-slate-500">{props.label(props.project.status)} | Owner: {props.project.businessOwner || "Unassigned"}</p>
            </div>
            <button className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white" onClick={props.onExportCycloneDx}>Export CycloneDX</button>
          </div>
          <p className="mt-4 text-sm text-slate-600">{props.project.description || "No description"}</p>
        </div>

        <Panel title="Linked Assets">
          <LinkRow value={props.selectedAssetId} options={availableAssets.map((asset) => ({ id: asset.id, label: asset.name }))} placeholder="Select asset" onChange={props.onSelectedAssetChange} onLink={props.onLinkAsset} />
          <div className="mt-4 space-y-3">
            {(props.project.assetLinks ?? []).map((link) => <Item key={link.assetId} title={link.asset.name} subtitle={`${props.label(link.asset.type)} | ${props.label(link.asset.status)}`} onRemove={() => props.onUnlinkAsset(link.assetId)} />)}
            {!(props.project.assetLinks ?? []).length && <p className="text-sm text-slate-500">No linked assets.</p>}
          </div>
        </Panel>
      </div>

      <aside className="space-y-6">
        <Panel title="Direct Risks">
          <LinkRow value={props.selectedRiskId} options={availableRisks.map((risk) => ({ id: risk.id, label: risk.description }))} placeholder="Select risk" onChange={props.onSelectedRiskChange} onLink={props.onLinkRisk} />
          <div className="mt-4 space-y-3">
            {(props.project.riskLinks ?? []).map((link) => <Item key={link.riskId} title={link.risk.description} subtitle={`${props.label(link.risk.status)} | Score ${link.risk.inherentRiskScore}`} onRemove={() => props.onUnlinkRisk(link.riskId)} />)}
            {!(props.project.riskLinks ?? []).length && <p className="text-sm text-slate-500">No direct risks.</p>}
          </div>
        </Panel>

        <Panel title="Merged Risk View">
          <div className="space-y-3">
            {props.mergedRisks.map((risk) => (
              <div key={risk.id} className="rounded-xl border border-slate-200 p-3 text-sm">
                <p className="font-medium">{risk.description}</p>
                <p className="text-slate-500">{props.label(risk.status)} | Score {risk.inherentRiskScore} | Origin: {risk.origin ?? "project"}</p>
              </div>
            ))}
            {!props.mergedRisks.length && <p className="text-sm text-slate-500">No merged risks yet.</p>}
          </div>
        </Panel>
      </aside>
    </section>
  );
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

function Item(props: { title: string; subtitle: string; onRemove: () => void }) {
  return (
    <div className="rounded-xl border border-slate-200 p-3 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div><p className="font-medium">{props.title}</p><p className="text-slate-500">{props.subtitle}</p></div>
        <button className="text-xs font-semibold text-red-600" onClick={props.onRemove}>Unlink</button>
      </div>
    </div>
  );
}
import type { ReactNode } from "react";
