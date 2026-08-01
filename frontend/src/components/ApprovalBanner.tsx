type Risk = { id: string; description: string; status: string; inherentRiskScore: number; severity?: string | null };
type ModelCard = { completeness?: { missingFields: string[] } } | null;
type ModelCardCompleteness = { missingFields: string[] };

export function ApprovalBanner({ risks, assetType, modelCard, modelCardCompleteness }: { risks: Risk[]; assetType?: string; modelCard?: ModelCard; modelCardCompleteness?: ModelCardCompleteness }) {
  const blockingRisks = risks.filter((risk) => (risk.status === "OPEN" || risk.status === "IN_PROGRESS") && (risk.severity === "HIGH" || risk.severity === "CRITICAL"));
  const requiresModelCard = assetType === "MODEL" || assetType === "SERVICE";
  const missingModelCardFields = requiresModelCard ? modelCardCompleteness?.missingFields ?? modelCard?.completeness?.missingFields ?? [] : [];

  if (!blockingRisks.length && !missingModelCardFields.length) {
    return <div className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800 ring-1 ring-emerald-100">No open high or critical risks are blocking approval or deployment.</div>;
  }

  return (
    <div className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-100">
      <p className="font-semibold">Approval/deployment blocked</p>
      <p className="mt-1">Resolve these governance blockers before moving to Approved or Deployed.</p>
      <ul className="mt-3 space-y-1">
        {blockingRisks.map((risk) => <li key={risk.id}>{risk.description} ({risk.inherentRiskScore})</li>)}
        {missingModelCardFields.length ? <li>Model Card incomplete: {missingModelCardFields.join(", ")}</li> : null}
      </ul>
    </div>
  );
}
