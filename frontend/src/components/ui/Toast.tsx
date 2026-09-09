import { useEffect, useState } from "react";
import * as RadixToast from "@radix-ui/react-toast";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "../../lib/cn";
import { dismissToast, subscribeToasts, type ToastItem } from "./toastStore";

const ICONS = {
  success: CheckCircle2,
  error: AlertTriangle,
  info: Info,
};

const ACCENT = {
  success: "text-success",
  error: "text-danger",
  info: "text-info",
};

/** Mount once, near the app root. Renders whatever toastStore currently holds. */
export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => subscribeToasts(setItems), []);

  return (
    <RadixToast.Provider swipeDirection="right" duration={5000}>
      {items.map((item) => {
        const Icon = ICONS[item.variant];
        return (
          <RadixToast.Root
            key={item.id}
            onOpenChange={(open) => {
              if (!open) dismissToast(item.id);
            }}
            className={cn(
              "grid grid-cols-[auto_1fr_auto] items-start gap-2 rounded-md border border-border bg-surface p-3 shadow-card",
              "data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom-2",
              "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
              "data-[swipe=end]:animate-out",
            )}
          >
            <Icon
              className={cn("mt-0.5 h-4 w-4 shrink-0", ACCENT[item.variant])}
              aria-hidden="true"
            />
            <div className="min-w-0">
              <RadixToast.Title className="text-sm font-medium text-text">
                {item.title}
              </RadixToast.Title>
              {item.description && (
                <RadixToast.Description className="mt-0.5 text-xs text-subtle">
                  {item.description}
                </RadixToast.Description>
              )}
            </div>
            <RadixToast.Close
              aria-label="Dismiss"
              className="rounded p-0.5 text-subtle hover:bg-surface-alt hover:text-text"
            >
              <X className="h-3.5 w-3.5" />
            </RadixToast.Close>
          </RadixToast.Root>
        );
      })}
      <RadixToast.Viewport className="fixed bottom-0 right-0 z-[100] flex w-full max-w-sm flex-col gap-2 p-4 outline-none" />
    </RadixToast.Provider>
  );
}
