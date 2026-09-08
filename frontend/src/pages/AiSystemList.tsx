import { FormEvent } from "react";
import { AiSystemTable } from "../components/AiSystemTable";
import { PageHeader } from "../components/shell/PageHeader";
import { Dialog, DialogFooter, DialogHeader, RadixDialog } from "../components/ui/Dialog";
import { Button } from "../components/ui/Button";
import { Input, Select, TextArea } from "../components/ui/Field";

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

type AssetFilters = {
  assetStatus: string;
  assetType: string;
  hostingModel: string;
  networkDependency: string;
  riskStatus: string;
  sourceFramework: string;
};

type Props = {
  assets: Asset[];
  filters: AssetFilters;
  assetForm: AssetForm;
  editingAssetId: string | null;
  dialogOpen: boolean;
  label: (value: string) => string;
  onFiltersChange: (filters: AssetFilters) => void;
  onFormChange: (form: AssetForm) => void;
  importSuggestion: ImportSuggestion | null;
  onFetchImport: (sourceUrl: string) => void;
  onSubmit: (event: FormEvent) => void;
  onNewAiSystem: () => void;
  onDialogOpenChange: (open: boolean) => void;
  onSelect: (id: string) => void;
  onEdit: (asset: Asset) => void;
  onExport: (assetId: string) => void;
  /** ADMIN/RISK_OWNER only — VIEWER (and APPROVER, here) get read-only access. */
  canManage: boolean;
  isLoading?: boolean;
};

const STATUS_OPTIONS = ["", "DRAFT", "UNDER_REVIEW", "APPROVED", "DEPLOYED", "RETIRED"];
const TYPE_OPTIONS = ["MODEL", "DATASET", "SERVICE", "LIBRARY"];
const HOSTING_OPTIONS = ["SAAS_API", "SELF_HOSTED", "EMBEDDED_IN_APP"];
const NETWORK_OPTIONS = ["AIR_GAPPED", "HYBRID", "FULLY_CONNECTED"];

export default function AiSystemList(props: Props) {
  const updateFilter = (key: keyof AssetFilters, value: string) => props.onFiltersChange({ ...props.filters, [key]: value });
  const updateForm = (key: keyof AssetForm, value: string) => props.onFormChange({ ...props.assetForm, [key]: value });

  return (
    <section className="mx-auto max-w-7xl px-6 py-6">
      <PageHeader
        title="AI Systems"
        description="Inventory of AI systems, filtered by lifecycle, type, hosting, and network dependency."
        action={props.canManage && <Button variant="primary" onClick={props.onNewAiSystem}>New AI system</Button>}
        filters={
          <div className="grid gap-3 md:grid-cols-4">
            <Select label="Status" value={props.filters.assetStatus} onChange={(event) => updateFilter("assetStatus", event.target.value)}>
              {STATUS_OPTIONS.map((option) => <option key={option} value={option}>{option ? props.label(option) : "All"}</option>)}
            </Select>
            <Select label="Type" value={props.filters.assetType} onChange={(event) => updateFilter("assetType", event.target.value)}>
              <option value="">All</option>
              {TYPE_OPTIONS.map((option) => <option key={option} value={option}>{props.label(option)}</option>)}
            </Select>
            <Select label="Hosting" value={props.filters.hostingModel} onChange={(event) => updateFilter("hostingModel", event.target.value)}>
              <option value="">All</option>
              {HOSTING_OPTIONS.map((option) => <option key={option} value={option}>{props.label(option)}</option>)}
            </Select>
            <Select label="Network" value={props.filters.networkDependency} onChange={(event) => updateFilter("networkDependency", event.target.value)}>
              <option value="">All</option>
              {NETWORK_OPTIONS.map((option) => <option key={option} value={option}>{props.label(option)}</option>)}
            </Select>
          </div>
        }
      />

      <AiSystemTable
        assets={props.assets}
        label={props.label}
        onSelect={props.onSelect}
        onEdit={props.canManage ? props.onEdit : undefined}
        onExport={props.onExport}
      />

      {props.canManage && (
        <Dialog open={props.dialogOpen} onOpenChange={props.onDialogOpenChange} size="lg">
          <DialogHeader
            title={props.editingAssetId ? "Edit AI system" : "New AI system"}
            description="Describe the model, dataset, service, or library and its supply-chain context."
          />
          <form onSubmit={props.onSubmit}>
            <div className="max-h-[65vh] space-y-4 overflow-y-auto pr-1">
              <Input label="Name" value={props.assetForm.name} onChange={(event) => updateForm("name", event.target.value)} />
              <div className="rounded-md border border-border p-3">
                <div className="flex gap-2">
                  <div className="min-w-0 flex-1"><Input label="Import from URL" value={props.assetForm.sourceUrl} onChange={(event) => updateForm("sourceUrl", event.target.value)} /></div>
                  <Button type="button" variant="secondary" className="self-end" disabled={!props.assetForm.sourceUrl} onClick={() => props.onFetchImport(props.assetForm.sourceUrl)}>Fetch</Button>
                </div>
                {props.importSuggestion && <ImportPreview suggestion={props.importSuggestion} />}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Version" value={props.assetForm.version} onChange={(event) => updateForm("version", event.target.value)} />
                <Select label="Type" value={props.assetForm.type} onChange={(event) => updateForm("type", event.target.value)}>
                  {TYPE_OPTIONS.map((option) => <option key={option} value={option}>{props.label(option)}</option>)}
                </Select>
                <Select label="Hosting Model" value={props.assetForm.hostingModel} onChange={(event) => updateForm("hostingModel", event.target.value)}>
                  {HOSTING_OPTIONS.map((option) => <option key={option} value={option}>{props.label(option)}</option>)}
                </Select>
                <Select label="Network Dependency" value={props.assetForm.networkDependency} onChange={(event) => updateForm("networkDependency", event.target.value)}>
                  {NETWORK_OPTIONS.map((option) => <option key={option} value={option}>{props.label(option)}</option>)}
                </Select>
                <Input label="Supplier" value={props.assetForm.supplier} onChange={(event) => updateForm("supplier", event.target.value)} />
                <Input label="Provider" value={props.assetForm.provider ?? ""} onChange={(event) => updateForm("provider", event.target.value)} />
                <Input label="License" value={props.assetForm.license ?? ""} onChange={(event) => updateForm("license", event.target.value)} />
                <Input label="Data Classification" value={props.assetForm.dataClassificationTouched ?? ""} onChange={(event) => updateForm("dataClassificationTouched", event.target.value)} />
              </div>
              <TextArea label="Training Data Provenance" value={props.assetForm.trainingDataProvenance ?? ""} onChange={(event) => updateForm("trainingDataProvenance", event.target.value)} />
              <TextArea label="Downstream Consumers" value={props.assetForm.downstreamConsumers ?? ""} onChange={(event) => updateForm("downstreamConsumers", event.target.value)} />
            </div>
            <DialogFooter>
              <RadixDialog.Close asChild>
                <Button type="button" variant="secondary" size="sm">Cancel</Button>
              </RadixDialog.Close>
              <Button type="submit" variant="primary" size="sm">{props.editingAssetId ? "Save AI system" : "Create AI system"}</Button>
            </DialogFooter>
          </form>
        </Dialog>
      )}
    </section>
  );
}

function ImportPreview(props: { suggestion: ImportSuggestion }) {
  return (
    <div className="mt-3 rounded-md bg-surface-alt p-3 text-xs text-subtle ring-1 ring-border">
      <p className="font-semibold text-text">Fetched suggestion</p>
      <p className="mt-1"><span className="font-medium text-text">Title:</span> {props.suggestion.suggestedTitle || "Not found"}</p>
      <p className="mt-1"><span className="font-medium text-text">Description:</span> {props.suggestion.suggestedDescription || "Not found"}</p>
      <p className="mt-1"><span className="font-medium text-text">Excerpt:</span> {props.suggestion.excerpt || "Not found"}</p>
    </div>
  );
}
