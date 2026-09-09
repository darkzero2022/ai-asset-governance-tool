import type { CurrentUser } from "@aibom/shared";

/**
 * Mirrors backend/src/rbac.ts — the backend is the source of truth (every
 * write is enforced there regardless of what the UI shows), this just keeps
 * the UI from offering controls a role can't use. RISK_OWNER's additional
 * ownership scoping (can only edit records they created) is enforced only
 * server-side: replicating it here would need createdById on every list
 * row and would still just be a UX nicety, not a security boundary.
 */
export function hasRole(user: CurrentUser | null, ...roles: string[]): boolean {
  return Boolean(user && roles.includes(user.role));
}

export function canManage(user: CurrentUser | null): boolean {
  return hasRole(user, "ADMIN", "RISK_OWNER");
}

export function canTransitionAsset(user: CurrentUser | null, toStatus: string): boolean {
  if (!user) return false;
  if (user.role === "ADMIN") return true;
  if (user.role === "RISK_OWNER") return toStatus === "UNDER_REVIEW" || toStatus === "DRAFT";
  if (user.role === "APPROVER")
    return toStatus === "APPROVED" || toStatus === "DEPLOYED" || toStatus === "RETIRED";
  return false;
}
