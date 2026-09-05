import { useQuery } from "@tanstack/react-query";
import type { CurrentUser } from "@aibom/shared";
import { apiFetch } from "../api/client";
import { queryKeys } from "./keys";

export function useCurrentUserQuery(token: string) {
  return useQuery({
    queryKey: queryKeys.currentUser(),
    queryFn: async () => {
      const data = await apiFetch<{ user: CurrentUser }>("/auth/me", { token });
      return data.user;
    },
    enabled: Boolean(token),
    retry: false,
  });
}
