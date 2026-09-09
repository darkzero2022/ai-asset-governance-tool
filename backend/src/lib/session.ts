import crypto from "node:crypto";
import type { CookieOptions, Request, Response } from "express";
import { prisma } from "../prisma.js";

export const REFRESH_COOKIE = "refresh_token";
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
export const REFRESH_COOKIE_PATH = "/api/v1/auth";

function hash(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

function clientMeta(req: Request) {
  const ua = req.header("user-agent");
  return { userAgent: ua ? ua.slice(0, 400) : null, ip: req.ip ?? null };
}

/** Cookie options for the refresh token. Path-scoped to /api/v1/auth so it is
 *  never sent to normal API routes; SameSite=Strict blocks cross-site use. */
export function refreshCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: REFRESH_COOKIE_PATH,
    maxAge: REFRESH_TTL_MS,
  };
}

export function setRefreshCookie(res: Response, rawToken: string): void {
  res.cookie(REFRESH_COOKIE, rawToken, refreshCookieOptions());
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE, { ...refreshCookieOptions(), maxAge: undefined });
}

/** Mint a new refresh token + persist its hash. Returns the raw token for the cookie. */
export async function createSession(userId: string, req: Request): Promise<string> {
  const rawToken = crypto.randomBytes(32).toString("base64url");
  await prisma.session.create({
    data: {
      userId,
      tokenHash: hash(rawToken),
      expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
      ...clientMeta(req),
    },
  });
  return rawToken;
}

/** Validate + rotate: consume the presented refresh token, issue a fresh one. */
export async function rotateSession(
  rawToken: string | undefined,
  req: Request,
): Promise<{ userId: string; rawToken: string } | null> {
  if (!rawToken) return null;
  const existing = await prisma.session.findUnique({ where: { tokenHash: hash(rawToken) } });
  if (!existing || existing.expiresAt.getTime() < Date.now()) {
    if (existing) await prisma.session.delete({ where: { id: existing.id } }).catch(() => {});
    return null;
  }
  await prisma.session.delete({ where: { id: existing.id } });
  const next = await createSession(existing.userId, req);
  return { userId: existing.userId, rawToken: next };
}

export async function revokeSessionByToken(rawToken: string | undefined): Promise<void> {
  if (!rawToken) return;
  await prisma.session.deleteMany({ where: { tokenHash: hash(rawToken) } });
}

export async function revokeSession(id: string, userId: string): Promise<number> {
  const { count } = await prisma.session.deleteMany({ where: { id, userId } });
  return count;
}

/** "Log out everywhere": drop every session AND bump tokenVersion so any
 *  outstanding access token is rejected. */
export async function revokeAllForUser(userId: string): Promise<void> {
  await prisma.$transaction([
    prisma.session.deleteMany({ where: { userId } }),
    prisma.user.update({ where: { id: userId }, data: { tokenVersion: { increment: 1 } } }),
  ]);
}

export async function listSessions(userId: string, currentRawToken: string | undefined) {
  const currentHash = currentRawToken ? hash(currentRawToken) : null;
  const rows = await prisma.session.findMany({
    where: { userId },
    orderBy: { lastUsedAt: "desc" },
  });
  return rows.map((row) => ({
    id: row.id,
    userAgent: row.userAgent,
    ip: row.ip,
    createdAt: row.createdAt,
    lastUsedAt: row.lastUsedAt,
    current: row.tokenHash === currentHash,
  }));
}
