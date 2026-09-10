import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  ThreatModelElementType,
  ThreatModelThreatStatus,
  StrideAiCategory,
} from "@aibom/shared";
import { apiFetch } from "../api/client";

export type TMElement = {
  id: string;
  type: ThreatModelElementType;
  name: string;
  description: string | null;
  trustBoundaryId: string | null;
  x: number | null;
  y: number | null;
};
export type TMFlow = {
  id: string;
  sourceId: string;
  targetId: string;
  label: string;
  protocol: string | null;
  authenticated: boolean;
  encrypted: boolean;
};
export type TMBoundary = { id: string; name: string; description: string | null };
export type TMThreat = {
  id: string;
  ruleId: string | null;
  elementId: string | null;
  flowId: string | null;
  title: string;
  description: string;
  strideAiCategory: StrideAiCategory | null;
  sourceFramework: string | null;
  sourceCategoryId: string | null;
  status: ThreatModelThreatStatus;
  promotedRiskId: string | null;
};
export type ThreatModel = {
  id: string;
  assetId: string;
  title: string;
  description: string | null;
  elements: TMElement[];
  flows: TMFlow[];
  trustBoundaries: TMBoundary[];
  threats: TMThreat[];
};

export type ThreatModelReport = {
  threatModelId: string;
  title: string;
  description: string | null;
  summary: Record<string, number>;
  diagram: {
    width: number;
    height: number;
    nodes: (Omit<TMElement, "x" | "y"> & { x: number; y: number; width: number; height: number })[];
    edges: (TMFlow & { crossesBoundary: boolean })[];
    boundaries: (TMBoundary & {
      box: { x: number; y: number; width: number; height: number } | null;
    })[];
  };
  threats: Record<"suggested" | "accepted" | "promoted" | "dismissed", TMThreat[]>;
};

const key = (assetId: string) => ["threatModel", assetId] as const;
const reportKey = (modelId: string) => ["threatModel", "report", modelId] as const;

export function useThreatModelQuery(token: string, assetId: string | undefined) {
  return useQuery({
    queryKey: key(assetId ?? ""),
    queryFn: async () =>
      (
        await apiFetch<{ threatModel: ThreatModel | null }>(`/ai-systems/${assetId}/threat-model`, {
          token,
        })
      ).threatModel,
    enabled: Boolean(token && assetId),
  });
}

export function useThreatModelReportQuery(token: string, modelId: string | undefined) {
  return useQuery({
    queryKey: reportKey(modelId ?? ""),
    queryFn: async () =>
      (await apiFetch<{ report: ThreatModelReport }>(`/threat-models/${modelId}/report`, { token }))
        .report,
    enabled: Boolean(token && modelId),
  });
}

/** One factory of every mutation the page needs, all keyed to the asset. */
export function useThreatModelMutations(
  token: string,
  assetId: string,
  modelId: string | undefined,
) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: key(assetId) });
    if (modelId) qc.invalidateQueries({ queryKey: reportKey(modelId) });
  };
  const write = <T = unknown>(path: string, method: string, body?: unknown) =>
    apiFetch<T>(path, { method, token, body: body ? JSON.stringify(body) : undefined });

  return {
    create: useMutation({
      mutationFn: (input: { title: string; description?: string }) =>
        write(`/ai-systems/${assetId}/threat-model`, "POST", input),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: () => write(`/threat-models/${modelId}`, "DELETE"),
      onSuccess: invalidate,
    }),
    addElement: useMutation({
      mutationFn: (input: {
        type: ThreatModelElementType;
        name: string;
        description?: string;
        trustBoundaryId?: string | null;
      }) => write(`/threat-models/${modelId}/elements`, "POST", input),
      onSuccess: invalidate,
    }),
    updateElement: useMutation({
      mutationFn: ({
        id,
        ...input
      }: {
        id: string;
        trustBoundaryId?: string | null;
        name?: string;
      }) => write(`/threat-models/${modelId}/elements/${id}`, "PUT", input),
      onSuccess: invalidate,
    }),
    deleteElement: useMutation({
      mutationFn: (id: string) => write(`/threat-models/${modelId}/elements/${id}`, "DELETE"),
      onSuccess: invalidate,
    }),
    addFlow: useMutation({
      mutationFn: (input: {
        sourceId: string;
        targetId: string;
        label: string;
        authenticated?: boolean;
        encrypted?: boolean;
      }) => write(`/threat-models/${modelId}/flows`, "POST", input),
      onSuccess: invalidate,
    }),
    deleteFlow: useMutation({
      mutationFn: (id: string) => write(`/threat-models/${modelId}/flows/${id}`, "DELETE"),
      onSuccess: invalidate,
    }),
    addBoundary: useMutation({
      mutationFn: (input: { name: string; description?: string }) =>
        write(`/threat-models/${modelId}/trust-boundaries`, "POST", input),
      onSuccess: invalidate,
    }),
    deleteBoundary: useMutation({
      mutationFn: (id: string) =>
        write(`/threat-models/${modelId}/trust-boundaries/${id}`, "DELETE"),
      onSuccess: invalidate,
    }),
    suggest: useMutation({
      mutationFn: () => write<{ added: number }>(`/threat-models/${modelId}/suggest`, "POST"),
      onSuccess: invalidate,
    }),
    setThreatStatus: useMutation({
      mutationFn: ({ id, status }: { id: string; status: ThreatModelThreatStatus }) =>
        write(`/threat-models/${modelId}/threats/${id}`, "PUT", { status }),
      onSuccess: invalidate,
    }),
    promote: useMutation({
      mutationFn: (id: string) =>
        write<{ riskId: string }>(`/threat-models/${modelId}/threats/${id}/promote`, "POST"),
      onSuccess: invalidate,
    }),
  };
}
