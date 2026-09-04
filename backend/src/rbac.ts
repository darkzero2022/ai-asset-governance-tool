import type { NextFunction, Request, Response } from "express";
import type { Role } from "@prisma/client";
import { forbidden, unauthorized } from "./httpError.js";

export function requireRole(...roles: Role[]) {
  const middleware = (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      next(unauthorized());
      return;
    }

    if (!roles.includes(req.user.role)) {
      next(forbidden("Insufficient permissions"));
      return;
    }

    next();
  };
  // Exposed so the OpenAPI generator (src/openapi.ts) can introspect a route's
  // role gate from the express router stack without re-declaring it by hand.
  middleware.allowedRoles = roles;
  return middleware;
}

export function canTransitionAsset(role: Role, toStatus: string) {
  if (role === "ADMIN") return true;
  if (role === "RISK_OWNER") return toStatus === "UNDER_REVIEW" || toStatus === "DRAFT";
  if (role === "APPROVER") return toStatus === "APPROVED" || toStatus === "DEPLOYED" || toStatus === "RETIRED";
  return false;
}
