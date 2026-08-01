import type { NextFunction, Request, Response } from "express";
import type { Role } from "@prisma/client";

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }

    next();
  };
}

export function canTransitionAsset(role: Role, toStatus: string) {
  if (role === "ADMIN") return true;
  if (role === "RISK_OWNER") return toStatus === "UNDER_REVIEW" || toStatus === "DRAFT";
  if (role === "APPROVER") return toStatus === "APPROVED" || toStatus === "DEPLOYED" || toStatus === "RETIRED";
  return false;
}
