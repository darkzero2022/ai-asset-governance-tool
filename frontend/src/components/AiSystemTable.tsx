import type { Column } from "./DataGrid";
import { DataGrid } from "./DataGrid";
import { Badge } from "./ui/Badge";
import { DropdownMenuItem } from "./ui/DropdownMenu";
import { Pencil, Download } from "lucide-react";

type Asset = {
  id: string;
  name: string;
  version: string;
  type: string;
  supplier: string;
  hostingModel: string;
  status: string;
  updatedAt?: string;
  _count?: { risks: number };
  projectUsageCount?: number;
};

type AiSystemTableProps = {
  assets: Asset[];
  label: (value: string) => string;
  onSelect: (id: string) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- callers pass their own, slightly different local Asset shape
  onEdit?: (asset: any) => void;
  onExport: (id: string) => void;
};

export function AiSystemTable({ assets, label, onSelect, onEdit, onExport }: AiSystemTableProps) {
  const columns: Column<Asset>[] = [
    {
      key: "name",
      header: "Name",
      sortValue: (asset) => asset.name,
      render: (asset) => (
        <div className="min-w-0">
          <button
            className="truncate text-left font-medium text-text hover:text-primary"
            onClick={() => onSelect(asset.id)}
          >
            {asset.name}
          </button>
          <p className="truncate text-xs text-subtle">
            v{asset.version} · {label(asset.hostingModel)}
          </p>
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      sortValue: (asset) => asset.type,
      render: (asset) => label(asset.type),
    },
    {
      key: "supplier",
      header: "Supplier",
      sortValue: (asset) => asset.supplier,
      render: (asset) => asset.supplier,
    },
    {
      key: "status",
      header: "Status",
      sortValue: (asset) => asset.status,
      render: (asset) => <Badge variant="primary">{label(asset.status)}</Badge>,
    },
    {
      key: "risks",
      header: "Risks",
      align: "right",
      sortValue: (asset) => asset._count?.risks ?? 0,
      render: (asset) => asset._count?.risks ?? 0,
    },
    {
      key: "projects",
      header: "Projects",
      align: "right",
      sortValue: (asset) => asset.projectUsageCount ?? 0,
      render: (asset) => asset.projectUsageCount ?? 0,
    },
  ];

  return (
    <DataGrid
      columns={columns}
      rows={assets}
      rowKey={(asset) => asset.id}
      defaultSortKey="name"
      emptyTitle="No AI systems match the current filters."
      rowActions={(asset) => (
        <>
          {onEdit && (
            <DropdownMenuItem onSelect={() => onEdit(asset)}>
              <Pencil className="h-3.5 w-3.5" /> Edit
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={() => onExport(asset.id)}>
            <Download className="h-3.5 w-3.5" /> Export CycloneDX
          </DropdownMenuItem>
        </>
      )}
    />
  );
}
