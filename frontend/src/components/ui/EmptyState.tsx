import type { ComponentType, ReactNode } from "react";
import type { LucideProps } from "lucide-react";
import { Inbox } from "lucide-react";

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
}: {
  icon?: ComponentType<LucideProps>;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
      <Icon className="h-8 w-8 text-disabled" aria-hidden="true" />
      <p className="text-sm font-medium text-text">{title}</p>
      {description && <p className="max-w-sm text-sm text-subtle">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
