import { FormEvent, useEffect, useState } from "react";
import { RiskHeatmap } from "../components/RiskHeatmap";
import { RiskTable } from "../components/RiskTable";
import { PageHeader } from "../components/shell/PageHeader";
import { Button } from "../components/ui/Button";
import { Input, Select, TextArea } from "../components/ui/Field";
import { Combobox } from "../components/ui/Combobox";
import { Dialog, DialogFooter, DialogHeader, RadixDialog } from "../components/ui/Dialog";
import { frameworkLabel } from "../formDefaults";

type Asset = { id: string; name: string; dataClassificationTouched?: string | null };
type FrameworkCategory = { framework: string; categoryId: string; name: string };
type FrameworkMetaLite = { framework: string; title: string; revision: string; status: string };

// Frameworks whose categories the backend auto-fills STRIDE-AI / ATLAS from.
const AUTO_FILL_FRAMEWORKS = ["OWASP_LLM_TOP10", "OWASP_MCP_TOP10"];

const STRIDE_AI_CATEGORIES = [
  "MODEL_IMPERSONATION",
  "DATA_MODEL_POISONING",
  "PROVENANCE_LOSS",
  "MODEL_INVERSION",
  "RESOURCE_EXHAUSTION",
  "ALIGNMENT_BYPASS",
];

type Risk = {
  id: string;
  assetId: string;
  description: string;
  sourceFramework: string;
  sourceCategoryId: string;
  euAiActRiskTier?: string | null;
  strideAiCategory?: string | null;
  atlasTechnique?: string | null;
  atlasMitigations?: string[];
  likelihood: number;
  impact: number;
  inherentRiskScore: number;
  residualRiskScore?: number | null;
  treatmentPlan?: string | null;
  owner?: string | null;
  dueDate?: string | null;
  status: string;
  severity?: string | null;
  asset?: { name: string } | null;
};

type RiskForm = {
  assetId: string;
  sourceFramework: string;
  sourceCategoryId: string;
  euAiActRiskTier: string;
  strideAiCategory: string;
  atlasTechnique: string;
  atlasMitigations: string[];
  description: string;
  likelihood: number;
  impact: number;
  residualRiskScore: string;
  treatmentPlan: string;
  owner: string;
  dueDate: string;
  status: string;
};

type Filters = {
  assetStatus: string;
  assetType: string;
  hostingModel: string;
  networkDependency: string;
  riskStatus: string;
  sourceFramework: string;
};

type Props = {
  risks: Risk[];
  assets: Asset[];
  categories: FrameworkCategory[];
  frameworks: FrameworkMetaLite[];
  atlasTechniques: string[];
  atlasMitigations: string[];
  filters: Filters;
  riskForm: RiskForm;
  editingRiskId: string | null;
  dialogOpen: boolean;
  selectedRiskIds: string[];
  label: (value: string) => string;
  onFiltersChange: (filters: Filters) => void;
  onRiskFormChange: (form: RiskForm) => void;
  onSubmitRisk: (event: FormEvent) => void;
  onNewRisk: () => void;
  onDialogOpenChange: (open: boolean) => void;
  onEditRisk: (risk: Risk) => void;
  onOpenRisk: (id: string) => void;
  onToggleRisk: (id: string) => void;
  onBulkUpdate: (status: string) => void;
  canManage: boolean;
  isLoading?: boolean;
};

function SectionLabel({ children }: { children: string }) {
  return <p className="text-xs font-semibold uppercase tracking-wide text-subtle">{children}</p>;
}

export default function RiskRegister(props: Props) {
  const [heatmapFilter, setHeatmapFilter] = useState<{ likelihood: number; impact: number } | null>(
    null,
  );
  const [strideFilter, setStrideFilter] = useState("");
  const filteredCategories = props.categories.filter(
    (category) => category.framework === props.riskForm.sourceFramework,
  );
  const frameworkOptions =
    props.frameworks.length > 0
      ? props.frameworks
      : [...new Set(props.categories.map((category) => category.framework))].map((framework) => ({
          framework,
          title: frameworkLabel(framework),
          revision: "",
          status: "RELEASED",
        }));
  const frameworkOptionLabel = (option: FrameworkMetaLite) =>
    `${frameworkLabel(option.framework)}${option.status === "DRAFT" ? " (draft)" : ""}`;
  const selectedFrameworkMeta = props.frameworks.find(
    (framework) => framework.framework === props.riskForm.sourceFramework,
  );
  const displayedRisks = props.risks.filter((risk) => {
    if (
      heatmapFilter &&
      (risk.likelihood !== heatmapFilter.likelihood || risk.impact !== heatmapFilter.impact)
    )
      return false;
    if (strideFilter && (risk.strideAiCategory ?? "") !== strideFilter) return false;
    return true;
  });
  const selectedAsset = props.assets.find((asset) => asset.id === props.riskForm.assetId);
  const suggestedEuTier = suggestEuAiActTier(selectedAsset, props.riskForm.sourceCategoryId);
  const updateFilter = (key: keyof Filters, value: string) =>
    props.onFiltersChange({ ...props.filters, [key]: value });
  const updateForm = (key: keyof RiskForm, value: string | number | string[]) =>
    props.onRiskFormChange({ ...props.riskForm, [key]: value });

  function toggleMitigation(name: string) {
    const current = props.riskForm.atlasMitigations;
    updateForm(
      "atlasMitigations",
      current.includes(name) ? current.filter((item) => item !== name) : [...current, name],
    );
  }

  useEffect(() => {
    if (!props.riskForm.euAiActRiskTier && suggestedEuTier) {
      props.onRiskFormChange({ ...props.riskForm, euAiActRiskTier: suggestedEuTier });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestedEuTier, props.riskForm.assetId, props.riskForm.sourceCategoryId]);

  return (
    <section className="mx-auto max-w-7xl px-6 py-6">
      <PageHeader
        title="Risk Register"
        description="Threats mapped to NIST AI RMF, OWASP LLM & MCP Top 10, STRIDE-AI, and MITRE ATLAS — with ATLAS-mapped remediation."
        action={
          props.canManage && (
            <Button variant="primary" onClick={props.onNewRisk}>
              New risk
            </Button>
          )
        }
        filters={
          <div className="grid gap-3 md:grid-cols-3">
            <Select
              label="Risk Status"
              value={props.filters.riskStatus}
              onChange={(event) => updateFilter("riskStatus", event.target.value)}
            >
              <option value="">All</option>
              {["OPEN", "IN_PROGRESS", "MITIGATED", "ACCEPTED"].map((option) => (
                <option key={option} value={option}>
                  {props.label(option)}
                </option>
              ))}
            </Select>
            <Select
              label="Framework"
              value={props.filters.sourceFramework}
              onChange={(event) => updateFilter("sourceFramework", event.target.value)}
            >
              <option value="">All</option>
              {frameworkOptions.map((option) => (
                <option key={option.framework} value={option.framework}>
                  {frameworkOptionLabel(option)}
                </option>
              ))}
            </Select>
            <Select
              label="STRIDE-AI"
              value={strideFilter}
              onChange={(event) => setStrideFilter(event.target.value)}
            >
              <option value="">All</option>
              {STRIDE_AI_CATEGORIES.map((option) => (
                <option key={option} value={option}>
                  {props.label(option)}
                </option>
              ))}
            </Select>
          </div>
        }
      />

      <div className="space-y-4">
        {(heatmapFilter || strideFilter) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setHeatmapFilter(null);
              setStrideFilter("");
            }}
          >
            Clear table filters
          </Button>
        )}
        <RiskHeatmap risks={props.risks} onCellClick={setHeatmapFilter} />
        <RiskTable
          risks={displayedRisks}
          selectedIds={props.selectedRiskIds}
          label={props.label}
          onToggle={props.onToggleRisk}
          onEdit={props.canManage ? props.onEditRisk : undefined}
          onOpen={props.onOpenRisk}
          bulkActions={
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => props.onBulkUpdate("IN_PROGRESS")}
              >
                Mark In Progress
              </Button>
              <Button variant="primary" size="sm" onClick={() => props.onBulkUpdate("MITIGATED")}>
                Mark Mitigated
              </Button>
            </>
          }
        />
      </div>

      {props.canManage && (
        <Dialog open={props.dialogOpen} onOpenChange={props.onDialogOpenChange} size="lg">
          <DialogHeader
            title={props.editingRiskId ? "Edit risk" : "New risk"}
            description="Classify the threat against a framework category, STRIDE-AI, and MITRE ATLAS, then map the remediation to ATLAS mitigations."
          />
          <form onSubmit={props.onSubmitRisk}>
            <div className="max-h-[65vh] space-y-5 overflow-y-auto pr-1">
              <div className="space-y-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-text">AI System</label>
                  <Combobox
                    value={props.riskForm.assetId}
                    onChange={(value) => updateForm("assetId", value)}
                    options={props.assets.map((asset) => ({ value: asset.id, label: asset.name }))}
                    placeholder="Select AI system"
                  />
                </div>
                <TextArea
                  label="Description"
                  value={props.riskForm.description}
                  onChange={(event) => updateForm("description", event.target.value)}
                />
              </div>

              <div className="space-y-3 rounded-md border border-border p-3">
                <SectionLabel>Threat classification</SectionLabel>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Select
                    label="Framework"
                    value={props.riskForm.sourceFramework}
                    onChange={(event) => updateForm("sourceFramework", event.target.value)}
                  >
                    {frameworkOptions.map((option) => (
                      <option key={option.framework} value={option.framework}>
                        {frameworkOptionLabel(option)}
                      </option>
                    ))}
                  </Select>
                  <Select
                    label="Category"
                    value={props.riskForm.sourceCategoryId}
                    onChange={(event) => updateForm("sourceCategoryId", event.target.value)}
                  >
                    {filteredCategories.map((category) => (
                      <option key={category.categoryId} value={category.categoryId}>
                        {category.categoryId} - {category.name}
                      </option>
                    ))}
                  </Select>
                  <Select
                    label="EU AI Act Tier"
                    value={props.riskForm.euAiActRiskTier}
                    onChange={(event) => updateForm("euAiActRiskTier", event.target.value)}
                  >
                    <option value="">Not applicable</option>
                    {["UNACCEPTABLE", "HIGH", "LIMITED", "MINIMAL"].map((option) => (
                      <option key={option} value={option}>
                        {props.label(option)}
                      </option>
                    ))}
                  </Select>
                  <Select
                    label="STRIDE-AI Category"
                    value={props.riskForm.strideAiCategory}
                    onChange={(event) => updateForm("strideAiCategory", event.target.value)}
                  >
                    <option value="">Auto from framework category</option>
                    {STRIDE_AI_CATEGORIES.map((option) => (
                      <option key={option} value={option}>
                        {props.label(option)}
                      </option>
                    ))}
                  </Select>
                  <Select
                    label="MITRE ATLAS Technique"
                    value={props.riskForm.atlasTechnique}
                    onChange={(event) => updateForm("atlasTechnique", event.target.value)}
                    className="sm:col-span-2"
                  >
                    <option value="">Auto from framework category</option>
                    {props.atlasTechniques.map((technique) => (
                      <option key={technique} value={technique}>
                        {technique}
                      </option>
                    ))}
                  </Select>
                </div>
                {suggestedEuTier && (
                  <p className="text-xs text-subtle">
                    Suggested EU AI Act tier: {props.label(suggestedEuTier)}. Confirm or override
                    before saving.
                  </p>
                )}
                {selectedFrameworkMeta?.status === "DRAFT" && (
                  <p className="text-xs text-warning">
                    {frameworkLabel(selectedFrameworkMeta.framework)} is a draft (
                    {selectedFrameworkMeta.revision}) — categories and mappings may change.
                  </p>
                )}
                {AUTO_FILL_FRAMEWORKS.includes(props.riskForm.sourceFramework) &&
                  !props.riskForm.strideAiCategory &&
                  !props.riskForm.atlasTechnique && (
                    <p className="text-xs text-subtle">
                      STRIDE-AI, ATLAS technique, and suggested ATLAS mitigations will be
                      auto-filled from {props.riskForm.sourceCategoryId} on save. Pick a value to
                      override.
                    </p>
                  )}
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <Select
                  label="Likelihood"
                  value={String(props.riskForm.likelihood)}
                  onChange={(event) => updateForm("likelihood", Number(event.target.value))}
                >
                  {["1", "2", "3", "4", "5"].map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </Select>
                <Select
                  label="Impact"
                  value={String(props.riskForm.impact)}
                  onChange={(event) => updateForm("impact", Number(event.target.value))}
                >
                  {["1", "2", "3", "4", "5"].map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </Select>
                <Select
                  label="Status"
                  value={props.riskForm.status}
                  onChange={(event) => updateForm("status", event.target.value)}
                >
                  {["OPEN", "IN_PROGRESS", "MITIGATED", "ACCEPTED"].map((option) => (
                    <option key={option} value={option}>
                      {props.label(option)}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-3 rounded-md border border-border p-3">
                <SectionLabel>Remediation action plan</SectionLabel>
                <TextArea
                  label="Treatment plan"
                  value={props.riskForm.treatmentPlan}
                  onChange={(event) => updateForm("treatmentPlan", event.target.value)}
                />
                <div>
                  <p className="mb-1.5 text-sm font-medium text-text">MITRE ATLAS mitigations</p>
                  <div className="max-h-44 space-y-1 overflow-y-auto rounded-md border border-border bg-surface-alt p-2">
                    {props.atlasMitigations.map((name) => (
                      <label
                        key={name}
                        className="flex cursor-pointer items-start gap-2 rounded px-1 py-1 text-sm text-text hover:bg-surface"
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={props.riskForm.atlasMitigations.includes(name)}
                          onChange={() => toggleMitigation(name)}
                        />
                        <span>{name}</span>
                      </label>
                    ))}
                    {!props.atlasMitigations.length && (
                      <p className="px-1 text-sm text-subtle">Mitigation catalogue unavailable.</p>
                    )}
                  </div>
                  {props.riskForm.atlasMitigations.length > 0 && (
                    <p className="mt-1 text-xs text-subtle">
                      {props.riskForm.atlasMitigations.length} selected
                    </p>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Input
                    label="Residual risk score"
                    value={props.riskForm.residualRiskScore}
                    onChange={(event) => updateForm("residualRiskScore", event.target.value)}
                  />
                  <Input
                    label="Owner"
                    value={props.riskForm.owner}
                    onChange={(event) => updateForm("owner", event.target.value)}
                  />
                  <Input
                    label="Due date"
                    type="date"
                    value={props.riskForm.dueDate}
                    onChange={(event) => updateForm("dueDate", event.target.value)}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <RadixDialog.Close asChild>
                <Button type="button" variant="secondary" size="sm">
                  Cancel
                </Button>
              </RadixDialog.Close>
              <Button type="submit" variant="primary" size="sm" disabled={!props.riskForm.assetId}>
                {props.editingRiskId ? "Save risk" : "Create risk"}
              </Button>
            </DialogFooter>
          </form>
        </Dialog>
      )}
    </section>
  );
}

function suggestEuAiActTier(asset: Asset | undefined, categoryId: string) {
  if (categoryId === "UNACCEPTABLE") return "UNACCEPTABLE";
  if (categoryId === "HIGH") return "HIGH";
  if (categoryId === "LIMITED") return "LIMITED";
  if (categoryId === "MINIMAL") return "MINIMAL";

  const data = asset?.dataClassificationTouched?.toLowerCase() ?? "";
  if (
    /(biometric|health|medical|criminal|employment|education|credit|sensitive|protected)/.test(data)
  )
    return "HIGH";
  if (/(personal|customer|pii|identifier)/.test(data)) return "LIMITED";
  return "";
}
