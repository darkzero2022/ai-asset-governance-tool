import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AuthSession, CurrentUser } from "@aibom/shared";
import { apiFetch } from "../api/client";
import { setAccessToken } from "../auth/session";
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

export function useChangePasswordMutation(token: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { currentPassword: string; newPassword: string }) =>
      apiFetch<{ accessToken: string; user: CurrentUser }>("/auth/change-password", {
        method: "POST",
        body: JSON.stringify(payload),
        token,
      }),
    onSuccess: (data) => {
      setAccessToken(data.accessToken);
      queryClient.setQueryData(queryKeys.currentUser(), {
        ...data.user,
        mustChangePassword: false,
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.sessions() });
    },
  });
}

export function useSessionsQuery(token: string) {
  return useQuery({
    queryKey: queryKeys.sessions(),
    queryFn: async () =>
      (await apiFetch<{ sessions: AuthSession[] }>("/auth/sessions", { token })).sessions,
    enabled: Boolean(token),
  });
}

export function useRevokeSessionMutation(token: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/auth/sessions/${id}`, { method: "DELETE", token }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.sessions() }),
  });
}

export function useLogoutAllMutation(token: string) {
  return useMutation({
    mutationFn: () => apiFetch("/auth/logout-all", { method: "POST", token }),
  });
}
