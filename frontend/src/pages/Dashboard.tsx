import { FormEvent, type ReactNode, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart } from "../components/BarChart";
import { DonutChart } from "../components/DonutChart";
import { PageHeader } from "../components/shell/PageHeader";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input, Select } from "../components/ui/Field";
import { EmptyState } from "../components/ui/EmptyState";
import { SkeletonRows } from "../components/ui/Skeleton";
import { frameworkLabel } from "../formDefaults";
import {
  useDashboardExposureQuery,
  useDashboardSummaryQuery,
  useFrameworkCoverageQuery,
  useModelCardCoverageQuery,
  useModelMetricsQuery,
  useRecertificationQuery,
  useRiskSummaryQuery,
  useSearchMutation,
  type SearchResults,
} from "../queries/dashboard";

type DashboardProps = {
  token: string;
};

const SEVERITY_COLORS: Record<string, string> = {
  LOW: "rgb(var(--wz-severity-low))",
  MEDIUM: "rgb(var(--wz-severity-medium))",
  HIGH: "rgb(var(--wz-severity-high))",
  CRITICAL: "rgb(var(--wz-severity-critical))",
};
const CHART_1 = "rgb(var(--wz-chart-1))";

const emptySearchResults: SearchResults = { assets: [], projects: [], risks: [] };

function sumCounts(rows?: Array<Record<string, unknown>>): number {
  return (rows ?? []).reduce((total, row) => total + (typeof row._count === "number" ? row._count : 0), 0);
}

export default function Dashboard({ token }: DashboardProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [metricName, setMetricName] = useState("accuracy");

  const summaryQuery = useDashboardSummaryQuery(token);
  const summary = summaryQuery.data ?? {};
  const { data: exposures = [], isPending: exposureLoading } = useDashboardExposureQuery(token);
  const { data: coverage = [] } = useFrameworkCoverageQuery(token);
  const { data: riskSummary = { total: 0, byFramework: {}, bySeverity: {} } } = useRiskSummaryQuery(token);
  const { data: recertifications = [], isPending: recertLoading } = useRecertificationQuery(token);
  const { data: modelCardCoverage = { total: 0, withCard: 0, withoutCard: 0, averageCompleteness: 0, missingAssets: [] } } =
    useModelCardCoverageQuery(token);
  const { data: modelMetricReport = { metrics: [], aggregate: [] } } = useModelMetricsQuery(token, metricName);
  const searchMutation = useSearchMutation(token);
  const results = searchMutation.data ?? emptySearchResults;

  const severityBuckets = summary.riskSeverityBuckets ?? {};
  const totalAiSystems = sumCounts(summary.assetStatus);

  async function search(event: FormEvent) {
    event.preventDefault();
    searchMutation.mutate(query);
  }

  return (
    <section className="mx-auto max-w-7xl px-6 py-6">
      <PageHeader title="Dashboard" description="Portfolio governance overview." />

      <form onSubmit={search} className="mb-6 flex flex-col gap-2 sm:flex-row">
        <Input
          className="flex-1"
          aria-label="Search assets, projects, and risks"
          placeholder="Search AI systems, projects, risks…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <Button type="submit" variant="primary" disabled={searchMutation.isPending}>
          {searchMutation.isPending ? "Searching…" : "Search"}
        </Button>
      </form>

      {searchMutation.data !== undefined && (
        <Card className="mb-6">
          <CardHeader title="Search results" />
          <CardBody className="space-y-1">
            {[
              ...results.assets.map((item) => ({ key: `a-${item.id}`, name: item.name, kind: "AI System", path: `/ai-systems/${item.id}` })),
              ...results.projects.map((item) => ({ key: `p-${item.id}`, name: item.name, kind: "Project", path: `/projects/${item.id}` })),
              ...results.risks.map((item) => ({ key: `r-${item.id}`, name: item.description, kind: "Risk", path: `/risks/${item.id}` })),
            ].map((row) => (
              <button
                key={row.key}
                className="flex w-full items-center justify-between gap-4 rounded-md px-2 py-1.5 text-left text-sm hover:bg-surface-alt"
                onClick={() => navigate(row.path)}
              >
                <span className="truncate text-text">{row.name}</span>
                <span className="shrink-0 text-xs text-subtle">{row.kind}</span>
              </button>
            ))}
            {!results.assets.length && !results.projects.length && !results.risks.length && (
              <p className="text-sm text-subtle">No matches.</p>
            )}
          </CardBody>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="AI systems" value={totalAiSystems} onClick={() => navigate("/ai-systems")} />
        <Stat label="Projects" value={summary.projectCount ?? 0} onClick={() => navigate("/projects")} />
        <Stat
          label="Open high risks"
          value={severityBuckets.HIGH ?? 0}
          tone="high"
          onClick={() => navigate("/risks")}
        />
        <Stat
          label="Open critical risks"
          value={severityBuckets.CRITICAL ?? 0}
          tone="critical"
          onClick={() => navigate("/risks")}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Risk severity">
          <DonutChart
            data={["CRITICAL", "HIGH", "MEDIUM", "LOW"]
              .filter((key) => (severityBuckets[key] ?? 0) > 0)
              .map((key) => ({ label: key, value: severityBuckets[key] ?? 0, color: SEVERITY_COLORS[key] }))}
          />
        </Panel>
        <Panel title="Risk by framework">
          <BarChart data={Object.entries(riskSummary.byFramework ?? {}).map(([label, value]) => ({ label, value }))} />
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Open high / critical exposure" onViewAll={() => navigate("/risks")}>
          {exposureLoading ? (
            <SkeletonRows rows={4} />
          ) : exposures.length ? (
            <LinkList
              items={exposures.slice(0, 8).map((risk) => ({
                id: String(risk.id),
                title: String(risk.description),
                meta: String(risk.severity),
                onClick: () => navigate(`/risks/${String(risk.id)}`),
              }))}
            />
          ) : (
            <EmptyState title="No high or critical exposure." />
          )}
        </Panel>
        <Panel title="Recertifications due (30d)">
          {recertLoading ? (
            <SkeletonRows rows={4} />
          ) : recertifications.length ? (
            <LinkList
              items={recertifications.slice(0, 8).map((item) => ({
                id: item.id,
                title: item.asset.name,
                meta: `${item.dueStatus} · ${new Date(item.nextDueDate).toLocaleDateString()}`,
                onClick: () => navigate(`/ai-systems/${item.asset.id}`),
              }))}
            />
          ) : (
            <EmptyState title="Nothing due in the next 30 days." />
          )}
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Most reused AI systems">
          <BarChart data={(summary.topAssets ?? []).map((asset) => ({ label: asset.name, value: asset.projectUsageCount }))} />
        </Panel>
        <Panel title="Framework coverage">
          <BarChart
            data={coverage.map((item) => ({
              label: `${frameworkLabel(item.framework)} ${item.categoryId}${item.frameworkStatus === "DRAFT" ? " (draft)" : ""}`,
              value: item.riskCount,
              color: item.riskCount === 0 ? "rgb(var(--wz-warning))" : CHART_1,
            }))}
          />
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Model Card coverage">
          <div className="grid gap-3 sm:grid-cols-3">
            <MiniStat label="Required" value={modelCardCoverage.total} />
            <MiniStat label="With card" value={modelCardCoverage.withCard} />
            <MiniStat label="Avg complete" value={`${modelCardCoverage.averageCompleteness}%`} />
          </div>
          <div className="mt-4">
            <BarChart
              data={[
                { label: "With card", value: modelCardCoverage.withCard, color: "rgb(var(--wz-success))" },
                { label: "Missing", value: modelCardCoverage.withoutCard, color: "rgb(var(--wz-warning))" },
              ]}
            />
          </div>
        </Panel>
        <Panel title="Missing Model Cards" onViewAll={() => navigate("/ai-systems")}>
          {modelCardCoverage.missingAssets.length ? (
            <LinkList
              items={modelCardCoverage.missingAssets.slice(0, 8).map((asset) => ({
                id: asset.id,
                title: asset.name,
                meta: asset.type,
                onClick: () => navigate(`/ai-systems/${asset.id}`),
              }))}
            />
          ) : (
            <EmptyState title="All required AI systems have a Model Card." />
          )}
        </Panel>
      </div>

      <div className="mt-4">
        <Panel title="Model performance metrics">
          <div className="max-w-xs">
            <Select label="Metric" value={metricName} onChange={(event) => setMetricName(event.target.value)}>
              {["accuracy", "f1", "auc", metricName]
                .filter((value, index, values) => values.indexOf(value) === index)
                .map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
            </Select>
          </div>
          <div className="mt-4">
            <BarChart
              data={modelMetricReport.metrics.map((metric) => ({
                label: metric.slice ? `${metric.asset.name} (${metric.slice})` : metric.asset.name,
                value: metric.metricValue,
              }))}
            />
          </div>
          {modelMetricReport.aggregate.length ? (
            <p className="mt-3 text-xs text-subtle">
              {modelMetricReport.aggregate.map((item) => `${item.group}: avg ${item.avg.toFixed(2)}`).join(" · ")}
            </p>
          ) : null}
        </Panel>
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  tone,
  onClick,
}: {
  label: string;
  value: number;
  tone?: "high" | "critical";
  onClick?: () => void;
}) {
  const toneClass =
    tone === "critical" ? "text-severity-critical" : tone === "high" ? "text-severity-high" : "text-text";
  return (
    <button
      onClick={onClick}
      className="rounded-lg border border-border bg-surface p-4 text-left shadow-card transition-colors hover:border-primary/60"
    >
      <p className="text-sm text-subtle">{label}</p>
      <p className={`mt-1 text-3xl font-semibold tabular-nums ${toneClass}`}>{value}</p>
    </button>
  );
}

function MiniStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-surface-alt px-3 py-2">
      <p className="text-xs text-subtle">{label}</p>
      <p className="mt-0.5 text-lg font-semibold text-text tabular-nums">{value}</p>
    </div>
  );
}

function Panel({ title, children, onViewAll }: { title: string; children: ReactNode; onViewAll?: () => void }) {
  return (
    <Card>
      <CardHeader
        title={title}
        action={
          onViewAll ? (
            <Button variant="ghost" size="sm" onClick={onViewAll}>
              View all
            </Button>
          ) : undefined
        }
      />
      <CardBody>{children}</CardBody>
    </Card>
  );
}

function LinkList({ items }: { items: Array<{ id: string; title: string; meta: string; onClick: () => void }> }) {
  return (
    <div className="space-y-1">
      {items.map((item) => (
        <button
          key={item.id}
          onClick={item.onClick}
          className="flex w-full items-center justify-between gap-4 rounded-md px-2 py-1.5 text-left text-sm hover:bg-surface-alt"
        >
          <span className="truncate text-text">{item.title}</span>
          <span className="shrink-0 text-xs font-medium text-subtle">{item.meta}</span>
        </button>
      ))}
    </div>
  );
}
