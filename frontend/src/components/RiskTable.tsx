import type { ReactNode } from "react";
import { Eye, Pencil } from "lucide-react";
import type { Column } from "./DataGrid";
import { DataGrid } from "./DataGrid";
import { SeverityBadge } from "./ui/Badge";
import { DropdownMenuItem } from "./ui/DropdownMenu";

type Risk = {
  id: string;
  description: string;
  sourceFramework: string;
  sourceCategoryId: string;
  strideAiCategory?: string | null;
  atlasTechnique?: string | null;
  inherentRiskScore: number;
  residualRiskScore?: number | null;
  likelihood?: number;
  impact?: number;
  severity?: string | null;
  dueDate?: string | null;
  assetId?: string;
  status: string;
  asset?: { name: string } | null;
  assets?: Array<unknown>;
  controls?: Array<unknown>;
  controlLinks?: Array<unknown>;
};

type RiskTableProps = {
  risks: Risk[];
  selectedIds: string[];
  label: (value: string) => string;
  onToggle: (id: string) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- callers pass their own, slightly different local Risk shape
  onEdit?: (risk: any) => void;
  onOpen?: (id: string) => void;
  bulkActions?: ReactNode;
  pagination?: { skip: number; take: number; total: number };
  onPageChange?: (next: { skip: number; take: number }) => void;
};

function linkedAssetCount(risk: Risk) {
  return risk.assets?.length ?? (risk.asset ? 1 : 0);
}

function linkedControlCount(risk: Risk) {
  return risk.controls?.length ?? risk.controlLinks?.length ?? 0;
}

export function RiskTable({
  risks,
  selectedIds,
  label,
  onToggle,
  onEdit,
  onOpen,
  bulkActions,
  pagination,
  onPageChange,
}: RiskTableProps) {
  const columns: Column<Risk>[] = [
    {
      key: "severity",
      header: "Severity",
      sortValue: (risk) => risk.severity ?? "",
      render: (risk) => <SeverityBadge severity={risk.severity} />,
    },
    {
      key: "framework",
      header: "Framework",
      sortValue: (risk) => `${risk.sourceFramework}:${risk.sourceCategoryId}`,
      render: (risk) => (
        <div>
          <span className="font-medium text-text">{risk.sourceFramework}</span>
          <span className="block text-xs text-subtle">{risk.sourceCategoryId}</span>
        </div>
      ),
    },
    {
      key: "strideAi",
      header: "STRIDE-AI / ATLAS",
      sortValue: (risk) => `${risk.strideAiCategory ?? "~"}:${risk.atlasTechnique ?? "~"}`,
      render: (risk) => (
        <div>
          {risk.strideAiCategory ? (
            <span className="font-medium text-text">{label(risk.strideAiCategory)}</span>
          ) : (
            <span className="text-disabled">Not mapped</span>
          )}
          <span className="block text-xs text-subtle">
            {risk.atlasTechnique ?? "No ATLAS technique"}
          </span>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortValue: (risk) => risk.status,
      render: (risk) => label(risk.status),
    },
    {
      key: "dueDate",
      header: "Due Date",
      sortValue: (risk) => (risk.dueDate ? new Date(risk.dueDate).getTime() : 0),
      render: (risk) => (risk.dueDate ? new Date(risk.dueDate).toLocaleDateString() : "Not set"),
    },
    {
      key: "assets",
      header: "Assets",
      align: "right",
      sortValue: linkedAssetCount,
      render: linkedAssetCount,
    },
    {
      key: "controls",
      header: "Controls",
      align: "right",
      sortValue: linkedControlCount,
      render: linkedControlCount,
    },
    {
      key: "score",
      header: "Score",
      align: "right",
      sortValue: (risk) => risk.inherentRiskScore,
      render: (risk) => (
        <span className="rounded-full bg-surface-alt px-2 py-0.5 text-xs font-bold text-text">
          {risk.inherentRiskScore}
        </span>
      ),
    },
    {
      key: "description",
      header: "Description",
      render: (risk) => (
        <div className="max-w-sm">
          <p className="line-clamp-2 text-text">{risk.description}</p>
          <p className="text-xs text-subtle">{risk.asset?.name ?? "Unlinked risk"}</p>
        </div>
      ),
    },
  ];

  return (
    <DataGrid
      columns={columns}
      rows={risks}
      rowKey={(risk) => risk.id}
      defaultSortKey="score"
      emptyTitle="No risks match the current filters."
      onRowClick={onOpen ? (risk) => onOpen(risk.id) : undefined}
      selectedIds={onEdit ? selectedIds : undefined}
      onToggleSelect={onEdit ? onToggle : undefined}
      bulkActions={bulkActions}
      pagination={pagination}
      onPageChange={onPageChange}
      rowActions={(risk) => (
        <>
          {onOpen && (
            <DropdownMenuItem onSelect={() => onOpen(risk.id)}>
              <Eye className="h-3.5 w-3.5" /> View risk
            </DropdownMenuItem>
          )}
          {onEdit && (
            <DropdownMenuItem onSelect={() => onEdit(risk)}>
              <Pencil className="h-3.5 w-3.5" /> Edit risk
            </DropdownMenuItem>
          )}
        </>
      )}
    />
  );
}
