import { useRef, useState } from "react";
import { Download, Paperclip, Trash2, Upload } from "lucide-react";
import type { AttachmentEntity } from "@aibom/shared";
import { Card, CardBody, CardHeader } from "./ui/Card";
import { Button } from "./ui/Button";
import { EmptyState } from "./ui/EmptyState";
import { toast } from "./ui/toastStore";
import { downloadFile } from "../api/client";
import {
  useAttachmentsQuery,
  useDeleteAttachmentMutation,
  useUploadAttachmentMutation,
} from "../queries/attachments";

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function Attachments({
  token,
  entityType,
  entityId,
  canManage,
}: {
  token: string;
  entityType: AttachmentEntity;
  entityId: string;
  canManage: boolean;
}) {
  const list = useAttachmentsQuery(token, entityType, entityId);
  const upload = useUploadAttachmentMutation(token, entityType, entityId);
  const remove = useDeleteAttachmentMutation(token, entityType, entityId);
  const fileRef = useRef<HTMLInputElement>(null);
  const [description, setDescription] = useState("");

  async function onPick(file: File | undefined) {
    if (!file) return;
    try {
      await upload.mutateAsync({ file, description: description.trim() || undefined });
      setDescription("");
      if (fileRef.current) fileRef.current.value = "";
      toast.success("Evidence attached");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    }
  }

  const items = list.data ?? [];

  return (
    <Card>
      <CardHeader
        title="Evidence"
        action={
          <span className="flex items-center gap-1.5 text-sm text-subtle">
            <Paperclip className="h-4 w-4" /> {items.length}
          </span>
        }
      />
      <CardBody>
        {canManage && (
          <div className="mb-3 flex flex-wrap items-end gap-2">
            <input
              className="min-w-0 flex-1 rounded-md border border-border bg-bg px-3 py-2 text-sm"
              placeholder="Description (optional)"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              onChange={(event) => onPick(event.target.files?.[0])}
            />
            <Button
              variant="secondary"
              size="sm"
              disabled={upload.isPending}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-3.5 w-3.5" /> {upload.isPending ? "Uploading…" : "Add file"}
            </Button>
          </div>
        )}

        {items.length === 0 ? (
          <EmptyState title="No evidence attached yet." />
        ) : (
          <ul className="space-y-2">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-start justify-between gap-3 rounded-md border border-border p-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-text">{item.filename}</p>
                  {item.description && (
                    <p className="truncate text-xs text-subtle">{item.description}</p>
                  )}
                  <p className="text-xs text-subtle">
                    {humanSize(item.size)} · {item.uploadedBy?.name ?? "Unknown"} ·{" "}
                    {new Date(item.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      downloadFile(`/attachments/${item.id}/download`, item.filename).catch(() =>
                        toast.error("Download failed"),
                      )
                    }
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  {canManage && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        remove.mutate(item.id, {
                          onSuccess: () => toast.success("Attachment removed"),
                          onError: (err) =>
                            toast.error(err instanceof Error ? err.message : "Delete failed"),
                        })
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
