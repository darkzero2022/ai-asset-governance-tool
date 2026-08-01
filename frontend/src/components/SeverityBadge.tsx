type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

const severityClasses: Record<Severity, string> = {
  LOW: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  MEDIUM: "bg-amber-50 text-amber-700 ring-amber-100",
  HIGH: "bg-orange-50 text-orange-700 ring-orange-100",
  CRITICAL: "bg-red-50 text-red-700 ring-red-100",
};

export function SeverityBadge(props: { severity?: string | null }) {
  const severity = props.severity as Severity | undefined;
  const classes = severity && severity in severityClasses ? severityClasses[severity] : "bg-slate-50 text-slate-600 ring-slate-100";
  const label = severity ? severity.replace(/_/g, " ") : "UNKNOWN";

  return <span className={`rounded-full px-2 py-1 text-xs font-semibold ring-1 ${classes}`}>{label}</span>;
}
