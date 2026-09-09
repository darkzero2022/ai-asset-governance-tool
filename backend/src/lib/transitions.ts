import type { AssetStatus } from "@prisma/client";

export const allowedTransitions: Record<AssetStatus, AssetStatus[]> = {
  DRAFT: ["UNDER_REVIEW"],
  UNDER_REVIEW: ["APPROVED", "DRAFT"],
  APPROVED: ["DEPLOYED", "UNDER_REVIEW"],
  DEPLOYED: ["RETIRED"],
  RETIRED: [],
};

export function requiredRoleForTransition(toStatus: AssetStatus) {
  if (toStatus === "UNDER_REVIEW" || toStatus === "DRAFT") return "RISK_OWNER";
  if (toStatus === "APPROVED" || toStatus === "DEPLOYED" || toStatus === "RETIRED")
    return "APPROVER";
  return null;
}
