import type { ReactNode } from "react";
import { ArrowLeft, Download } from "lucide-react";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Combobox } from "../components/ui/Combobox";
import { EmptyState } from "../components/ui/EmptyState";

type Asset = { id: string; name: string; type: string; status: string };
type Risk = {
  id: string;
  description: string;
  status: string;
  inherentRiskScore: number;
  severity?: string | null;
  origin?: string;
};
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
  canManage: boolean;
};

function BackLink({ onBack }: { onBack: () => void }) {
  return (
    <button
      className="mb-4 flex items-center gap-1 text-sm font-medium text-subtle hover:text-text"
      onClick={onBack}
    >
      <ArrowLeft className="h-4 w-4" /> Back to Projects
    </button>
  );
}

export default function ProjectDetail(props: Props) {
  if (!props.project) {
    return (
      <section className="mx-auto max-w-7xl px-6 py-6">
        <BackLink onBack={props.onBack} />
        <Card>
          <CardBody>Loading project…</CardBody>
        </Card>
      </section>
    );
  }

  const linkedAssetIds = new Set(props.project.assetLinks?.map((link) => link.assetId) ?? []);
  const linkedRiskIds = new Set(props.project.riskLinks?.map((link) => link.riskId) ?? []);
  const availableAssets = props.assets.filter((asset) => !linkedAssetIds.has(asset.id));
  const availableRisks = props.risks.filter((risk) => !linkedRiskIds.has(risk.id));

  return (
    <section className="mx-auto max-w-7xl px-6 py-6">
      <BackLink onBack={props.onBack} />
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardBody>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h1 className="text-xl font-semibold text-text">{props.project.name}</h1>
                  <p className="mt-1 text-sm text-subtle">
                    {props.label(props.project.status)} · Owner:{" "}
                    {props.project.businessOwner || "Unassigned"}
                  </p>
                </div>
                <Button variant="secondary" size="sm" onClick={props.onExportCycloneDx}>
                  <Download className="h-3.5 w-3.5" /> Export CycloneDX
                </Button>
              </div>
              <p className="mt-4 text-sm text-text">
                {props.project.description || "No description"}
              </p>
            </CardBody>
          </Card>

          <Panel title="Linked AI Systems">
            {props.canManage && (
              <div className="flex gap-2">
                <div className="min-w-0 flex-1">
                  <Combobox
                    value={props.selectedAssetId}
                    onChange={props.onSelectedAssetChange}
                    options={availableAssets.map((asset) => ({
                      value: asset.id,
                      label: asset.name,
                    }))}
                    placeholder="Select AI system"
                  />
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={!props.selectedAssetId}
                  onClick={props.onLinkAsset}
                >
                  Link
                </Button>
              </div>
            )}
            <div className="mt-4 space-y-3">
              {(props.project.assetLinks ?? []).map((link) => (
                <Item
                  key={link.assetId}
                  title={link.asset.name}
                  subtitle={`${props.label(link.asset.type)} · ${props.label(link.asset.status)}`}
                  onRemove={props.canManage ? () => props.onUnlinkAsset(link.assetId) : undefined}
                />
              ))}
              {!(props.project.assetLinks ?? []).length && (
                <EmptyState title="No linked AI systems." />
              )}
            </div>
          </Panel>
        </div>

        <aside className="min-w-0 space-y-6">
          <Panel title="Direct Risks">
            {props.canManage && (
              <div className="flex gap-2">
                <div className="min-w-0 flex-1">
                  <Combobox
                    value={props.selectedRiskId}
                    onChange={props.onSelectedRiskChange}
                    options={availableRisks.map((risk) => ({
                      value: risk.id,
                      label: risk.description,
                    }))}
                    placeholder="Select risk"
                  />
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={!props.selectedRiskId}
                  onClick={props.onLinkRisk}
                >
                  Link
                </Button>
              </div>
            )}
            <div className="mt-4 space-y-3">
              {(props.project.riskLinks ?? []).map((link) => (
                <Item
                  key={link.riskId}
                  title={link.risk.description}
                  subtitle={`${props.label(link.risk.status)} · Score ${link.risk.inherentRiskScore}`}
                  onRemove={props.canManage ? () => props.onUnlinkRisk(link.riskId) : undefined}
                />
              ))}
              {!(props.project.riskLinks ?? []).length && <EmptyState title="No direct risks." />}
            </div>
          </Panel>

          <Panel title="Merged Risk View">
            <div className="space-y-3">
              {props.mergedRisks.map((risk) => (
                <div key={risk.id} className="rounded-md border border-border p-3 text-sm">
                  <p className="break-words font-medium text-text">{risk.description}</p>
                  <p className="text-subtle">
                    {props.label(risk.status)} · Score {risk.inherentRiskScore} · Origin:{" "}
                    {risk.origin ?? "project"}
                  </p>
                </div>
              ))}
              {!props.mergedRisks.length && <EmptyState title="No merged risks yet." />}
            </div>
          </Panel>
        </aside>
      </div>
    </section>
  );
}

function Panel(props: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader title={props.title} />
      <CardBody>{props.children}</CardBody>
    </Card>
  );
}

function Item(props: { title: string; subtitle: string; onRemove?: () => void }) {
  return (
    <div className="rounded-md border border-border p-3 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-words font-medium text-text">{props.title}</p>
          <p className="text-subtle">{props.subtitle}</p>
        </div>
        {props.onRemove && (
          <button
            className="shrink-0 text-xs font-semibold text-danger hover:underline"
            onClick={props.onRemove}
          >
            Unlink
          </button>
        )}
      </div>
    </div>
  );
}
