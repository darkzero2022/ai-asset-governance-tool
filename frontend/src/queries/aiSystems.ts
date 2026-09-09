import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Asset, AssetDetail, Project } from "@aibom/shared";
import { apiFetch } from "../api/client";
import { queryKeys } from "./keys";
import type { ModelCard, ModelCardCompleteness } from "../components/ModelCardForm";

type AiSystemFilters = {
  assetStatus: string;
  assetType: string;
  hostingModel: string;
  networkDependency: string;
};

function toParams(filters: Partial<AiSystemFilters>): Record<string, string> {
  const params: Record<string, string> = {};
  if (filters.assetStatus) params.status = filters.assetStatus;
  if (filters.assetType) params.type = filters.assetType;
  if (filters.hostingModel) params.hostingModel = filters.hostingModel;
  if (filters.networkDependency) params.networkDependency = filters.networkDependency;
  return params;
}

export function useAiSystemsQuery(token: string, filters: Partial<AiSystemFilters>) {
  const params = toParams(filters);
  return useQuery({
    queryKey: queryKeys.assets(params),
    queryFn: async () => {
      const query = new URLSearchParams(params);
      const data = await apiFetch<{ assets: Asset[] }>(
        `/ai-systems${query.size ? `?${query}` : ""}`,
        { token },
      );
      return data.assets;
    },
    enabled: Boolean(token),
  });
}

export function useAiSystemQuery(token: string, id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.asset(id ?? ""),
    queryFn: async () => {
      const data = await apiFetch<{ asset: AssetDetail }>(`/ai-systems/${id}`, { token });
      return data.asset;
    },
    enabled: Boolean(token && id),
  });
}

export function useAiSystemProjectsQuery(token: string, id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.assetProjects(id ?? ""),
    queryFn: async () => {
      const data = await apiFetch<{ projects: Project[] }>(`/ai-systems/${id}/projects`, { token });
      return data.projects;
    },
    enabled: Boolean(token && id),
  });
}

export function useAiSystemModelCardQuery(token: string, id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.assetModelCard(id ?? ""),
    queryFn: () =>
      apiFetch<{ modelCard: ModelCard | null; completeness: ModelCardCompleteness }>(
        `/ai-systems/${id}/model-card`,
        { token },
      ),
    enabled: Boolean(token && id),
  });
}

/** Invalidates every cache entry a write on one AI system can affect. */
function invalidateAiSystem(queryClient: ReturnType<typeof useQueryClient>, id?: string) {
  queryClient.invalidateQueries({ queryKey: ["assets"] });
  if (id) queryClient.invalidateQueries({ queryKey: ["asset", id] });
}

export function useSaveAiSystemMutation(token: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id?: string; payload: Record<string, unknown> }) =>
      apiFetch(id ? `/ai-systems/${id}` : "/ai-systems", {
        method: id ? "PUT" : "POST",
        body: JSON.stringify(payload),
        token,
      }),
    onSuccess: (_data, variables) => invalidateAiSystem(queryClient, variables.id),
  });
}

export function useTransitionAiSystemMutation(token: string, id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { toStatus: string; comments: string | null }) =>
      apiFetch(`/ai-systems/${id}/transition`, {
        method: "POST",
        body: JSON.stringify(payload),
        token,
      }),
    onSuccess: () => invalidateAiSystem(queryClient, id),
  });
}

export function useImportUrlMutation(token: string) {
  return useMutation({
    mutationFn: ({ assetId, sourceUrl }: { assetId?: string; sourceUrl: string }) =>
      apiFetch<{
        sourceUrl: string;
        suggestedTitle: string;
        suggestedDescription: string;
        excerpt: string;
      }>(assetId ? `/ai-systems/${assetId}/import-url` : "/ai-systems/import-url", {
        method: "POST",
        body: JSON.stringify({ sourceUrl }),
        token,
      }),
  });
}

export function useAiSystemRiskLinkMutations(token: string, assetId: string) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    invalidateAiSystem(queryClient, assetId);
    queryClient.invalidateQueries({ queryKey: ["risks"] });
  };
  const link = useMutation({
    mutationFn: (riskId: string) =>
      apiFetch(`/ai-systems/${assetId}/risks/${riskId}`, { method: "POST", token }),
    onSuccess: invalidate,
  });
  const unlink = useMutation({
    mutationFn: (riskId: string) =>
      apiFetch(`/ai-systems/${assetId}/risks/${riskId}`, { method: "DELETE", token }),
    onSuccess: invalidate,
  });
  return { link, unlink };
}

export function useAiSystemProjectLinkMutations(token: string, assetId: string) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    invalidateAiSystem(queryClient, assetId);
    queryClient.invalidateQueries({ queryKey: queryKeys.assetProjects(assetId) });
    queryClient.invalidateQueries({ queryKey: ["projects"] });
  };
  const link = useMutation({
    mutationFn: (projectId: string) =>
      apiFetch(`/projects/${projectId}/ai-systems/${assetId}`, { method: "POST", token }),
    onSuccess: invalidate,
  });
  const unlink = useMutation({
    mutationFn: (projectId: string) =>
      apiFetch(`/projects/${projectId}/ai-systems/${assetId}`, { method: "DELETE", token }),
    onSuccess: invalidate,
  });
  return { link, unlink };
}

export function useSaveModelCardMutation(token: string, assetId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiFetch<{ modelCard: ModelCard }>(`/ai-systems/${assetId}/model-card`, {
        method: "PUT",
        body: JSON.stringify(payload),
        token,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.assetModelCard(assetId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.asset(assetId) });
    },
  });
}

export function useModelCardMetricMutations(token: string, assetId: string) {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.assetModelCard(assetId) });
  const create = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiFetch(`/ai-systems/${assetId}/model-card/metrics`, {
        method: "POST",
        body: JSON.stringify(payload),
        token,
      }),
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: ({ metricId, payload }: { metricId: string; payload: Record<string, unknown> }) =>
      apiFetch(`/ai-systems/${assetId}/model-card/metrics/${metricId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
        token,
      }),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (metricId: string) =>
      apiFetch(`/ai-systems/${assetId}/model-card/metrics/${metricId}`, {
        method: "DELETE",
        token,
      }),
    onSuccess: invalidate,
  });
  return { create, update, remove };
}

export function useExportCycloneDxMutation(token: string) {
  return useMutation({
    mutationFn: (assetIds: string[]) =>
      apiFetch<Record<string, unknown>>("/exports/cyclonedx", {
        method: "POST",
        body: JSON.stringify({ assetIds }),
        token,
      }),
  });
}
