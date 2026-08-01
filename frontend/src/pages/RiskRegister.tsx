import { FormEvent, useState } from "react";
import { RiskHeatmap } from "../components/RiskHeatmap";
import { RiskTable } from "../components/RiskTable";

type Asset = { id: string; name: string };
type FrameworkCategory = { framework: string; categoryId: string; name: string };
type Risk = {
  id: string;
  assetId: string;
  description: string;
  sourceFramework: string;
  sourceCategoryId: string;
  euAiActRiskTier?: string | null;
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
  filters: Filters;
  riskForm: RiskForm;
  editingRiskId: string | null;
  selectedRiskIds: string[];
  label: (value: string) => string;
  onFiltersChange: (filters: Filters) => void;
  onRiskFormChange: (form: RiskForm) => void;
  onSubmitRisk: (event: FormEvent) => void;
  onNewRisk: () => void;
  onEditRisk: (risk: Risk) => void;
  onOpenRisk: (id: string) => void;
  onToggleRisk: (id: string) => void;
  onBulkUpdate: (status: string) => void;
};

export default function RiskRegister(props: Props) {
  const [heatmapFilter, setHeatmapFilter] = useState<{ likelihood: number; impact: number } | null>(null);
  const filteredCategories = props.categories.filter((category) => category.framework === props.riskForm.sourceFramework);
  const displayedRisks = heatmapFilter ? props.risks.filter((risk) => risk.likelihood === heatmapFilter.likelihood && risk.impact === heatmapFilter.impact) : props.risks;
  const updateFilter = (key: keyof Filters, value: string) => props.onFiltersChange({ ...props.filters, [key]: value });
  const updateForm = (key: keyof RiskForm, value: string | number) => props.onRiskFormChange({ ...props.riskForm, [key]: value });

  return (
    <section className="mx-auto grid max-w-7xl gap-6 px-6 py-8 xl:grid-cols-[1.2fr_0.8fr]">
      <div className="space-y-6">
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Risk Register</h2>
              <p className="mt-1 text-sm text-slate-500">Review, sort, and bulk-update portfolio risks.</p>
            </div>
            <button className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold" onClick={props.onNewRisk}>New risk</button>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <Select label="Risk Status" value={props.filters.riskStatus} options={["", "OPEN", "IN_PROGRESS", "MITIGATED", "ACCEPTED"]} onChange={(value) => updateFilter("riskStatus", value)} labelValue={props.label} />
            <Select label="Framework" value={props.filters.sourceFramework} options={["", "NIST_AI_RMF", "EU_AI_ACT", "OWASP_LLM_TOP10"]} onChange={(value) => updateFilter("sourceFramework", value)} labelValue={props.label} />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button className="rounded-lg bg-cyan-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40" disabled={!props.selectedRiskIds.length} onClick={() => props.onBulkUpdate("IN_PROGRESS")}>Bulk In Progress</button>
            <button className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40" disabled={!props.selectedRiskIds.length} onClick={() => props.onBulkUpdate("MITIGATED")}>Bulk Mitigated</button>
          </div>

          {heatmapFilter && <button className="mt-4 text-sm font-semibold text-cyan-700" onClick={() => setHeatmapFilter(null)}>Clear heatmap filter</button>}
          <RiskHeatmap risks={props.risks} onCellClick={setHeatmapFilter} />
          <RiskTable risks={displayedRisks} selectedIds={props.selectedRiskIds} label={props.label} onToggle={props.onToggleRisk} onEdit={props.onEditRisk} onOpen={props.onOpenRisk} />
        </div>
      </div>

      <form onSubmit={props.onSubmitRisk} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-xl font-semibold">{props.editingRiskId ? "Edit Risk" : "Create Risk"}</h2>
        <div className="mt-4 grid gap-4">
          <Select label="Asset" value={props.riskForm.assetId} options={props.assets.map((asset) => asset.id)} optionLabels={Object.fromEntries(props.assets.map((asset) => [asset.id, asset.name]))} onChange={(value) => updateForm("assetId", value)} labelValue={props.label} />
          <Select label="Framework" value={props.riskForm.sourceFramework} options={["NIST_AI_RMF", "EU_AI_ACT", "OWASP_LLM_TOP10"]} onChange={(value) => updateForm("sourceFramework", value)} labelValue={props.label} />
          <Select label="Category" value={props.riskForm.sourceCategoryId} options={filteredCategories.map((category) => category.categoryId)} optionLabels={Object.fromEntries(filteredCategories.map((category) => [category.categoryId, `${category.categoryId} - ${category.name}`]))} onChange={(value) => updateForm("sourceCategoryId", value)} labelValue={props.label} />
          <Select label="EU AI Act Tier" value={props.riskForm.euAiActRiskTier} options={["", "UNACCEPTABLE", "HIGH", "LIMITED", "MINIMAL"]} optionLabels={{ "": "Not applicable" }} onChange={(value) => updateForm("euAiActRiskTier", value)} labelValue={props.label} />
          <Select label="Likelihood" value={String(props.riskForm.likelihood)} options={["1", "2", "3", "4", "5"]} onChange={(value) => updateForm("likelihood", Number(value))} labelValue={props.label} />
          <Select label="Impact" value={String(props.riskForm.impact)} options={["1", "2", "3", "4", "5"]} onChange={(value) => updateForm("impact", Number(value))} labelValue={props.label} />
          <Field label="Residual Risk Score" value={props.riskForm.residualRiskScore} onChange={(value) => updateForm("residualRiskScore", value)} />
          <Select label="Status" value={props.riskForm.status} options={["OPEN", "IN_PROGRESS", "MITIGATED", "ACCEPTED"]} onChange={(value) => updateForm("status", value)} labelValue={props.label} />
          <TextArea label="Description" value={props.riskForm.description} onChange={(value) => updateForm("description", value)} />
          <TextArea label="Treatment Plan" value={props.riskForm.treatmentPlan} onChange={(value) => updateForm("treatmentPlan", value)} />
          <Field label="Owner" value={props.riskForm.owner} onChange={(value) => updateForm("owner", value)} />
          <Field label="Due Date" type="date" value={props.riskForm.dueDate} onChange={(value) => updateForm("dueDate", value)} />
        </div>
        <button className="mt-5 rounded-lg bg-cyan-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40" disabled={!props.riskForm.assetId}>{props.editingRiskId ? "Save risk" : "Create risk"}</button>
      </form>
    </section>
  );
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

function Select(props: { label: string; value: string; options: string[]; optionLabels?: Record<string, string>; onChange: (value: string) => void; labelValue: (value: string) => string }) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {props.label}
      <select className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950" value={props.value} onChange={(event) => props.onChange(event.target.value)}>
        {props.options.map((option) => <option key={option} value={option}>{props.optionLabels?.[option] ?? (option ? props.labelValue(option) : "All")}</option>)}
      </select>
    </label>
  );
}
