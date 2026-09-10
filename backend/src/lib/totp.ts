import crypto from "node:crypto";
import { authenticator } from "otplib";
import QRCode from "qrcode";
import { prisma } from "../prisma.js";

// Allow one 30s step of clock skew either way.
authenticator.options = { window: 1 };

const ISSUER = "AI Asset Governance";
const RECOVERY_CODE_COUNT = 10;

export function generateSecret(): string {
  return authenticator.generateSecret();
}

export function otpauthUrl(email: string, secret: string): string {
  return authenticator.keyuri(email, ISSUER, secret);
}

export async function qrDataUri(email: string, secret: string): Promise<string> {
  return QRCode.toDataURL(otpauthUrl(email, secret), { margin: 1, width: 240 });
}

export function verifyTotp(code: string, secret: string): boolean {
  const normalized = code.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(normalized)) return false;
  try {
    return authenticator.check(normalized, secret);
  } catch {
    return false;
  }
}

function hashCode(raw: string): string {
  return crypto.createHash("sha256").update(raw.toLowerCase()).digest("hex");
}

/** A readable code like "4f2a-9c1e". */
function makeRecoveryCode(): string {
  const hex = crypto.randomBytes(4).toString("hex");
  return `${hex.slice(0, 4)}-${hex.slice(4)}`;
}

/** Replaces any existing codes; returns the plaintext set (shown once). */
export async function issueRecoveryCodes(userId: string): Promise<string[]> {
  const codes = Array.from({ length: RECOVERY_CODE_COUNT }, makeRecoveryCode);
  await prisma.$transaction([
    prisma.totpRecoveryCode.deleteMany({ where: { userId } }),
    prisma.totpRecoveryCode.createMany({
      data: codes.map((code) => ({ userId, codeHash: hashCode(code) })),
    }),
  ]);
  return codes;
}

/** Consumes a recovery code; true if it was valid and unused. */
export async function consumeRecoveryCode(userId: string, raw: string): Promise<boolean> {
  const normalized = raw.replace(/\s+/g, "").toLowerCase();
  if (!/^[0-9a-f]{4}-[0-9a-f]{4}$/.test(normalized)) return false;
  const match = await prisma.totpRecoveryCode.findFirst({
    where: { userId, codeHash: hashCode(normalized), usedAt: null },
  });
  if (!match) return false;
  await prisma.totpRecoveryCode.update({ where: { id: match.id }, data: { usedAt: new Date() } });
  return true;
}

export async function unusedRecoveryCodeCount(userId: string): Promise<number> {
  return prisma.totpRecoveryCode.count({ where: { userId, usedAt: null } });
}

/** Verify either a 6-digit TOTP or a single-use recovery code. */
export async function verifySecondFactor(
  user: { id: string; totpSecret: string | null },
  code: string,
): Promise<boolean> {
  if (!user.totpSecret) return false;
  if (verifyTotp(code, user.totpSecret)) return true;
  return consumeRecoveryCode(user.id, code);
}
