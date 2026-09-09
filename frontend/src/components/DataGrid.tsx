import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, MoreVertical } from "lucide-react";
import { cn } from "../lib/cn";
import { Table, Tbody, Thead } from "./ui/Table";
import { SkeletonRows } from "./ui/Skeleton";
import { EmptyState } from "./ui/EmptyState";
import { Pagination } from "./ui/Pagination";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "./ui/DropdownMenu";

export type Column<T> = {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number;
  align?: "left" | "right";
  className?: string;
};

type PaginationState = { skip: number; take: number; total: number };

export interface DataGridProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  isLoading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  defaultSortKey?: string;
  onRowClick?: (row: T) => void;
  selectedIds?: string[];
  onToggleSelect?: (id: string) => void;
  bulkActions?: ReactNode;
  rowActions?: (row: T) => ReactNode;
  pagination?: PaginationState;
  onPageChange?: (next: { skip: number; take: number }) => void;
  compact?: boolean;
}

/** The one dense, sortable, Wazuh-like table pattern — AssetTable, RiskTable,
 * and ProjectTable are all thin column definitions on top of this. */
export function DataGrid<T>({
  columns,
  rows,
  rowKey,
  isLoading,
  emptyTitle = "Nothing here yet.",
  emptyDescription,
  defaultSortKey,
  onRowClick,
  selectedIds,
  onToggleSelect,
  bulkActions,
  rowActions,
  pagination,
  onPageChange,
  compact = true,
}: DataGridProps<T>) {
  const [sortKey, setSortKey] = useState<string | undefined>(defaultSortKey);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const selectable = Boolean(onToggleSelect);

  const sortedRows = useMemo(() => {
    const column = columns.find((item) => item.key === sortKey);
    if (!column?.sortValue) return rows;
    const direction = sortDirection === "asc" ? 1 : -1;
    return [...rows].sort((left, right) => {
      const a = column.sortValue!(left);
      const b = column.sortValue!(right);
      if (a < b) return -1 * direction;
      if (a > b) return 1 * direction;
      return 0;
    });
  }, [rows, columns, sortKey, sortDirection]);

  function changeSort(key: string) {
    if (key === sortKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection("desc");
  }

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border p-4">
        <SkeletonRows rows={5} />
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="rounded-lg border border-border">
        <EmptyState title={emptyTitle} description={emptyDescription} />
      </div>
    );
  }

  return (
    <div className="relative">
      <Table>
        <Thead>
          <tr>
            {selectable && (
              <th className="w-10 py-2 pl-3">
                <span className="sr-only">Select</span>
              </th>
            )}
            {columns.map((column) => (
              <th
                key={column.key}
                className={cn("px-3 py-2", column.align === "right" && "text-right")}
              >
                {column.sortValue ? (
                  <button
                    className="inline-flex items-center gap-1 hover:text-text"
                    onClick={() => changeSort(column.key)}
                  >
                    {column.header}
                    <SortIcon active={sortKey === column.key} direction={sortDirection} />
                  </button>
                ) : (
                  column.header
                )}
              </th>
            ))}
            {rowActions && <th className="w-10 py-2 pr-3" />}
          </tr>
        </Thead>
        <Tbody>
          {sortedRows.map((row) => {
            const id = rowKey(row);
            return (
              <tr
                key={id}
                className={cn(
                  "h-row-default",
                  (onRowClick || selectable) && "cursor-pointer hover:bg-surface-alt",
                )}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {selectable && (
                  <td className="w-10 py-1 pl-3" onClick={(event) => event.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-border text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      checked={selectedIds?.includes(id) ?? false}
                      onChange={() => onToggleSelect?.(id)}
                      aria-label="Select row"
                    />
                  </td>
                )}
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(
                      "px-3 py-1.5 text-text",
                      compact ? "text-xs sm:text-sm" : "text-sm",
                      column.align === "right" && "text-right tabular-nums",
                      column.className,
                    )}
                  >
                    {column.render(row)}
                  </td>
                ))}
                {rowActions && (
                  <td className="w-10 pr-3 text-right" onClick={(event) => event.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className="rounded p-1 text-subtle hover:bg-surface hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          aria-label="Row actions"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>{rowActions(row)}</DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                )}
              </tr>
            );
          })}
        </Tbody>
      </Table>

      {pagination && onPageChange && <Pagination pagination={pagination} onChange={onPageChange} />}

      {selectable && (selectedIds?.length ?? 0) > 0 && (
        <div className="sticky bottom-0 mt-3 flex items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3 shadow-card animate-in slide-in-from-bottom-2">
          <p className="text-sm text-text">{selectedIds!.length} selected</p>
          <div className="flex gap-2">{bulkActions}</div>
        </div>
      )}
    </div>
  );
}

function SortIcon({ active, direction }: { active: boolean; direction: "asc" | "desc" }) {
  if (!active) return <ArrowUpDown className="h-3 w-3 text-disabled" aria-hidden="true" />;
  return direction === "asc" ? (
    <ArrowUp className="h-3 w-3" aria-hidden="true" />
  ) : (
    <ArrowDown className="h-3 w-3" aria-hidden="true" />
  );
}
