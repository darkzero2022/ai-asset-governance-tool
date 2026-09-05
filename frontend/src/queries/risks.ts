import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Risk } from "@aibom/shared";
import { apiFetch } from "../api/client";
import { queryKeys } from "./keys";

type RiskFilters = { riskStatus: string; sourceFramework: string };

function toParams(filters: Partial<RiskFilters>): Record<string, string> {
  const params: Record<string, string> = {};
  if (filters.riskStatus) params.status = filters.riskStatus;
  if (filters.sourceFramework) params.sourceFramework = filters.sourceFramework;
  return params;
}

export function useRisksQuery(token: string, filters: Partial<RiskFilters>) {
  const params = toParams(filters);
  return useQuery({
    queryKey: queryKeys.risks(params),
    queryFn: async () => {
      const query = new URLSearchParams(params);
      const data = await apiFetch<{ risks: Risk[] }>(`/risks${query.size ? `?${query}` : ""}`, { token });
      return data.risks;
    },
    enabled: Boolean(token),
  });
}

export function useRiskQuery(token: string, id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.risk(id ?? ""),
    queryFn: async () => {
      const data = await apiFetch<{ risk: Risk }>(`/risks/${id}`, { token });
      return data.risk;
    },
    enabled: Boolean(token && id),
  });
}

function invalidateRisk(queryClient: ReturnType<typeof useQueryClient>, id?: string) {
  queryClient.invalidateQueries({ queryKey: ["risks"] });
  queryClient.invalidateQueries({ queryKey: ["assets"] });
  if (id) queryClient.invalidateQueries({ queryKey: ["risk", id] });
}

export function useSaveRiskMutation(token: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id?: string; payload: Record<string, unknown> }) =>
      apiFetch(id ? `/risks/${id}` : "/risks", { method: id ? "PUT" : "POST", body: JSON.stringify(payload), token }),
    onSuccess: (_data, variables) => invalidateRisk(queryClient, variables.id),
  });
}

export function useBulkUpdateRisksMutation(token: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ risks, status }: { risks: Risk[]; status: string }) => {
      await Promise.all(
        risks.map((risk) =>
          apiFetch(`/risks/${risk.id}`, {
            method: "PUT",
            token,
            body: JSON.stringify({
              assetId: risk.assetId,
              sourceFramework: risk.sourceFramework,
              sourceCategoryId: risk.sourceCategoryId,
              euAiActRiskTier: risk.euAiActRiskTier ?? null,
              strideAiCategory: risk.strideAiCategory ?? null,
              atlasTechnique: risk.atlasTechnique ?? null,
              description: risk.description,
              likelihood: risk.likelihood,
              impact: risk.impact,
              residualRiskScore: risk.residualRiskScore ?? null,
              treatmentPlan: risk.treatmentPlan ?? null,
              owner: risk.owner ?? null,
              dueDate: risk.dueDate ?? null,
              status,
            }),
          }),
        ),
      );
    },
    onSuccess: () => invalidateRisk(queryClient),
  });
}

export function useRiskAssetLinkMutations(token: string, riskId: string) {
  const queryClient = useQueryClient();
  const invalidate = () => invalidateRisk(queryClient, riskId);
  const link = useMutation({
    mutationFn: (assetId: string) => apiFetch(`/assets/${assetId}/risks/${riskId}`, { method: "POST", token }),
    onSuccess: invalidate,
  });
  const unlink = useMutation({
    mutationFn: (assetId: string) => apiFetch(`/assets/${assetId}/risks/${riskId}`, { method: "DELETE", token }),
    onSuccess: invalidate,
  });
  return { link, unlink };
}

export function useRiskProjectLinkMutations(token: string, riskId: string) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    invalidateRisk(queryClient, riskId);
    queryClient.invalidateQueries({ queryKey: ["projects"] });
  };
  const link = useMutation({
    mutationFn: (projectId: string) => apiFetch(`/projects/${projectId}/risks/${riskId}`, { method: "POST", token }),
    onSuccess: invalidate,
  });
  const unlink = useMutation({
    mutationFn: (projectId: string) => apiFetch(`/projects/${projectId}/risks/${riskId}`, { method: "DELETE", token }),
    onSuccess: invalidate,
  });
  return { link, unlink };
}

export function useRiskControlLinkMutations(token: string, riskId: string) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.risk(riskId) });
    queryClient.invalidateQueries({ queryKey: ["controls"] });
  };
  const link = useMutation({
    mutationFn: ({ controlId, implementationStatus }: { controlId: string; implementationStatus: string }) =>
      apiFetch(`/risks/${riskId}/controls/${controlId}`, { method: "POST", body: JSON.stringify({ implementationStatus }), token }),
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: ({ controlId, implementationStatus }: { controlId: string; implementationStatus: string }) =>
      apiFetch(`/risks/${riskId}/controls/${controlId}`, { method: "PUT", body: JSON.stringify({ implementationStatus }), token }),
    onSuccess: invalidate,
  });
  const unlink = useMutation({
    mutationFn: (controlId: string) => apiFetch(`/risks/${riskId}/controls/${controlId}`, { method: "DELETE", token }),
    onSuccess: invalidate,
  });
  return { link, update, unlink };
}
