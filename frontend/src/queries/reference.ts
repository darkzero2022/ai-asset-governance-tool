import { useQuery } from "@tanstack/react-query";
import type { FrameworkCategory } from "@aibom/shared";
import { apiFetch } from "../api/client";
import { queryKeys } from "./keys";

// Reference/lookup data changes rarely — cache it for the session.
const REFERENCE_STALE_TIME = 10 * 60 * 1000;

export function useFrameworkCategoriesQuery(token: string) {
  return useQuery({
    queryKey: queryKeys.frameworkCategories(),
    queryFn: async () => {
      const data = await apiFetch<{ categories: FrameworkCategory[] }>("/reference/framework-categories", { token });
      return data.categories;
    },
    enabled: Boolean(token),
    staleTime: REFERENCE_STALE_TIME,
  });
}

export function useAtlasTechniquesQuery(token: string) {
  return useQuery({
    queryKey: queryKeys.atlasTechniques(),
    queryFn: async () => {
      const data = await apiFetch<{ techniques: Array<{ name: string }> }>("/reference/atlas-techniques", { token });
      return data.techniques.map((technique) => technique.name);
    },
    enabled: Boolean(token),
    staleTime: REFERENCE_STALE_TIME,
  });
}

export function useAtlasMitigationsQuery(token: string) {
  return useQuery({
    queryKey: queryKeys.atlasMitigations(),
    queryFn: async () => {
      const data = await apiFetch<{ mitigations: Array<{ name: string }> }>("/reference/atlas-mitigations", { token });
      return data.mitigations.map((mitigation) => mitigation.name);
    },
    enabled: Boolean(token),
    staleTime: REFERENCE_STALE_TIME,
  });
}
