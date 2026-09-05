import { useQuery } from "@tanstack/react-query";
import type { Control } from "@aibom/shared";
import { apiFetch } from "../api/client";
import { queryKeys } from "./keys";

export function useControlsQuery(token: string) {
  return useQuery({
    queryKey: queryKeys.controls(),
    queryFn: async () => {
      const data = await apiFetch<{ controls: Control[] }>("/controls", { token });
      return data.controls;
    },
    enabled: Boolean(token),
  });
}
