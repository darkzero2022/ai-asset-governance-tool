import { AlertTriangle, CheckCircle2 } from "lucide-react";

type Risk = {
  id: string;
  description: string;
  status: string;
  inherentRiskScore: number;
  severity?: string | null;
};
type ModelCard = { completeness?: { missingFields: string[] } } | null;
type ModelCardCompleteness = { missingFields: string[] };

export function ApprovalBanner({
  risks,
  assetType,
  modelCard,
  modelCardCompleteness,
}: {
  risks: Risk[];
  assetType?: string;
  modelCard?: ModelCard;
  modelCardCompleteness?: ModelCardCompleteness;
}) {
  const blockingRisks = risks.filter(
    (risk) =>
      (risk.status === "OPEN" || risk.status === "IN_PROGRESS") &&
      (risk.severity === "HIGH" || risk.severity === "CRITICAL"),
  );
  const requiresModelCard = assetType === "MODEL" || assetType === "SERVICE";
  const missingModelCardFields = requiresModelCard
    ? (modelCardCompleteness?.missingFields ?? modelCard?.completeness?.missingFields ?? [])
    : [];

  if (!blockingRisks.length && !missingModelCardFields.length) {
    return (
      <div className="mt-5 flex items-start gap-2 rounded-lg bg-success/10 p-4 text-sm text-success ring-1 ring-success/20">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <p>No open high or critical risks are blocking approval or deployment.</p>
      </div>
    );
  }

  return (
    <div className="mt-5 rounded-lg bg-warning/10 p-4 text-sm text-text ring-1 ring-warning/20">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
        <div>
          <p className="font-semibold">Approval/deployment blocked</p>
          <p className="mt-1 text-subtle">
            Resolve these governance blockers before moving to Approved or Deployed.
          </p>
        </div>
      </div>
      <ul className="mt-3 ml-6 list-disc space-y-1">
        {blockingRisks.map((risk) => (
          <li key={risk.id}>
            {risk.description} ({risk.inherentRiskScore})
          </li>
        ))}
        {missingModelCardFields.length ? (
          <li>Model Card incomplete: {missingModelCardFields.join(", ")}</li>
        ) : null}
      </ul>
    </div>
  );
}
