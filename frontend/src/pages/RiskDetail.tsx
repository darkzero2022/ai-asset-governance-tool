import { useState, type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { Badge, SeverityBadge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Input, Select } from "../components/ui/Field";
import { Combobox } from "../components/ui/Combobox";
import { EmptyState } from "../components/ui/EmptyState";
import { frameworkLabel } from "../formDefaults";

type Asset = { id: string; name: string };
type Project = { id: string; name: string; status: string };
type Control = {
  id: string;
  name: string;
  mappedFramework: string;
  mappedControlId: string;
  description?: string | null;
};
type RiskControl = Control & { implementationStatus?: string; evidenceNotes?: string | null };

type RiskDetailData = {
  id: string;
  description: string;
  sourceFramework: string;
  sourceCategoryId: string;
  euAiActRiskTier?: string | null;
  strideAiCategory?: string | null;
  atlasTechnique?: string | null;
  atlasMitigations?: string[];
  relatedClassifications?: Array<{
    framework: string;
    categoryId: string;
    categoryName: string;
    relationship: string;
    rationale?: string | null;
  }>;
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
  canManage: boolean;
  evidence?: ReactNode;
};

const controlStatuses = ["NOT_STARTED", "IN_PROGRESS", "IMPLEMENTED", "VERIFIED"];

function BackLink({ onBack }: { onBack: () => void }) {
  return (
    <button
      className="mb-4 flex items-center gap-1 text-sm font-medium text-subtle hover:text-text"
      onClick={onBack}
    >
      <ArrowLeft className="h-4 w-4" /> Back to Risk Register
    </button>
  );
}

export default function RiskDetail(props: Props) {
  const [controlSearch, setControlSearch] = useState("");

  if (!props.risk) {
    return (
      <section className="mx-auto max-w-7xl px-6 py-6">
        <BackLink onBack={props.onBack} />
        <Card>
          <CardBody>Loading risk…</CardBody>
        </Card>
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
    ? availableControls.filter((control) =>
        `${control.name} ${control.mappedControlId}`
          .toLowerCase()
          .includes(normalizedControlSearch),
      )
    : availableControls;

  return (
    <section className="mx-auto max-w-7xl px-6 py-6">
      <BackLink onBack={props.onBack} />
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <Card>
            <CardBody>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h1 className="text-xl font-semibold text-text">{props.risk.description}</h1>
                  <p className="mt-1 text-sm text-subtle">
                    {props.risk.sourceFramework} / {props.risk.sourceCategoryId}
                  </p>
                </div>
                <SeverityBadge severity={props.risk.severity} />
              </div>

              <div className="mt-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-subtle">
                  Threat classification
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <ClassPill
                    kind="framework"
                    label={`${frameworkLabel(props.risk.sourceFramework)}: ${props.risk.sourceCategoryId}`}
                  />
                  {props.risk.euAiActRiskTier && (
                    <ClassPill
                      kind="framework"
                      label={`EU AI Act: ${props.label(props.risk.euAiActRiskTier)}`}
                    />
                  )}
                  {props.risk.strideAiCategory && (
                    <ClassPill
                      kind="stride"
                      label={`STRIDE-AI: ${props.label(props.risk.strideAiCategory)}`}
                    />
                  )}
                  {props.risk.atlasTechnique && (
                    <ClassPill kind="atlas" label={`ATLAS: ${props.risk.atlasTechnique}`} />
                  )}
                </div>
              </div>

              {props.risk.relatedClassifications &&
                props.risk.relatedClassifications.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-subtle">
                      Related classifications
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {props.risk.relatedClassifications.map((related) => (
                        <ClassPill
                          key={`${related.framework}:${related.categoryId}`}
                          kind="related"
                          label={`${frameworkLabel(related.framework)}: ${related.categoryId} (${related.relationship.toLowerCase()})`}
                          title={related.rationale ?? undefined}
                        />
                      ))}
                    </div>
                    <p className="mt-1 text-xs text-subtle">
                      Our analysis — not an official OWASP crosswalk. Hover for the rationale.
                    </p>
                  </div>
                )}

              <dl className="mt-5 grid gap-3 text-sm md:grid-cols-2">
                <Info label="Status" value={props.label(props.risk.status)} />
                <Info label="Owner" value={props.risk.owner} />
                <Info
                  label="Due Date"
                  value={
                    props.risk.dueDate ? new Date(props.risk.dueDate).toLocaleDateString() : null
                  }
                />
                <Info label="Inherent Score" value={String(props.risk.inherentRiskScore)} />
                <Info label="Likelihood" value={String(props.risk.likelihood)} />
                <Info label="Impact" value={String(props.risk.impact)} />
                <Info
                  label="Residual Score"
                  value={props.risk.residualRiskScore ? String(props.risk.residualRiskScore) : null}
                />
              </dl>

              <div className="mt-5 border-t border-border pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-subtle">
                  Remediation action plan
                </p>
                <p className="mt-2 text-sm text-text">
                  {props.risk.treatmentPlan || "No treatment plan recorded."}
                </p>
                <p className="mt-3 text-xs font-medium text-subtle">MITRE ATLAS mitigations</p>
                {props.risk.atlasMitigations?.length ? (
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {props.risk.atlasMitigations.map((name) => (
                      <ClassPill key={name} kind="atlas" label={name} />
                    ))}
                  </div>
                ) : (
                  <p className="mt-1.5 text-sm text-subtle">None mapped.</p>
                )}
              </div>
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
            <ItemList
              items={(props.risk.assets ?? []).map((link) => ({
                id: link.assetId,
                title: link.asset.name,
                subtitle: "AI system link",
              }))}
              onRemove={props.canManage ? props.onUnlinkAsset : undefined}
            />
          </Panel>

          <Panel title="Linked Projects">
            {props.canManage && (
              <div className="flex gap-2">
                <div className="min-w-0 flex-1">
                  <Combobox
                    value={props.selectedProjectId}
                    onChange={props.onSelectedProjectChange}
                    options={availableProjects.map((project) => ({
                      value: project.id,
                      label: project.name,
                    }))}
                    placeholder="Select project"
                  />
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={!props.selectedProjectId}
                  onClick={props.onLinkProject}
                >
                  Link
                </Button>
              </div>
            )}
            <ItemList
              items={(props.risk.projects ?? []).map((link) => ({
                id: link.projectId,
                title: link.project.name,
                subtitle: props.label(link.project.status),
              }))}
              onRemove={props.canManage ? props.onUnlinkProject : undefined}
            />
          </Panel>
        </div>

        <aside className="space-y-6">
          <Panel title="Linked Controls">
            {props.canManage && (
              <>
                <Input
                  aria-label="Search controls by name or ID"
                  placeholder="Search controls by name or ID"
                  value={controlSearch}
                  onChange={(event) => setControlSearch(event.target.value)}
                  className="mb-2"
                />
                <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                  <Select
                    aria-label="Select control"
                    value={props.selectedControlId}
                    onChange={(event) => props.onSelectedControlChange(event.target.value)}
                  >
                    <option value="">Select control</option>
                    {suggestedControls.map((control) => (
                      <option key={control.id} value={control.id}>
                        {control.mappedControlId} - {control.name}
                      </option>
                    ))}
                  </Select>
                  <Select
                    aria-label="Implementation status"
                    value={props.selectedControlStatus}
                    onChange={(event) => props.onSelectedControlStatusChange(event.target.value)}
                  >
                    {controlStatuses.map((status) => (
                      <option key={status} value={status}>
                        {props.label(status)}
                      </option>
                    ))}
                  </Select>
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={!props.selectedControlId}
                    onClick={props.onLinkControl}
                  >
                    Link
                  </Button>
                </div>
              </>
            )}
            <div className="mt-4 space-y-3">
              {(props.risk.controls ?? []).map((control) => (
                <div key={control.id} className="rounded-md border border-border p-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-text">{control.mappedControlId}</p>
                      <p className="text-subtle">{control.mappedFramework}</p>
                    </div>
                    {props.canManage && (
                      <button
                        className="text-xs font-semibold text-danger hover:underline"
                        onClick={() => props.onUnlinkControl(control.id)}
                      >
                        Unlink
                      </button>
                    )}
                  </div>
                  {props.canManage ? (
                    <Select
                      aria-label={`Implementation status for ${control.mappedControlId}`}
                      value={control.implementationStatus ?? "NOT_STARTED"}
                      onChange={(event) => props.onUpdateControl(control.id, event.target.value)}
                      className="mt-3"
                    >
                      {controlStatuses.map((status) => (
                        <option key={status} value={status}>
                          {props.label(status)}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <div className="mt-2">
                      <Badge variant="neutral">
                        {props.label(control.implementationStatus ?? "NOT_STARTED")}
                      </Badge>
                    </div>
                  )}
                </div>
              ))}
              {!(props.risk.controls ?? []).length && <EmptyState title="No linked controls." />}
            </div>
          </Panel>

          {props.evidence}

          <Panel title="Audit History">
            <div className="space-y-3">
              {props.auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="border-t border-border pt-3 text-sm first:border-t-0 first:pt-0"
                >
                  <p className="font-medium text-text">{props.label(log.action)}</p>
                  <p className="text-subtle">
                    {log.actor?.name ?? "Unknown actor"} on{" "}
                    {new Date(log.timestamp).toLocaleString()}
                  </p>
                </div>
              ))}
              {!props.auditLogs.length && (
                <EmptyState title="No audit entries for this risk yet." />
              )}
            </div>
          </Panel>
        </aside>
      </div>
    </section>
  );
}

const PILL_STYLES: Record<string, string> = {
  framework: "border-primary/40 bg-primary/10 text-text",
  stride: "border-warning/40 bg-warning/10 text-text",
  atlas: "border-info/40 bg-info/10 text-text",
  related: "border-border bg-surface-alt text-subtle",
};

function ClassPill({
  kind,
  label,
  title,
}: {
  kind: keyof typeof PILL_STYLES;
  label: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${PILL_STYLES[kind]}`}
    >
      {label}
    </span>
  );
}

function Info(props: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="font-semibold text-text">{props.label}</dt>
      <dd className="text-subtle">{props.value || "Not set"}</dd>
    </div>
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

function ItemList(props: {
  items: Array<{ id: string; title: string; subtitle: string }>;
  onRemove?: (id: string) => void;
}) {
  return (
    <div className="mt-4 space-y-3">
      {props.items.map((item) => (
        <div key={item.id} className="rounded-md border border-border p-3 text-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium text-text">{item.title}</p>
              <p className="text-subtle">{item.subtitle}</p>
            </div>
            {props.onRemove && (
              <button
                className="text-xs font-semibold text-danger hover:underline"
                onClick={() => props.onRemove!(item.id)}
              >
                Unlink
              </button>
            )}
          </div>
        </div>
      ))}
      {!props.items.length && <EmptyState title="No links yet." />}
    </div>
  );
}
