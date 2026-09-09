import type { ReactNode, TableHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

/** Bare table chrome (borders, sticky header, zebra) shared by DataGrid and
 * any one-off table that doesn't need DataGrid's sorting/selection/pagination. */
export function Table({ className, ...props }: TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table
        className={cn("w-full min-w-full border-collapse text-left text-sm", className)}
        {...props}
      />
    </div>
  );
}

export function Thead({ children }: { children: ReactNode }) {
  return (
    <thead className="sticky top-0 z-10 bg-surface-alt text-xs font-semibold uppercase tracking-wide text-subtle">
      {children}
    </thead>
  );
}

export function Tbody({ children }: { children: ReactNode }) {
  return (
    <tbody className="divide-y divide-border [&>tr:nth-child(even)]:bg-surface-alt/40">
      {children}
    </tbody>
  );
}
