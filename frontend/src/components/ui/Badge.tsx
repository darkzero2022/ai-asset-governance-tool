import type { ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/cn";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
  {
    variants: {
      variant: {
        neutral: "bg-surface-alt text-subtle ring-border",
        primary: "bg-primary/12 text-primary ring-primary/30",
        success: "bg-success/15 text-success ring-success/30",
        warning: "bg-warning/15 text-warning ring-warning/30",
        danger: "bg-danger/15 text-danger ring-danger/30",
        critical: "bg-severity-critical/15 text-severity-critical ring-severity-critical/30",
        high: "bg-severity-high/15 text-severity-high ring-severity-high/30",
        medium: "bg-severity-medium/15 text-severity-medium ring-severity-medium/30",
        low: "bg-severity-low/15 text-severity-low ring-severity-low/30",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
);

export interface BadgeProps extends VariantProps<typeof badgeVariants> {
  children: ReactNode;
  className?: string;
}

export function Badge({ variant, className, children }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)}>{children}</span>;
}

const SEVERITY_VARIANT: Record<string, BadgeProps["variant"]> = {
  CRITICAL: "critical",
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
};

/** Severity is never color-only: the label text always ships with the badge. */
export function SeverityBadge({ severity }: { severity?: string | null }) {
  const value = severity ?? "UNKNOWN";
  return <Badge variant={SEVERITY_VARIANT[value] ?? "neutral"}>{value}</Badge>;
}
