import { useMemo, useState } from "react";
import { Pagination } from "./Pagination";
import { SeverityBadge } from "./SeverityBadge";

type Risk = {
  id: string;
  description: string;
  sourceFramework: string;
  sourceCategoryId: string;
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

type SortKey = "severity" | "framework" | "status" | "dueDate" | "assets" | "controls" | "score";

const severityOrder: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

type RiskTableProps = {
  risks: Risk[];
  selectedIds: string[];
  label: (value: string) => string;
  onToggle: (id: string) => void;
  onEdit: (risk: any) => void;
  onOpen?: (id: string) => void;
  pagination?: { skip: number; take: number; total: number };
  onPageChange?: (next: { skip: number; take: number }) => void;
};

export function RiskTable({ risks, selectedIds, label, onToggle, onEdit, onOpen, pagination, onPageChange }: RiskTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const sortedRisks = useMemo(() => {
    return [...risks].sort((left, right) => {
      const leftValue = sortValue(left, sortKey);
      const rightValue = sortValue(right, sortKey);
      const direction = sortDirection === "asc" ? 1 : -1;

      if (leftValue < rightValue) return -1 * direction;
      if (leftValue > rightValue) return 1 * direction;
      return 0;
    });
  }, [risks, sortDirection, sortKey]);

  function changeSort(nextKey: SortKey) {
    if (nextKey === sortKey) {
      setSortDirection((current) => current === "asc" ? "desc" : "asc");
      return;
    }

    setSortKey(nextKey);
    setSortDirection("desc");
  }

  return (
    <div className="mt-5 overflow-x-auto">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="border-b border-slate-700 text-xs uppercase tracking-wide text-slate-400">
          <tr>
            <th className="py-3 pr-3">Select</th>
            <SortableHeader label="Severity" active={sortKey === "severity"} direction={sortDirection} onClick={() => changeSort("severity")} />
            <SortableHeader label="Framework" active={sortKey === "framework"} direction={sortDirection} onClick={() => changeSort("framework")} />
            <SortableHeader label="Status" active={sortKey === "status"} direction={sortDirection} onClick={() => changeSort("status")} />
            <SortableHeader label="Due Date" active={sortKey === "dueDate"} direction={sortDirection} onClick={() => changeSort("dueDate")} />
            <SortableHeader label="Assets" active={sortKey === "assets"} direction={sortDirection} onClick={() => changeSort("assets")} />
            <SortableHeader label="Controls" active={sortKey === "controls"} direction={sortDirection} onClick={() => changeSort("controls")} />
            <SortableHeader label="Score" active={sortKey === "score"} direction={sortDirection} onClick={() => changeSort("score")} />
            <th className="py-3">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {sortedRisks.map((risk) => (
            <tr key={risk.id} className="align-top">
              <td className="py-4 pr-3"><input type="checkbox" checked={selectedIds.includes(risk.id)} onChange={() => onToggle(risk.id)} /></td>
              <td className="py-4 pr-3"><SeverityBadge severity={risk.severity} /></td>
              <td className="py-4 pr-3"><span className="font-medium text-slate-100">{risk.sourceFramework}</span><span className="block text-xs text-slate-500">{risk.sourceCategoryId}</span></td>
              <td className="py-4 pr-3">{label(risk.status)}</td>
              <td className="py-4 pr-3">{risk.dueDate ? new Date(risk.dueDate).toLocaleDateString() : "Not set"}</td>
              <td className="py-4 pr-3">{linkedAssetCount(risk)}</td>
              <td className="py-4 pr-3">{linkedControlCount(risk)}</td>
              <td className="py-4 pr-3"><span className="rounded-full bg-slate-800 px-2 py-1 text-xs font-bold text-slate-100">{risk.inherentRiskScore}</span></td>
              <td className="py-4">
                <p className="mb-2 max-w-xs text-slate-300">{risk.description}</p>
                <p className="mb-2 text-xs text-slate-500">{risk.asset?.name ?? "Unlinked risk"}</p>
                {onOpen && <button className="mr-3 text-sm font-semibold text-cyan-300" onClick={() => onOpen(risk.id)}>View risk</button>}
                <button className="text-sm font-semibold text-cyan-300" onClick={() => onEdit(risk)}>Edit risk</button>
              </td>
            </tr>
          ))}
          {sortedRisks.length === 0 && <tr><td className="py-8 text-center text-slate-400" colSpan={9}>No risks match the current filters.</td></tr>}
        </tbody>
      </table>
      {pagination && onPageChange && <Pagination pagination={pagination} onChange={onPageChange} />}
    </div>
  );
}

function SortableHeader(props: { label: string; active: boolean; direction: "asc" | "desc"; onClick: () => void }) {
  return (
    <th className="py-3 pr-3">
      <button className="font-semibold hover:text-slate-100" onClick={props.onClick}>
        {props.label}{props.active ? ` ${props.direction === "asc" ? "up" : "down"}` : ""}
      </button>
    </th>
  );
}

function sortValue(risk: Risk, sortKey: SortKey) {
  if (sortKey === "severity") return severityOrder[risk.severity ?? ""] ?? 0;
  if (sortKey === "framework") return `${risk.sourceFramework}:${risk.sourceCategoryId}`;
  if (sortKey === "status") return risk.status;
  if (sortKey === "dueDate") return risk.dueDate ? new Date(risk.dueDate).getTime() : 0;
  if (sortKey === "assets") return linkedAssetCount(risk);
  if (sortKey === "controls") return linkedControlCount(risk);
  return risk.inherentRiskScore;
}

function linkedAssetCount(risk: Risk) {
  return risk.assets?.length ?? (risk.asset ? 1 : 0);
}

function linkedControlCount(risk: Risk) {
  return risk.controls?.length ?? risk.controlLinks?.length ?? 0;
}
