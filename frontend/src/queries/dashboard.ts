import { useMutation, useQuery } from "@tanstack/react-query";
import { apiFetch } from "../api/client";

type Summary = {
  assetStatus?: Array<Record<string, unknown>>;
  assetType?: Array<Record<string, unknown>>;
  hostingModel?: Array<Record<string, unknown>>;
  networkDependency?: Array<Record<string, unknown>>;
  projectCount?: number;
  riskSeverityBuckets?: Record<string, number>;
  topAssets?: Array<{ id: string; name: string; projectUsageCount: number }>;
};

export type SearchResults = {
  assets: Array<{ id: string; name: string }>;
  projects: Array<{ id: string; name: string }>;
  risks: Array<{ id: string; description: string }>;
};

export type RecertificationItem = {
  id: string;
  nextDueDate: string;
  dueStatus: "OVERDUE" | "DUE_SOON";
  asset: { id: string; name: string; type: string };
};

export type ModelCardCoverage = {
  total: number;
  withCard: number;
  withoutCard: number;
  averageCompleteness: number;
  missingAssets: Array<{ id: string; name: string; type: string; status: string }>;
};

export type ModelMetricReport = {
  metrics: Array<{
    id: string;
    metricName: string;
    metricValue: number;
    slice?: string | null;
    asset: { id: string; name: string };
    task?: string | null;
    architectureFamily?: string | null;
  }>;
  aggregate: Array<{ group: string; avg: number; min: number; max: number; count: number }>;
};

export function useDashboardSummaryQuery(token: string) {
  return useQuery({
    queryKey: ["dashboard", "summary"],
    queryFn: () => apiFetch<Summary>("/dashboard/summary", { token }),
    enabled: Boolean(token),
  });
}

export function useDashboardExposureQuery(token: string) {
  return useQuery({
    queryKey: ["dashboard", "exposure"],
    queryFn: async () =>
      (
        await apiFetch<{ exposures: Array<Record<string, unknown>> }>("/dashboard/exposure", {
          token,
        })
      ).exposures,
    enabled: Boolean(token),
  });
}

export function useFrameworkCoverageQuery(token: string) {
  return useQuery({
    queryKey: ["reports", "framework-coverage"],
    queryFn: async () =>
      (
        await apiFetch<{
          coverage: Array<{
            id: string;
            framework: string;
            categoryId: string;
            name: string;
            riskCount: number;
            frameworkStatus?: string;
          }>;
        }>("/reports/framework-coverage", { token })
      ).coverage,
    enabled: Boolean(token),
  });
}

export function useRiskSummaryQuery(token: string) {
  return useQuery({
    queryKey: ["reports", "risk-summary"],
    queryFn: () =>
      apiFetch<{
        total: number;
        byFramework: Record<string, number>;
        bySeverity: Record<string, number>;
      }>("/reports/risk-summary", { token }),
    enabled: Boolean(token),
  });
}

export function useRecertificationQuery(token: string) {
  return useQuery({
    queryKey: ["dashboard", "recertification"],
    queryFn: async () =>
      (
        await apiFetch<{ recertifications: RecertificationItem[] }>("/dashboard/recertification", {
          token,
        })
      ).recertifications,
    enabled: Boolean(token),
  });
}

export function useModelCardCoverageQuery(token: string) {
  return useQuery({
    queryKey: ["dashboard", "model-card-coverage"],
    queryFn: () => apiFetch<ModelCardCoverage>("/dashboard/model-card-coverage", { token }),
    enabled: Boolean(token),
  });
}

export function useModelMetricsQuery(token: string, metricName: string) {
  return useQuery({
    queryKey: ["reports", "model-metrics", metricName],
    queryFn: () =>
      apiFetch<ModelMetricReport>(
        `/reports/model-metrics?metricName=${encodeURIComponent(metricName)}`,
        { token },
      ),
    enabled: Boolean(token),
  });
}

export function useSearchMutation(token: string) {
  return useMutation({
    mutationFn: (query: string) =>
      apiFetch<SearchResults>(`/search?q=${encodeURIComponent(query)}`, { token }),
  });
}
