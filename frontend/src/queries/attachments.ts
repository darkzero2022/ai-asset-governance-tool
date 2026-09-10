import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Attachment, AttachmentEntity } from "@aibom/shared";
import { apiFetch } from "../api/client";

const key = (entityType: AttachmentEntity, entityId: string) =>
  ["attachments", entityType, entityId] as const;

export function useAttachmentsQuery(
  token: string,
  entityType: AttachmentEntity,
  entityId: string | undefined,
) {
  return useQuery({
    queryKey: key(entityType, entityId ?? ""),
    queryFn: async () =>
      (
        await apiFetch<{ attachments: Attachment[] }>(
          `/attachments?entityType=${entityType}&entityId=${entityId}`,
          { token },
        )
      ).attachments,
    enabled: Boolean(token && entityId),
  });
}

export function useUploadAttachmentMutation(
  token: string,
  entityType: AttachmentEntity,
  entityId: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { file: File; description?: string }) => {
      const form = new FormData();
      form.append("entityType", entityType);
      form.append("entityId", entityId);
      if (input.description) form.append("description", input.description);
      form.append("file", input.file);
      return apiFetch<{ attachment: Attachment }>("/attachments", {
        method: "POST",
        body: form,
        token,
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key(entityType, entityId) }),
  });
}

export function useDeleteAttachmentMutation(
  token: string,
  entityType: AttachmentEntity,
  entityId: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/attachments/${id}`, { method: "DELETE", token }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key(entityType, entityId) }),
  });
}
