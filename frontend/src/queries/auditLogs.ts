import { useQuery } from "@tanstack/react-query";
import type { AuditLog } from "@aibom/shared";
import { apiFetch } from "../api/client";
import { queryKeys } from "./keys";

export function useAuditLogsQuery(token: string, entityType: string, entityId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.auditLogs(entityType, entityId ?? ""),
    queryFn: async () => {
      const data = await apiFetch<{ logs: AuditLog[] }>(
        `/audit-logs?entityType=${entityType}&entityId=${encodeURIComponent(entityId ?? "")}`,
        { token },
      );
      return data.logs;
    },
    enabled: Boolean(token && entityId),
  });
}
