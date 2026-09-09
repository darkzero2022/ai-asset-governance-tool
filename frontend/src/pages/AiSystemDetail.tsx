import { FormEvent, type ReactNode } from "react";
import { ArrowLeft, Pencil } from "lucide-react";
import { ModelCardForm, type ModelCard, type ModelCardCompleteness, type ModelCardFormState } from "../components/ModelCardForm";
import { ApprovalBanner } from "../components/ApprovalBanner";
import { DependencyGraph } from "../components/DependencyGraph";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Combobox } from "../components/ui/Combobox";
import { Input, Select, TextArea } from "../components/ui/Field";
import { frameworkLabel } from "../formDefaults";
import { EmptyState } from "../components/ui/EmptyState";

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
  sourceUrl?: string | null;
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
  euAiActRiskTier?: string | null;
  strideAiCategory?: string | null;
  atlasTechnique?: string | null;
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

type AuditLog = {
  id: string;
  action: string;
  timestamp: string;
  actor?: { name: string; email: string };
  beforeJson?: Record<string, unknown> | null;
  afterJson?: Record<string, unknown> | null;
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
  sourceUrl: string;
};

type ImportSuggestion = {
  sourceUrl: string;
  suggestedTitle: string;
  suggestedDescription: string;
  excerpt: string;
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
  auditLogs: AuditLog[];
  selectedRiskId: string;
  selectedProjectId: string;
  workflowComments: string;
  label: (value: string) => string;
  /** Transition targets the current user may move this asset to, already role-filtered. */
  availableTransitions: string[];
  canManage: boolean;
  onBack: () => void;
  onEditAsset: (asset: Asset) => void;
  onFormChange: (form: AssetForm) => void;
  onSaveAsset: (event: FormEvent) => void;
  onModelCardFormChange: (form: ModelCardFormState) => void;
  modelCardSourceUrl: string;
  modelCardImportSuggestion: ImportSuggestion | null;
  onModelCardSourceUrlChange: (sourceUrl: string) => void;
  onFetchModelCardImport: (sourceUrl: string) => void;
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

function BackLink({ onBack }: { onBack: () => void }) {
  return (
    <button className="mb-4 flex items-center gap-1 text-sm font-medium text-subtle hover:text-text" onClick={onBack}>
      <ArrowLeft className="h-4 w-4" /> Back to AI Systems
    </button>
  );
}

export default function AiSystemDetail(props: Props) {
  if (!props.asset) {
    return (
      <section className="mx-auto max-w-7xl px-6 py-6">
        <BackLink onBack={props.onBack} />
        <Card><CardBody>Loading AI system…</CardBody></Card>
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
    <section className="mx-auto max-w-7xl px-6 py-6">
      <BackLink onBack={props.onBack} />
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <Card>
            <CardBody>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-xl font-semibold text-text">{props.asset.name}</h1>
                    <Badge variant="primary">{props.label(props.asset.status)}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-subtle">v{props.asset.version} · {props.label(props.asset.type)}</p>
                </div>
                {props.canManage && (
                  <Button variant="secondary" size="sm" onClick={() => props.onEditAsset(asset)}>
                    <Pencil className="h-3.5 w-3.5" /> Edit AI system
                  </Button>
                )}
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
                <Info label="Source URL" value={props.asset.sourceUrl} href={props.asset.sourceUrl} />
              </dl>
            </CardBody>
          </Card>

          {isEditing && props.canManage && (
            <Card>
              <CardHeader title="Edit AI system" />
              <form onSubmit={props.onSaveAsset}>
                <CardBody className="grid gap-4 md:grid-cols-2">
                  <Input label="Name" value={props.assetForm.name} onChange={(event) => props.onFormChange({ ...props.assetForm, name: event.target.value })} />
                  <Input label="Version" value={props.assetForm.version} onChange={(event) => props.onFormChange({ ...props.assetForm, version: event.target.value })} />
                  <Select label="Type" value={props.assetForm.type} onChange={(event) => props.onFormChange({ ...props.assetForm, type: event.target.value })}>
                    {["MODEL", "DATASET", "SERVICE", "LIBRARY"].map((option) => <option key={option} value={option}>{props.label(option)}</option>)}
                  </Select>
                  <Select label="Hosting Model" value={props.assetForm.hostingModel} onChange={(event) => props.onFormChange({ ...props.assetForm, hostingModel: event.target.value })}>
                    {["SAAS_API", "SELF_HOSTED", "EMBEDDED_IN_APP"].map((option) => <option key={option} value={option}>{props.label(option)}</option>)}
                  </Select>
                  <Select label="Network Dependency" value={props.assetForm.networkDependency} onChange={(event) => props.onFormChange({ ...props.assetForm, networkDependency: event.target.value })}>
                    {["AIR_GAPPED", "HYBRID", "FULLY_CONNECTED"].map((option) => <option key={option} value={option}>{props.label(option)}</option>)}
                  </Select>
                  <Input label="Supplier" value={props.assetForm.supplier} onChange={(event) => props.onFormChange({ ...props.assetForm, supplier: event.target.value })} />
                  <Input label="Provider" value={props.assetForm.provider ?? ""} onChange={(event) => props.onFormChange({ ...props.assetForm, provider: event.target.value })} />
                  <Input label="License" value={props.assetForm.license ?? ""} onChange={(event) => props.onFormChange({ ...props.assetForm, license: event.target.value })} />
                  <Input label="Data Classification" value={props.assetForm.dataClassificationTouched ?? ""} onChange={(event) => props.onFormChange({ ...props.assetForm, dataClassificationTouched: event.target.value })} />
                  <TextArea label="Training Data Provenance" value={props.assetForm.trainingDataProvenance ?? ""} onChange={(event) => props.onFormChange({ ...props.assetForm, trainingDataProvenance: event.target.value })} />
                  <TextArea label="Downstream Consumers" value={props.assetForm.downstreamConsumers ?? ""} onChange={(event) => props.onFormChange({ ...props.assetForm, downstreamConsumers: event.target.value })} />
                  <Input label="Source URL" value={props.assetForm.sourceUrl ?? ""} onChange={(event) => props.onFormChange({ ...props.assetForm, sourceUrl: event.target.value })} />
                  <Button type="submit" variant="primary" className="md:col-span-2">Save AI system</Button>
                </CardBody>
              </form>
            </Card>
          )}

          <ApprovalBanner risks={props.asset.risks} assetType={props.asset.type} modelCard={props.modelCard} modelCardCompleteness={props.modelCardCompleteness} />
          {props.canManage && (props.asset.type === "MODEL" || props.asset.type === "SERVICE") && <ModelCardForm modelCard={props.modelCard} completeness={props.modelCardCompleteness} form={props.modelCardForm} sourceUrl={props.modelCardSourceUrl} importSuggestion={props.modelCardImportSuggestion} onFormChange={props.onModelCardFormChange} onSourceUrlChange={props.onModelCardSourceUrlChange} onFetchImport={props.onFetchModelCardImport} onSubmit={props.onSaveModelCard} />}
          <DependencyGraph asset={props.asset} />
        </div>

        <aside className="space-y-6">
          <Panel title="Linked Risks">
            {props.canManage && (
              <div className="flex gap-2">
                <div className="min-w-0 flex-1">
                  <Combobox
                    value={props.selectedRiskId}
                    onChange={props.onSelectedRiskChange}
                    options={availableRisks.map((risk) => ({ value: risk.id, label: risk.description }))}
                    placeholder="Select risk"
                  />
                </div>
                <Button variant="primary" size="sm" disabled={!props.selectedRiskId} onClick={props.onLinkRisk}>Link</Button>
              </div>
            )}
            <div className="mt-4 space-y-3">
              {props.asset.risks.map((risk) => (
                <div key={risk.id} className="rounded-md border border-border p-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words font-medium text-text">{risk.description}</p>
                      <p className="text-subtle">{props.label(risk.status)} · Score {risk.inherentRiskScore}</p>
                    </div>
                    {props.canManage && <button className="shrink-0 text-xs font-semibold text-danger hover:underline" onClick={() => props.onUnlinkRisk(risk.id)}>Unlink</button>}
                  </div>
                  <RiskReferenceTags risk={risk} label={props.label} />
                </div>
              ))}
              {!props.asset.risks.length && <EmptyState title="No linked risks." />}
            </div>
          </Panel>

          <Panel title="Linked Projects">
            {props.canManage && (
              <div className="flex gap-2">
                <div className="min-w-0 flex-1">
                  <Combobox
                    value={props.selectedProjectId}
                    onChange={props.onSelectedProjectChange}
                    options={availableProjects.map((project) => ({ value: project.id, label: project.name }))}
                    placeholder="Select project"
                  />
                </div>
                <Button variant="primary" size="sm" disabled={!props.selectedProjectId} onClick={props.onLinkProject}>Link</Button>
              </div>
            )}
            <div className="mt-4 space-y-3">
              {props.linkedProjects.map((project) => (
                <div key={project.id} className="rounded-md border border-border p-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-text">{project.name}</p>
                      <p className="text-subtle">{props.label(project.status)}{project.businessOwner ? ` · ${project.businessOwner}` : ""}</p>
                    </div>
                    {props.canManage && <button className="text-xs font-semibold text-danger hover:underline" onClick={() => props.onUnlinkProject(project.id)}>Unlink</button>}
                  </div>
                </div>
              ))}
              {!props.linkedProjects.length && <EmptyState title="No linked projects." />}
            </div>
          </Panel>

          <Panel title="Governance Workflow">
            <TextArea aria-label="Approval comments" placeholder="Approval comments" value={props.workflowComments} onChange={(event) => props.onWorkflowCommentsChange(event.target.value)} />
            <div className="mt-3 flex flex-wrap gap-2">
              {props.availableTransitions.map((status) => (
                <Button key={status} variant="primary" size="sm" onClick={() => props.onTransitionAsset(status)}>
                  Move to {props.label(status)}
                </Button>
              ))}
              {props.availableTransitions.length === 0 && <p className="text-sm text-subtle">No further transitions available.</p>}
            </div>
            <div className="mt-4 space-y-3">
              {props.asset.workflow.map((entry) => (
                <div key={entry.id} className="border-t border-border pt-3 text-sm">
                  <p className="font-medium text-text">{props.label(entry.fromStatus)} → {props.label(entry.toStatus)}</p>
                  <p className="text-subtle">{entry.approvedBy.name} on {new Date(entry.timestamp).toLocaleString()}</p>
                  {entry.comments && <p className="mt-1 text-text">{entry.comments}</p>}
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Field History">
            <div className="space-y-3">
              {props.auditLogs.map((log) => {
                const changes = diffAuditFields(log.beforeJson, log.afterJson);
                return (
                  <div key={log.id} className="border-t border-border pt-3 text-sm first:border-t-0 first:pt-0">
                    <p className="font-medium text-text">{props.label(log.action)} by {log.actor?.name ?? "Unknown actor"}</p>
                    <p className="text-subtle">{new Date(log.timestamp).toLocaleString()}</p>
                    {changes.length ? (
                      <ul className="mt-2 space-y-1 text-xs text-subtle">
                        {changes.map((change) => <li key={`${log.id}-${change.field}`}><span className="font-semibold text-text">{change.field}</span>: {change.before || "Not set"} → {change.after || "Not set"}</li>)}
                      </ul>
                    ) : <p className="mt-2 text-xs text-subtle">No field-level diff available.</p>}
                  </div>
                );
              })}
              {!props.auditLogs.length && <EmptyState title="No AI system field history yet." />}
            </div>
          </Panel>
        </aside>
      </div>
    </section>
  );
}

function RiskReferenceTags(props: { risk: Risk; label: (value: string) => string }) {
  const { risk } = props;
  const frameworkName = frameworkLabel(risk.sourceFramework);
  const categoryText = risk.sourceFramework === "EU_AI_ACT" ? props.label(risk.sourceCategoryId) : risk.sourceCategoryId;
  const tags: Array<{ key: string; text: string; mapped: boolean }> = [
    { key: "framework", text: `${frameworkName}: ${categoryText}`, mapped: true },
  ];
  if (risk.sourceFramework !== "NIST_AI_RMF") tags.push({ key: "nist", text: "NIST AI RMF: not mapped", mapped: false });
  if (risk.sourceFramework !== "EU_AI_ACT") {
    tags.push({ key: "eu", text: risk.euAiActRiskTier ? `EU AI Act: ${props.label(risk.euAiActRiskTier)}` : "EU AI Act: not mapped", mapped: Boolean(risk.euAiActRiskTier) });
  }
  tags.push({ key: "stride", text: risk.strideAiCategory ? `STRIDE-AI: ${props.label(risk.strideAiCategory)}` : "STRIDE-AI: not mapped", mapped: Boolean(risk.strideAiCategory) });
  tags.push({ key: "atlas", text: risk.atlasTechnique ? `ATLAS: ${risk.atlasTechnique}` : "ATLAS: no technique", mapped: Boolean(risk.atlasTechnique) });

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {tags.map((tag) => (
        <Badge key={tag.key} variant={tag.mapped ? "primary" : "neutral"}>{tag.text}</Badge>
      ))}
    </div>
  );
}

function Info(props: { label: string; value?: string | null; href?: string | null }) {
  return (
    <div>
      <dt className="font-semibold text-text">{props.label}</dt>
      <dd className="text-subtle">{props.href ? <a className="text-primary underline" href={props.href} target="_blank" rel="noreferrer">{props.value}</a> : props.value || "Not set"}</dd>
    </div>
  );
}

function diffAuditFields(beforeJson?: Record<string, unknown> | null, afterJson?: Record<string, unknown> | null) {
  if (!beforeJson || !afterJson) return [];
  const ignored = new Set(["updatedAt", "createdAt", "createdById"]);
  const fields = new Set([...Object.keys(beforeJson), ...Object.keys(afterJson)]);
  return [...fields]
    .filter((field) => !ignored.has(field) && JSON.stringify(beforeJson[field]) !== JSON.stringify(afterJson[field]))
    .map((field) => ({ field, before: formatAuditValue(beforeJson[field]), after: formatAuditValue(afterJson[field]) }));
}

function formatAuditValue(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function Panel(props: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader title={props.title} />
      <CardBody>{props.children}</CardBody>
    </Card>
  );
}
