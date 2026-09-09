import type { ComponentProps } from "react";
import * as RadixTabs from "@radix-ui/react-tabs";
import { cn } from "../../lib/cn";

export const Tabs = RadixTabs.Root;

export function TabsList({ className, ...props }: ComponentProps<typeof RadixTabs.List>) {
  return (
    <RadixTabs.List className={cn("flex gap-1 border-b border-border", className)} {...props} />
  );
}

export function TabsTrigger({ className, ...props }: ComponentProps<typeof RadixTabs.Trigger>) {
  return (
    <RadixTabs.Trigger
      className={cn(
        "border-b-2 border-transparent px-3 py-2 text-sm font-medium text-subtle hover:text-text",
        "data-[state=active]:border-primary data-[state=active]:text-primary",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: ComponentProps<typeof RadixTabs.Content>) {
  return (
    <RadixTabs.Content className={cn("pt-4 focus-visible:outline-none", className)} {...props} />
  );
}
