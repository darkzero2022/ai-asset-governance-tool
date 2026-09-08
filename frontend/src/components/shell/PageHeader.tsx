import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  action,
  filters,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  filters?: ReactNode;
}) {
  return (
    <div className="mb-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text">{title}</h1>
          {description && <p className="mt-0.5 text-sm text-subtle">{description}</p>}
        </div>
        {action}
      </div>
      {filters && <div className="mt-4">{filters}</div>}
    </div>
  );
}
