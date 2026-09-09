import type { ComponentProps, ReactNode } from "react";
import * as RadixDropdown from "@radix-ui/react-dropdown-menu";
import { cn } from "../../lib/cn";

export const DropdownMenu = RadixDropdown.Root;
export const DropdownMenuTrigger = RadixDropdown.Trigger;

export function DropdownMenuContent({
  className,
  align = "end",
  ...props
}: ComponentProps<typeof RadixDropdown.Content>) {
  return (
    <RadixDropdown.Portal>
      <RadixDropdown.Content
        align={align}
        sideOffset={6}
        className={cn(
          "z-50 min-w-[180px] rounded-md border border-border bg-surface p-1 shadow-card",
          "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
          className,
        )}
        {...props}
      />
    </RadixDropdown.Portal>
  );
}

export function DropdownMenuItem({
  className,
  ...props
}: ComponentProps<typeof RadixDropdown.Item>) {
  return (
    <RadixDropdown.Item
      className={cn(
        "flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-text outline-none",
        "focus:bg-surface-alt data-[disabled]:pointer-events-none data-[disabled]:opacity-40",
        className,
      )}
      {...props}
    />
  );
}

export function DropdownMenuLabel({ children }: { children: ReactNode }) {
  return (
    <div className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-subtle">
      {children}
    </div>
  );
}

export function DropdownMenuSeparator() {
  return <RadixDropdown.Separator className="my-1 h-px bg-border" />;
}
