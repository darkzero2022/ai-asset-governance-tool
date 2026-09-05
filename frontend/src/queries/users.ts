import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../api/client";
import { queryKeys } from "./keys";

export type UserRow = { id: string; email: string; name: string; role: string; active: boolean };

export function useUsersQuery(token: string) {
  return useQuery({
    queryKey: queryKeys.users(),
    queryFn: async () => {
      const data = await apiFetch<{ users: UserRow[] }>("/users", { token });
      return data.users;
    },
    enabled: Boolean(token),
  });
}

export function useCreateUserMutation(token: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) => apiFetch("/users", { method: "POST", body: JSON.stringify(payload), token }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.users() }),
  });
}

export function useUpdateUserMutation(token: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
      apiFetch(`/users/${id}`, { method: "PUT", body: JSON.stringify(payload), token }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.users() }),
  });
}
