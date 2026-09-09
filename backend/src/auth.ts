import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { Role } from "@prisma/client";
import { prisma } from "./prisma.js";
import { setUserId } from "./middleware/requestContext.js";
import { AppError, unauthorized } from "./httpError.js";

export type AuthUser = {
  id: string;
  email: string;
  role: Role;
};

type AccessTokenPayload = AuthUser & { tokenVersion: number; typ: "access" };

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

// Short-lived: the browser holds it in memory and silently refreshes via the
// httpOnly refresh cookie. API scripts / CI use it directly as a Bearer token.
const ACCESS_TOKEN_TTL = "15m";

function jwtSecret() {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is required");
  }

  return process.env.JWT_SECRET;
}

export function signAccessToken(user: AuthUser, tokenVersion: number) {
  const payload: AccessTokenPayload = { id: user.id, email: user.email, role: user.role, tokenVersion, typ: "access" };
  return jwt.sign(payload, jwtSecret(), { expiresIn: ACCESS_TOKEN_TTL });
}

/** Back-compat for tests/scripts that mint a token for a user with no explicit
 *  version (seeded users start at tokenVersion 0). */
export function signToken(user: AuthUser) {
  return signAccessToken(user, 0);
}

function extractToken(req: Request): string | undefined {
  const header = req.header("authorization");
  if (header?.startsWith("Bearer ")) return header.slice(7);
  const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
  return cookies?.access_token;
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = extractToken(req);

  if (!token) {
    next(unauthorized());
    return;
  }

  let payload: AccessTokenPayload;
  try {
    payload = jwt.verify(token, jwtSecret()) as AccessTokenPayload;
  } catch {
    next(new AppError(401, "INVALID_TOKEN", "Invalid or expired token"));
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: payload.id }, select: { active: true, tokenVersion: true } });

  if (!user?.active) {
    next(new AppError(401, "ACCOUNT_DEACTIVATED", "User account is deactivated"));
    return;
  }

  if ((payload.tokenVersion ?? 0) !== user.tokenVersion) {
    // Password changed / "log out everywhere" / admin reset since this token was
    // issued. Distinct code so the SPA tries a refresh before giving up.
    next(new AppError(401, "TOKEN_STALE", "Session is no longer valid"));
    return;
  }

  req.user = { id: payload.id, email: payload.email, role: payload.role };
  setUserId(payload.id);
  next();
}
