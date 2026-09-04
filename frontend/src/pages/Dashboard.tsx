import { FormEvent, type ReactNode, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart } from "../components/BarChart";
import { DonutChart } from "../components/DonutChart";
import { apiFetch } from "../api/client";

type DashboardProps = {
  token: string;
};

type Summary = {
  assetStatus?: Array<Record<string, unknown>>;
  assetType?: Array<Record<string, unknown>>;
  hostingModel?: Array<Record<string, unknown>>;
  networkDependency?: Array<Record<string, unknown>>;
  projectCount?: number;
  riskSeverityBuckets?: Record<string, number>;
  topAssets?: Array<{ id: string; name: string; projectUsageCount: number }>;
};

type SearchResults = {
  assets: Array<{ id: string; name: string }>;
  projects: Array<{ id: string; name: string }>;
  risks: Array<{ id: string; description: string }>;
};

type RecertificationItem = {
  id: string;
  nextDueDate: string;
  dueStatus: "OVERDUE" | "DUE_SOON";
  asset: { id: string; name: string; type: string };
};

type ModelCardCoverage = {
  total: number;
  withCard: number;
  withoutCard: number;
  averageCompleteness: number;
  missingAssets: Array<{ id: string; name: string; type: string; status: string }>;
};

type ModelMetricReport = {
  metrics: Array<{ id: string; metricName: string; metricValue: number; slice?: string | null; asset: { id: string; name: string }; task?: string | null; architectureFamily?: string | null }>;
  aggregate: Array<{ group: string; avg: number; min: number; max: number; count: number }>;
};

const severityColors: Record<string, string> = {
  LOW: "#10b981",
  MEDIUM: "#f59e0b",
  HIGH: "#f97316",
  CRITICAL: "#ef4444",
};

export default function Dashboard({ token }: DashboardProps) {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<Summary>({});
  const [exposures, setExposures] = useState<Array<Record<string, unknown>>>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>({ assets: [], projects: [], risks: [] });
  const [coverage, setCoverage] = useState<Array<{ id: string; framework: string; categoryId: string; name: string; riskCount: number }>>([]);
  const [riskSummary, setRiskSummary] = useState<{ total?: number; byFramework?: Record<string, number>; bySeverity?: Record<string, number> }>({});
  const [recertifications, setRecertifications] = useState<RecertificationItem[]>([]);
  const [modelCardCoverage, setModelCardCoverage] = useState<ModelCardCoverage>({ total: 0, withCard: 0, withoutCard: 0, averageCompleteness: 0, missingAssets: [] });
  const [metricName, setMetricName] = useState("accuracy");
  const [modelMetricReport, setModelMetricReport] = useState<ModelMetricReport>({ metrics: [], aggregate: [] });
  const [error, setError] = useState("");

  function api<T>(path: string): Promise<T> {
    return apiFetch<T>(path, { token });
  }

  useEffect(() => {
    Promise.all([
      api<Summary>("/dashboard/summary"),
      api<{ exposures: Array<Record<string, unknown>> }>("/dashboard/exposure"),
      api<{ coverage: Array<{ id: string; framework: string; categoryId: string; name: string; riskCount: number }> }>("/reports/framework-coverage"),
      api<{ total: number; byFramework: Record<string, number>; bySeverity: Record<string, number> }>("/reports/risk-summary"),
      api<{ recertifications: RecertificationItem[] }>("/dashboard/recertification"),
      api<ModelCardCoverage>("/dashboard/model-card-coverage"),
    ])
      .then(([summaryData, exposureData, coverageData, riskSummaryData, recertificationData, modelCardCoverageData]) => {
        setSummary(summaryData);
        setExposures(exposureData.exposures);
        setCoverage(coverageData.coverage);
        setRiskSummary(riskSummaryData);
        setRecertifications(recertificationData.recertifications);
        setModelCardCoverage(modelCardCoverageData);
      })
      .catch((err: Error) => setError(err.message));
  }, [token]);

  useEffect(() => {
    api<ModelMetricReport>(`/reports/model-metrics?metricName=${encodeURIComponent(metricName)}`)
      .then(setModelMetricReport)
      .catch((err: Error) => setError(err.message));
  }, [token, metricName]);

  async function search(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      setResults(await api<SearchResults>(`/search?q=${encodeURIComponent(query)}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    }
  }

  return (
    <section className="mx-auto max-w-7xl px-6 py-8">
      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-700">Dashboard</p>
        <h2 className="mt-2 text-3xl font-semibold">Governance overview</h2>
        <form onSubmit={search} className="mt-6 flex flex-col gap-3 sm:flex-row">
          <input className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-slate-950" placeholder="Search assets, projects, risks" value={query} onChange={(event) => setQuery(event.target.value)} />
          <button className="rounded-lg bg-cyan-700 px-4 py-2 font-semibold text-white">Search</button>
        </form>
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      </div>

      <SectionTitle eyebrow="Governance Overview" title="Portfolio health at a glance" />
      <div className="mt-4 grid gap-6 lg:grid-cols-3">
        <Metric title="Projects" value={summary.projectCount ?? 0} />
        <Metric title="High Risks" value={summary.riskSeverityBuckets?.HIGH ?? 0} />
        <Metric title="Critical Risks" value={summary.riskSeverityBuckets?.CRITICAL ?? 0} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Severity Distribution">
          <DonutChart data={Object.entries(summary.riskSeverityBuckets ?? {}).map(([label, value]) => ({ label, value, color: severityColors[label] ?? "#64748b" }))} />
        </Panel>
        <Panel title="Risk By Framework">
          <BarChart data={Object.entries(riskSummary.byFramework ?? {}).map(([label, value]) => ({ label, value }))} />
        </Panel>
      </div>

      <SectionTitle eyebrow="Exposure" title="Open high and critical risk" />
      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        <Panel title="Open High/Critical Exposure">
          {exposures.slice(0, 8).map((risk) => <button key={String(risk.id)} className="flex w-full items-center justify-between gap-4 border-b border-slate-100 pb-2 text-left" onClick={() => navigate(`/risks/${String(risk.id)}`)}><span className="truncate text-slate-700">{String(risk.description)}</span><span className="font-semibold text-slate-950">{String(risk.severity)}</span></button>)}
          {!exposures.length && <p className="text-sm text-slate-500">No high or critical exposure.</p>}
        </Panel>
        <Panel title="Recertification">
          {recertifications.slice(0, 8).map((item) => <button key={item.id} className="flex w-full items-center justify-between gap-4 border-b border-slate-100 pb-2 text-left" onClick={() => navigate(`/assets/${item.asset.id}`)}><span className="truncate text-slate-700">{item.asset.name}</span><span className="font-semibold text-slate-950">{item.dueStatus} {new Date(item.nextDueDate).toLocaleDateString()}</span></button>)}
          {!recertifications.length && <p className="text-sm text-slate-500">No model or service recertifications due in the next 30 days.</p>}
        </Panel>
      </div>

      <SectionTitle eyebrow="Reuse" title="Most reused AI assets" />
      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        <Panel title="Top Assets By Reuse">
          <BarChart data={(summary.topAssets ?? []).map((asset) => ({ label: asset.name, value: asset.projectUsageCount }))} />
        </Panel>
        <Panel title="Framework Coverage">
          <BarChart data={coverage.map((item) => ({ label: `${item.framework} ${item.categoryId}`, value: item.riskCount, color: item.riskCount === 0 ? "#f59e0b" : undefined }))} />
        </Panel>
      </div>

      <SectionTitle eyebrow="Model Cards" title="Coverage and completeness" />
      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        <Panel title="Model Card Coverage">
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric title="Required" value={modelCardCoverage.total} />
            <Metric title="With Card" value={modelCardCoverage.withCard} />
            <Metric title="Avg Complete" value={modelCardCoverage.averageCompleteness} />
          </div>
          <BarChart data={[{ label: "With card", value: modelCardCoverage.withCard }, { label: "Missing", value: modelCardCoverage.withoutCard }]} />
        </Panel>
        <Panel title="Missing Model Cards">
          {modelCardCoverage.missingAssets.slice(0, 8).map((asset) => <button key={asset.id} className="flex w-full items-center justify-between gap-4 border-b border-slate-100 pb-2 text-left" onClick={() => navigate(`/assets/${asset.id}`)}><span className="truncate text-slate-700">{asset.name}</span><span className="font-semibold text-slate-950">{asset.type}</span></button>)}
          {!modelCardCoverage.missingAssets.length && <p className="text-sm text-slate-500">All required assets have Model Cards.</p>}
        </Panel>
        <Panel title="Model Performance Metrics">
          <label className="block text-sm font-medium text-slate-700">
            Metric Name
            <select className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950" value={metricName} onChange={(event) => setMetricName(event.target.value)}>
              {["accuracy", "f1", "auc", metricName].filter((value, index, values) => values.indexOf(value) === index).map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <BarChart data={modelMetricReport.metrics.map((metric) => ({ label: metric.slice ? `${metric.asset.name} (${metric.slice})` : metric.asset.name, value: metric.metricValue }))} />
          {modelMetricReport.aggregate.length ? <p className="text-xs text-slate-500">Groups: {modelMetricReport.aggregate.map((item) => `${item.group} avg ${item.avg.toFixed(2)}`).join("; ")}</p> : null}
        </Panel>
      </div>

      <SectionTitle eyebrow="Search" title="Find assets, projects, and risks" />
      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        <Panel title="Search Results">
          {[...results.assets.map((item) => ({ ...item, type: "Asset", path: `/assets/${item.id}` })), ...results.projects.map((item) => ({ ...item, type: "Project", path: `/projects/${item.id}` }))].map((item) => <button key={`${item.type}-${item.id}`} className="flex w-full items-center justify-between gap-4 border-b border-slate-100 pb-2 text-left" onClick={() => navigate(item.path)}><span className="truncate text-slate-700">{item.name}</span><span className="font-semibold text-slate-950">{item.type}</span></button>)}
          {results.risks.map((risk) => <button key={`Risk-${risk.id}`} className="flex w-full items-center justify-between gap-4 border-b border-slate-100 pb-2 text-left" onClick={() => navigate(`/risks/${risk.id}`)}><span className="truncate text-slate-700">{risk.description}</span><span className="font-semibold text-slate-950">Risk</span></button>)}
          {!results.assets.length && !results.projects.length && !results.risks.length && <p className="text-sm text-slate-500">Run a search to see results.</p>}
        </Panel>
      </div>
    </section>
  );
}

function Metric({ title, value }: { title: string; value: number }) {
  return <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200"><p className="text-sm text-slate-500">{title}</p><p className="mt-2 text-3xl font-semibold">{value}</p></div>;
}

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return <div className="mt-8"><p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-700">{eyebrow}</p><h3 className="mt-1 text-2xl font-semibold tracking-tight">{title}</h3></div>;
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200"><h3 className="font-semibold">{title}</h3><div className="mt-4 space-y-3 text-sm">{children}</div></div>;
}
