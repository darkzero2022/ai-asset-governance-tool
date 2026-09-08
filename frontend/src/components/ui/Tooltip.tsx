import type { ReactNode } from "react";
import * as RadixTooltip from "@radix-ui/react-tooltip";

export function TooltipProvider({ children }: { children: ReactNode }) {
  return <RadixTooltip.Provider delayDuration={300}>{children}</RadixTooltip.Provider>;
}

export function Tooltip({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <RadixTooltip.Root>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          sideOffset={6}
          className="z-50 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-text shadow-card data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0"
        >
          {label}
          <RadixTooltip.Arrow className="fill-surface" />
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}
