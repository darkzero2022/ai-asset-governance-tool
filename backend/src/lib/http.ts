import type express from "express";

// Hard ceilings for endpoints that return a whole set rather than a page. A cap
// here is a safety valve against a runaway table, not a UX pagination limit.
export const MAX_EXPORT_ROWS = 10_000; // CSV / bulk exports
export const MAX_LIST_ROWS = 2_000; // pickers, admin lists, dashboard scans

/** Bounded pagination for list endpoints: skip >= 0, take in [1, 100]. */
export function pagination(query: express.Request["query"]) {
  const skip = Math.max(Number(query.skip ?? 0) || 0, 0);
  const requestedTake = Math.max(Number(query.take ?? 50) || 50, 1);
  return { skip, take: Math.min(requestedTake, 100) };
}

/** CSV cell with formula-injection guarding and quoting. */
export function csvValue(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  const safeText = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\r\n]/.test(safeText) ? `"${safeText.replace(/"/g, '""')}"` : safeText;
}

export function csv(rows: unknown[][]) {
  return rows.map((row) => row.map(csvValue).join(",")).join("\n");
}
