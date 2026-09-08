import type { ReactNode } from "react";
import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "../../lib/cn";
import { Button } from "./Button";

const DIALOG_SIZES = { md: "max-w-md", lg: "max-w-2xl", xl: "max-w-4xl" } as const;

export function Dialog({
  open,
  onOpenChange,
  children,
  size = "md",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  size?: keyof typeof DIALOG_SIZES;
}) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-40 bg-black/50 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
        <RadixDialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2",
            DIALOG_SIZES[size],
            "rounded-lg border border-border bg-surface p-5 shadow-card focus:outline-none",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
          )}
        >
          {children}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

export function DialogHeader({ title, description }: { title: ReactNode; description?: ReactNode }) {
  return (
    <div className="mb-4 pr-6">
      <RadixDialog.Title className="text-base font-semibold text-text">{title}</RadixDialog.Title>
      {description && <RadixDialog.Description className="mt-1 text-sm text-subtle">{description}</RadixDialog.Description>}
      <RadixDialog.Close asChild>
        <button className="absolute right-4 top-4 rounded-md p-1 text-subtle hover:bg-surface-alt hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label="Close">
          <X className="h-4 w-4" />
        </button>
      </RadixDialog.Close>
    </div>
  );
}

export function DialogFooter({ children }: { children: ReactNode }) {
  return <div className="mt-5 flex justify-end gap-2">{children}</div>;
}

export { RadixDialog };

/** A confirm dialog for destructive actions (archive, unlink, delete metric). */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  onConfirm,
  danger = true,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: string;
  onConfirm: () => void;
  danger?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader title={title} description={description} />
      <DialogFooter>
        <RadixDialog.Close asChild>
          <Button variant="secondary" size="sm">Cancel</Button>
        </RadixDialog.Close>
        <Button
          variant={danger ? "danger" : "primary"}
          size="sm"
          onClick={() => {
            onConfirm();
            onOpenChange(false);
          }}
        >
          {confirmLabel}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
