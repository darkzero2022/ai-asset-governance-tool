import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Asset, AssetDetail, Project } from "@aibom/shared";
import { apiFetch } from "../api/client";
import { queryKeys } from "./keys";
import type { ModelCard, ModelCardCompleteness } from "../components/ModelCardForm";

type AssetFilters = { assetStatus: string; assetType: string; hostingModel: string; networkDependency: string };

function toParams(filters: Partial<AssetFilters>): Record<string, string> {
  const params: Record<string, string> = {};
  if (filters.assetStatus) params.status = filters.assetStatus;
  if (filters.assetType) params.type = filters.assetType;
  if (filters.hostingModel) params.hostingModel = filters.hostingModel;
  if (filters.networkDependency) params.networkDependency = filters.networkDependency;
  return params;
}

export function useAssetsQuery(token: string, filters: Partial<AssetFilters>) {
  const params = toParams(filters);
  return useQuery({
    queryKey: queryKeys.assets(params),
    queryFn: async () => {
      const query = new URLSearchParams(params);
      const data = await apiFetch<{ assets: Asset[] }>(`/assets${query.size ? `?${query}` : ""}`, { token });
      return data.assets;
    },
    enabled: Boolean(token),
  });
}

export function useAssetQuery(token: string, id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.asset(id ?? ""),
    queryFn: async () => {
      const data = await apiFetch<{ asset: AssetDetail }>(`/assets/${id}`, { token });
      return data.asset;
    },
    enabled: Boolean(token && id),
  });
}

export function useAssetProjectsQuery(token: string, id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.assetProjects(id ?? ""),
    queryFn: async () => {
      const data = await apiFetch<{ projects: Project[] }>(`/assets/${id}/projects`, { token });
      return data.projects;
    },
    enabled: Boolean(token && id),
  });
}

export function useAssetModelCardQuery(token: string, id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.assetModelCard(id ?? ""),
    queryFn: () => apiFetch<{ modelCard: ModelCard | null; completeness: ModelCardCompleteness }>(`/assets/${id}/model-card`, { token }),
    enabled: Boolean(token && id),
  });
}

/** Invalidates every cache entry a write on one asset can affect. */
function invalidateAsset(queryClient: ReturnType<typeof useQueryClient>, id?: string) {
  queryClient.invalidateQueries({ queryKey: ["assets"] });
  if (id) queryClient.invalidateQueries({ queryKey: ["asset", id] });
}

export function useSaveAssetMutation(token: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id?: string; payload: Record<string, unknown> }) =>
      apiFetch(id ? `/assets/${id}` : "/assets", { method: id ? "PUT" : "POST", body: JSON.stringify(payload), token }),
    onSuccess: (_data, variables) => invalidateAsset(queryClient, variables.id),
  });
}

export function useTransitionAssetMutation(token: string, id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { toStatus: string; comments: string | null }) =>
      apiFetch(`/assets/${id}/transition`, { method: "POST", body: JSON.stringify(payload), token }),
    onSuccess: () => invalidateAsset(queryClient, id),
  });
}

export function useImportUrlMutation(token: string) {
  return useMutation({
    mutationFn: ({ assetId, sourceUrl }: { assetId?: string; sourceUrl: string }) =>
      apiFetch<{ sourceUrl: string; suggestedTitle: string; suggestedDescription: string; excerpt: string }>(
        assetId ? `/assets/${assetId}/import-url` : "/assets/import-url",
        { method: "POST", body: JSON.stringify({ sourceUrl }), token },
      ),
  });
}

export function useAssetRiskLinkMutations(token: string, assetId: string) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    invalidateAsset(queryClient, assetId);
    queryClient.invalidateQueries({ queryKey: ["risks"] });
  };
  const link = useMutation({
    mutationFn: (riskId: string) => apiFetch(`/assets/${assetId}/risks/${riskId}`, { method: "POST", token }),
    onSuccess: invalidate,
  });
  const unlink = useMutation({
    mutationFn: (riskId: string) => apiFetch(`/assets/${assetId}/risks/${riskId}`, { method: "DELETE", token }),
    onSuccess: invalidate,
  });
  return { link, unlink };
}

export function useAssetProjectLinkMutations(token: string, assetId: string) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    invalidateAsset(queryClient, assetId);
    queryClient.invalidateQueries({ queryKey: queryKeys.assetProjects(assetId) });
    queryClient.invalidateQueries({ queryKey: ["projects"] });
  };
  const link = useMutation({
    mutationFn: (projectId: string) => apiFetch(`/projects/${projectId}/assets/${assetId}`, { method: "POST", token }),
    onSuccess: invalidate,
  });
  const unlink = useMutation({
    mutationFn: (projectId: string) => apiFetch(`/projects/${projectId}/assets/${assetId}`, { method: "DELETE", token }),
    onSuccess: invalidate,
  });
  return { link, unlink };
}

export function useSaveModelCardMutation(token: string, assetId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiFetch<{ modelCard: ModelCard }>(`/assets/${assetId}/model-card`, { method: "PUT", body: JSON.stringify(payload), token }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.assetModelCard(assetId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.asset(assetId) });
    },
  });
}

export function useModelCardMetricMutations(token: string, assetId: string) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.assetModelCard(assetId) });
  const create = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiFetch(`/assets/${assetId}/model-card/metrics`, { method: "POST", body: JSON.stringify(payload), token }),
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: ({ metricId, payload }: { metricId: string; payload: Record<string, unknown> }) =>
      apiFetch(`/assets/${assetId}/model-card/metrics/${metricId}`, { method: "PUT", body: JSON.stringify(payload), token }),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (metricId: string) => apiFetch(`/assets/${assetId}/model-card/metrics/${metricId}`, { method: "DELETE", token }),
    onSuccess: invalidate,
  });
  return { create, update, remove };
}

export function useExportCycloneDxMutation(token: string) {
  return useMutation({
    mutationFn: (assetIds: string[]) =>
      apiFetch<Record<string, unknown>>("/exports/cyclonedx", { method: "POST", body: JSON.stringify({ assetIds }), token }),
  });
}
