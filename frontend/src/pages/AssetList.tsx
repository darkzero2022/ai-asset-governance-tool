import { FormEvent } from "react";
import { AssetTable } from "../components/AssetTable";

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
  label: (value: string) => string;
  onFiltersChange: (filters: AssetFilters) => void;
  onFormChange: (form: AssetForm) => void;
  onSubmit: (event: FormEvent) => void;
  onNewAsset: () => void;
  onSelect: (id: string) => void;
  onEdit: (asset: Asset) => void;
  onExport: (assetId: string) => void;
};

export default function AssetList(props: Props) {
  const updateFilter = (key: keyof AssetFilters, value: string) => props.onFiltersChange({ ...props.filters, [key]: value });
  const updateForm = (key: keyof AssetForm, value: string) => props.onFormChange({ ...props.assetForm, [key]: value });

  return (
    <section className="mx-auto grid max-w-7xl gap-6 px-6 py-8 xl:grid-cols-[1.2fr_0.8fr]">
      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Assets</h2>
            <p className="text-sm text-slate-500">Manage AI assets and filter by lifecycle, type, hosting, and network dependency.</p>
          </div>
          <button className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold" onClick={props.onNewAsset}>New asset</button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <Select label="Status" value={props.filters.assetStatus} options={["", "DRAFT", "UNDER_REVIEW", "APPROVED", "DEPLOYED", "RETIRED"]} onChange={(value) => updateFilter("assetStatus", value)} labelValue={props.label} />
          <Select label="Type" value={props.filters.assetType} options={["", "MODEL", "DATASET", "SERVICE", "LIBRARY"]} onChange={(value) => updateFilter("assetType", value)} labelValue={props.label} />
          <Select label="Hosting" value={props.filters.hostingModel} options={["", "SAAS_API", "SELF_HOSTED", "EMBEDDED_IN_APP"]} onChange={(value) => updateFilter("hostingModel", value)} labelValue={props.label} />
          <Select label="Network" value={props.filters.networkDependency} options={["", "AIR_GAPPED", "HYBRID", "FULLY_CONNECTED"]} onChange={(value) => updateFilter("networkDependency", value)} labelValue={props.label} />
        </div>

        <AssetTable assets={props.assets} label={props.label} onSelect={props.onSelect} onEdit={props.onEdit} onExport={props.onExport} />
      </div>

      <form onSubmit={props.onSubmit} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-xl font-semibold">{props.editingAssetId ? "Edit Asset" : "Create Asset"}</h2>
        <div className="mt-4 grid gap-4">
          <Field label="Name" value={props.assetForm.name} onChange={(value) => updateForm("name", value)} />
          <Field label="Version" value={props.assetForm.version} onChange={(value) => updateForm("version", value)} />
          <Select label="Type" value={props.assetForm.type} options={["MODEL", "DATASET", "SERVICE", "LIBRARY"]} onChange={(value) => updateForm("type", value)} labelValue={props.label} />
          <Select label="Hosting Model" value={props.assetForm.hostingModel} options={["SAAS_API", "SELF_HOSTED", "EMBEDDED_IN_APP"]} onChange={(value) => updateForm("hostingModel", value)} labelValue={props.label} />
          <Select label="Network Dependency" value={props.assetForm.networkDependency} options={["AIR_GAPPED", "HYBRID", "FULLY_CONNECTED"]} onChange={(value) => updateForm("networkDependency", value)} labelValue={props.label} />
          <Field label="Supplier" value={props.assetForm.supplier} onChange={(value) => updateForm("supplier", value)} />
          <Field label="Provider" value={props.assetForm.provider ?? ""} onChange={(value) => updateForm("provider", value)} />
          <Field label="License" value={props.assetForm.license ?? ""} onChange={(value) => updateForm("license", value)} />
          <Field label="Data Classification" value={props.assetForm.dataClassificationTouched ?? ""} onChange={(value) => updateForm("dataClassificationTouched", value)} />
          <TextArea label="Training Data Provenance" value={props.assetForm.trainingDataProvenance ?? ""} onChange={(value) => updateForm("trainingDataProvenance", value)} />
          <TextArea label="Downstream Consumers" value={props.assetForm.downstreamConsumers ?? ""} onChange={(value) => updateForm("downstreamConsumers", value)} />
        </div>
        <button className="mt-5 rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white">{props.editingAssetId ? "Save asset" : "Create asset"}</button>
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

function Select(props: { label: string; value: string; options: string[]; onChange: (value: string) => void; labelValue: (value: string) => string }) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {props.label}
      <select className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950" value={props.value} onChange={(event) => props.onChange(event.target.value)}>
        {props.options.map((option) => <option key={option} value={option}>{option ? props.labelValue(option) : "All"}</option>)}
      </select>
    </label>
  );
}
