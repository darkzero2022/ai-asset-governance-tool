import { Pencil } from "lucide-react";
import type { Column } from "./DataGrid";
import { DataGrid } from "./DataGrid";
import { DropdownMenuItem } from "./ui/DropdownMenu";

type Project = {
  id: string;
  name: string;
  description?: string | null;
  businessOwner?: string | null;
  status: string;
  _count?: { assetLinks?: number; riskLinks?: number };
};

type ProjectTableProps = {
  projects: Project[];
  label: (value: string) => string;
  onOpen: (id: string) => void;
  onEdit?: (project: Project) => void;
};

export function ProjectTable({ projects, label, onOpen, onEdit }: ProjectTableProps) {
  const columns: Column<Project>[] = [
    {
      key: "name",
      header: "Name",
      sortValue: (project) => project.name,
      render: (project) => (
        <div className="min-w-0">
          <button className="truncate text-left font-medium text-text hover:text-primary" onClick={() => onOpen(project.id)}>{project.name}</button>
          <p className="truncate text-xs text-subtle">{project.description || "No description"}</p>
        </div>
      ),
    },
    { key: "status", header: "Status", sortValue: (project) => project.status, render: (project) => label(project.status) },
    { key: "owner", header: "Owner", sortValue: (project) => project.businessOwner ?? "", render: (project) => project.businessOwner || "Unassigned" },
    { key: "assets", header: "Assets", align: "right", sortValue: (project) => project._count?.assetLinks ?? 0, render: (project) => project._count?.assetLinks ?? 0 },
    { key: "risks", header: "Risks", align: "right", sortValue: (project) => project._count?.riskLinks ?? 0, render: (project) => project._count?.riskLinks ?? 0 },
  ];

  return (
    <DataGrid
      columns={columns}
      rows={projects}
      rowKey={(project) => project.id}
      defaultSortKey="name"
      emptyTitle="No projects yet."
      onRowClick={(project) => onOpen(project.id)}
      rowActions={onEdit ? (project) => (
        <DropdownMenuItem onSelect={() => onEdit(project)}>
          <Pencil className="h-3.5 w-3.5" /> Edit
        </DropdownMenuItem>
      ) : undefined}
    />
  );
}
