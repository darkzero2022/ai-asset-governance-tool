import { useState } from "react";
import { ArrowLeft, Sparkles, Trash2 } from "lucide-react";
import { THREAT_MODEL_ELEMENT_TYPES, type ThreatModelElementType } from "@aibom/shared";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input, Select } from "../components/ui/Field";
import { Badge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { toast } from "../components/ui/toastStore";
import { label, frameworkLabel } from "../formDefaults";
import { ThreatModelDiagram } from "../components/ThreatModelDiagram";
import {
  useThreatModelMutations,
  useThreatModelQuery,
  useThreatModelReportQuery,
  type TMThreat,
} from "../queries/threatModels";

type Props = {
  token: string;
  assetId: string;
  assetName: string;
  canManage: boolean;
  onBack: () => void;
  onOpenRisk: (riskId: string) => void;
};

export default function ThreatModelPage({
  token,
  assetId,
  assetName,
  canManage,
  onBack,
  onOpenRisk,
}: Props) {
  const { data: model, isPending } = useThreatModelQuery(token, assetId);
  const { data: report } = useThreatModelReportQuery(token, model?.id);
  const m = useThreatModelMutations(token, assetId, model?.id);

  const [newTitle, setNewTitle] = useState("");
  const [el, setEl] = useState<{ type: ThreatModelElementType; name: string }>({
    type: "MODEL",
    name: "",
  });
  const [flow, setFlow] = useState({
    sourceId: "",
    targetId: "",
    label: "",
    authenticated: false,
    encrypted: false,
  });
  const [boundaryName, setBoundaryName] = useState("");

  function fail(err: unknown) {
    toast.error(err instanceof Error ? err.message : "Something went wrong");
  }

  const back = (
    <button
      className="mb-4 flex items-center gap-1 text-sm font-medium text-subtle hover:text-text"
      onClick={onBack}
    >
      <ArrowLeft className="h-4 w-4" /> Back to {assetName}
    </button>
  );

  if (isPending) {
    return (
      <section className="mx-auto max-w-5xl px-6 py-6">
        {back}
        <Card>
          <CardBody>Loading…</CardBody>
        </Card>
      </section>
    );
  }

  if (!model) {
    return (
      <section className="mx-auto max-w-5xl px-6 py-6">
        {back}
        <Card>
          <CardHeader title="Threat model" />
          <CardBody>
            <p className="text-sm text-subtle">
              No threat model yet for <strong>{assetName}</strong>. Map its data flows, then let the
              rules suggest threats.
            </p>
            {canManage ? (
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <Input
                  id="tm-title"
                  label="Title"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Inference & retrieval path"
                />
                <Button
                  variant="primary"
                  size="sm"
                  disabled={!newTitle.trim() || m.create.isPending}
                  onClick={() =>
                    m.create.mutate(
                      { title: newTitle.trim() },
                      { onSuccess: () => setNewTitle(""), onError: fail },
                    )
                  }
                >
                  Create threat model
                </Button>
              </div>
            ) : (
              <p className="mt-3 text-sm text-subtle">You do not have permission to create one.</p>
            )}
          </CardBody>
        </Card>
      </section>
    );
  }

  const elementName = (id: string) => model.elements.find((e) => e.id === id)?.name ?? "?";

  const ThreatRow = ({ t }: { t: TMThreat }) => (
    <li className="rounded-md border border-border p-3 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-text">{t.title}</p>
          <p className="text-subtle">{t.description}</p>
          <p className="mt-1 flex flex-wrap gap-1">
            {t.strideAiCategory && <Badge variant="neutral">{label(t.strideAiCategory)}</Badge>}
            {t.sourceFramework && t.sourceCategoryId && (
              <Badge variant="primary">
                {frameworkLabel(t.sourceFramework)}: {t.sourceCategoryId}
              </Badge>
            )}
          </p>
        </div>
        {canManage && (
          <div className="flex shrink-0 flex-col items-end gap-1">
            {t.status === "SUGGESTED" && (
              <>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      m.setThreatStatus.mutate({ id: t.id, status: "ACCEPTED" }, { onError: fail })
                    }
                  >
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      m.setThreatStatus.mutate({ id: t.id, status: "DISMISSED" }, { onError: fail })
                    }
                  >
                    Dismiss
                  </Button>
                </div>
              </>
            )}
            {(t.status === "SUGGESTED" || t.status === "ACCEPTED") && t.sourceFramework && (
              <Button
                size="sm"
                variant="primary"
                onClick={() =>
                  m.promote.mutate(t.id, {
                    onSuccess: () => toast.success("Draft risk created"),
                    onError: fail,
                  })
                }
              >
                Promote to risk
              </Button>
            )}
            {t.status === "PROMOTED" && t.promotedRiskId && (
              <Button size="sm" variant="ghost" onClick={() => onOpenRisk(t.promotedRiskId!)}>
                Open risk →
              </Button>
            )}
            {t.status === "DISMISSED" && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  m.setThreatStatus.mutate({ id: t.id, status: "SUGGESTED" }, { onError: fail })
                }
              >
                Restore
              </Button>
            )}
          </div>
        )}
      </div>
    </li>
  );

  const grouped: [string, TMThreat[]][] = [
    ["Open", model.threats.filter((t) => t.status === "SUGGESTED" || t.status === "ACCEPTED")],
    ["Promoted to risks", model.threats.filter((t) => t.status === "PROMOTED")],
    ["Dismissed", model.threats.filter((t) => t.status === "DISMISSED")],
  ];

  return (
    <section className="mx-auto max-w-5xl px-6 py-6">
      {back}

      <Card>
        <CardHeader
          title={model.title}
          action={
            canManage && (
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={m.suggest.isPending}
                  onClick={() =>
                    m.suggest.mutate(undefined, {
                      onSuccess: (r) =>
                        toast.success(
                          r.added > 0 ? `${r.added} new threat(s) suggested` : "No new threats",
                        ),
                      onError: fail,
                    })
                  }
                >
                  <Sparkles className="h-3.5 w-3.5" /> Suggest threats
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (confirm("Delete this threat model? Promoted risks are kept.")) {
                      m.remove.mutate(undefined, { onSuccess: onBack, onError: fail });
                    }
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            )
          }
        />
        <CardBody>
          {report && (
            <div className="mb-4 flex flex-wrap gap-3 text-xs text-subtle">
              <span>{report.summary.elements} elements</span>
              <span>{report.summary.flows} flows</span>
              <span>{report.summary.trustBoundaries} boundaries</span>
              <span>{report.summary.crossBoundaryFlows} cross-boundary</span>
              <span>{report.summary.threats} threats</span>
              <span>{report.summary.promoted} promoted</span>
            </div>
          )}
          {report && <ThreatModelDiagram diagram={report.diagram} />}
        </CardBody>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Trust boundaries */}
        <Card>
          <CardHeader title="Trust boundaries" />
          <CardBody>
            {model.trustBoundaries.length === 0 && <EmptyState title="None yet." />}
            <ul className="space-y-1">
              {model.trustBoundaries.map((b) => (
                <li key={b.id} className="flex items-center justify-between text-sm">
                  <span>{b.name}</span>
                  {canManage && (
                    <button
                      className="text-xs text-danger hover:underline"
                      onClick={() => m.deleteBoundary.mutate(b.id, { onError: fail })}
                    >
                      Remove
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {canManage && (
              <div className="mt-3 flex gap-2">
                <Input
                  id="tm-boundary"
                  aria-label="New trust boundary name"
                  placeholder="e.g. Public internet"
                  value={boundaryName}
                  onChange={(e) => setBoundaryName(e.target.value)}
                />
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!boundaryName.trim()}
                  onClick={() =>
                    m.addBoundary.mutate(
                      { name: boundaryName.trim() },
                      { onSuccess: () => setBoundaryName(""), onError: fail },
                    )
                  }
                >
                  Add
                </Button>
              </div>
            )}
          </CardBody>
        </Card>

        {/* Elements */}
        <Card>
          <CardHeader title="Elements" />
          <CardBody>
            {model.elements.length === 0 && <EmptyState title="None yet." />}
            <ul className="space-y-2">
              {model.elements.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate">
                    <Badge variant="neutral">{label(e.type)}</Badge> {e.name}
                  </span>
                  {canManage && (
                    <span className="flex items-center gap-2">
                      <Select
                        aria-label={`Trust boundary for ${e.name}`}
                        value={e.trustBoundaryId ?? ""}
                        onChange={(ev) =>
                          m.updateElement.mutate(
                            { id: e.id, trustBoundaryId: ev.target.value || null },
                            { onError: fail },
                          )
                        }
                      >
                        <option value="">no boundary</option>
                        {model.trustBoundaries.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </Select>
                      <button
                        className="text-xs text-danger hover:underline"
                        onClick={() => m.deleteElement.mutate(e.id, { onError: fail })}
                      >
                        Remove
                      </button>
                    </span>
                  )}
                </li>
              ))}
            </ul>
            {canManage && (
              <div className="mt-3 flex flex-wrap gap-2">
                <Select
                  aria-label="New element type"
                  value={el.type}
                  onChange={(e) =>
                    setEl((s) => ({ ...s, type: e.target.value as ThreatModelElementType }))
                  }
                >
                  {THREAT_MODEL_ELEMENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {label(t)}
                    </option>
                  ))}
                </Select>
                <Input
                  id="tm-el-name"
                  aria-label="New element name"
                  placeholder="Name"
                  value={el.name}
                  onChange={(e) => setEl((s) => ({ ...s, name: e.target.value }))}
                />
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!el.name.trim()}
                  onClick={() =>
                    m.addElement.mutate(
                      { type: el.type, name: el.name.trim() },
                      { onSuccess: () => setEl((s) => ({ ...s, name: "" })), onError: fail },
                    )
                  }
                >
                  Add
                </Button>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Flows */}
      <Card className="mt-6">
        <CardHeader title="Flows" />
        <CardBody>
          {model.flows.length === 0 && <EmptyState title="No flows yet." />}
          <ul className="space-y-1">
            {model.flows.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-2 text-sm">
                <span>
                  {elementName(f.sourceId)} → {elementName(f.targetId)}
                  <span className="text-subtle"> · {f.label}</span>
                  {!f.authenticated && <Badge variant="warning"> unauth</Badge>}
                  {!f.encrypted && <Badge variant="warning"> plaintext</Badge>}
                </span>
                {canManage && (
                  <button
                    className="text-xs text-danger hover:underline"
                    onClick={() => m.deleteFlow.mutate(f.id, { onError: fail })}
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
          {canManage && model.elements.length >= 2 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Select
                aria-label="Flow source"
                value={flow.sourceId}
                onChange={(e) => setFlow((s) => ({ ...s, sourceId: e.target.value }))}
              >
                <option value="">from…</option>
                {model.elements.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </Select>
              <Select
                aria-label="Flow target"
                value={flow.targetId}
                onChange={(e) => setFlow((s) => ({ ...s, targetId: e.target.value }))}
              >
                <option value="">to…</option>
                {model.elements.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </Select>
              <Input
                id="tm-flow-label"
                aria-label="Flow label"
                placeholder="label"
                value={flow.label}
                onChange={(e) => setFlow((s) => ({ ...s, label: e.target.value }))}
              />
              <label className="flex items-center gap-1 text-xs">
                <input
                  type="checkbox"
                  checked={flow.authenticated}
                  onChange={(e) => setFlow((s) => ({ ...s, authenticated: e.target.checked }))}
                />
                auth
              </label>
              <label className="flex items-center gap-1 text-xs">
                <input
                  type="checkbox"
                  checked={flow.encrypted}
                  onChange={(e) => setFlow((s) => ({ ...s, encrypted: e.target.checked }))}
                />
                encrypted
              </label>
              <Button
                size="sm"
                variant="secondary"
                disabled={!flow.sourceId || !flow.targetId || !flow.label.trim()}
                onClick={() =>
                  m.addFlow.mutate(
                    { ...flow, label: flow.label.trim() },
                    {
                      onSuccess: () =>
                        setFlow({
                          sourceId: "",
                          targetId: "",
                          label: "",
                          authenticated: false,
                          encrypted: false,
                        }),
                      onError: fail,
                    },
                  )
                }
              >
                Add flow
              </Button>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Threats */}
      <Card className="mt-6">
        <CardHeader title="Threats" />
        <CardBody>
          {model.threats.length === 0 ? (
            <EmptyState title='No threats yet — add your data flows, then "Suggest threats".' />
          ) : (
            <div className="space-y-4">
              {grouped.map(([heading, list]) =>
                list.length === 0 ? null : (
                  <div key={heading}>
                    <p className="mb-2 text-sm font-semibold text-text">
                      {heading} ({list.length})
                    </p>
                    <ul className="space-y-2">
                      {list.map((t) => (
                        <ThreatRow key={t.id} t={t} />
                      ))}
                    </ul>
                  </div>
                ),
              )}
            </div>
          )}
        </CardBody>
      </Card>
    </section>
  );
}
