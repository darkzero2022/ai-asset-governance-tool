type Filters = {
  assetStatus: string;
  assetType: string;
  hostingModel: string;
  networkDependency: string;
  riskStatus: string;
  sourceFramework: string;
};

type RiskFiltersProps = {
  filters: Filters;
  onChange: (filters: Filters) => void;
};

export function RiskFilters({ filters, onChange }: RiskFiltersProps) {
  const update = (key: keyof Filters, value: string) => onChange({ ...filters, [key]: value });

  return (
    <div className="mt-4 grid gap-3 md:grid-cols-3">
      <Filter label="Asset Status" value={filters.assetStatus} options={["", "DRAFT", "UNDER_REVIEW", "APPROVED", "DEPLOYED", "RETIRED"]} onChange={(value) => update("assetStatus", value)} />
      <Filter label="Asset Type" value={filters.assetType} options={["", "MODEL", "DATASET", "SERVICE", "LIBRARY"]} onChange={(value) => update("assetType", value)} />
      <Filter label="Hosting" value={filters.hostingModel} options={["", "SAAS_API", "SELF_HOSTED", "EMBEDDED_IN_APP"]} onChange={(value) => update("hostingModel", value)} />
      <Filter label="Network" value={filters.networkDependency} options={["", "AIR_GAPPED", "HYBRID", "FULLY_CONNECTED"]} onChange={(value) => update("networkDependency", value)} />
      <Filter label="Risk Status" value={filters.riskStatus} options={["", "OPEN", "IN_PROGRESS", "MITIGATED", "ACCEPTED"]} onChange={(value) => update("riskStatus", value)} />
      <Filter label="Framework" value={filters.sourceFramework} options={["", "NIST_AI_RMF", "EU_AI_ACT", "OWASP_LLM_TOP10"]} onChange={(value) => update("sourceFramework", value)} />
    </div>
  );
}

function Filter({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <label className="text-sm font-medium text-slate-700">{label}<select className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option} value={option}>{option || "All"}</option>)}</select></label>;
}
