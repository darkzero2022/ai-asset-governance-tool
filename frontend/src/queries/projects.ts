import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Project, Risk } from "@aibom/shared";
import { apiFetch } from "../api/client";
import { queryKeys } from "./keys";

export function useProjectsQuery(token: string) {
  return useQuery({
    queryKey: queryKeys.projects(),
    queryFn: async () => {
      const data = await apiFetch<{ projects: Project[] }>("/projects", { token });
      return data.projects;
    },
    enabled: Boolean(token),
  });
}

export function useProjectQuery(token: string, id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.project(id ?? ""),
    queryFn: async () => {
      const data = await apiFetch<{ project: Project }>(`/projects/${id}`, { token });
      return data.project;
    },
    enabled: Boolean(token && id),
  });
}

export function useProjectRisksQuery(token: string, id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.projectRisks(id ?? ""),
    queryFn: async () => {
      const data = await apiFetch<{ risks: Risk[] }>(`/projects/${id}/risks`, { token });
      return data.risks;
    },
    enabled: Boolean(token && id),
  });
}

function invalidateProject(queryClient: ReturnType<typeof useQueryClient>, id?: string) {
  queryClient.invalidateQueries({ queryKey: queryKeys.projects() });
  if (id) queryClient.invalidateQueries({ queryKey: ["project", id] });
}

export function useSaveProjectMutation(token: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id?: string; payload: Record<string, unknown> }) =>
      apiFetch(id ? `/projects/${id}` : "/projects", { method: id ? "PUT" : "POST", body: JSON.stringify(payload), token }),
    onSuccess: (_data, variables) => invalidateProject(queryClient, variables.id),
  });
}

export function useProjectAssetLinkMutations(token: string, projectId: string) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    invalidateProject(queryClient, projectId);
    queryClient.invalidateQueries({ queryKey: ["assets"] });
  };
  const link = useMutation({
    mutationFn: (assetId: string) => apiFetch(`/projects/${projectId}/assets/${assetId}`, { method: "POST", token }),
    onSuccess: invalidate,
  });
  const unlink = useMutation({
    mutationFn: (assetId: string) => apiFetch(`/projects/${projectId}/assets/${assetId}`, { method: "DELETE", token }),
    onSuccess: invalidate,
  });
  return { link, unlink };
}

export function useProjectRiskLinkMutations(token: string, projectId: string) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    invalidateProject(queryClient, projectId);
    queryClient.invalidateQueries({ queryKey: queryKeys.projectRisks(projectId) });
    queryClient.invalidateQueries({ queryKey: ["risks"] });
  };
  const link = useMutation({
    mutationFn: (riskId: string) => apiFetch(`/projects/${projectId}/risks/${riskId}`, { method: "POST", token }),
    onSuccess: invalidate,
  });
  const unlink = useMutation({
    mutationFn: (riskId: string) => apiFetch(`/projects/${projectId}/risks/${riskId}`, { method: "DELETE", token }),
    onSuccess: invalidate,
  });
  return { link, unlink };
}

export function useExportProjectCycloneDxMutation(token: string) {
  return useMutation({
    mutationFn: (projectId: string) => apiFetch<Record<string, unknown>>(`/projects/${projectId}/export/cyclonedx`, { token }),
  });
}
