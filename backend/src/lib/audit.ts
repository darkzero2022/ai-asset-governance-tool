import { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";
import { takeAutoAudit } from "../middleware/requestContext.js";

/**
 * Write an audit-log row for a mutation. If the audit extension already wrote an
 * auto row for this entity in the current request, that row is removed first so
 * the explicit event (with its richer payload / domain action) is the only one.
 */
export async function audit(
  actorId: string,
  entityType: string,
  entityId: string,
  action: string,
  beforeJson: unknown,
  afterJson: unknown,
) {
  const supersededId = takeAutoAudit(`${entityType}:${entityId}`);
  if (supersededId) {
    await prisma.auditLog.delete({ where: { id: supersededId } }).catch(() => undefined);
  }
  await prisma.auditLog.create({
    data: {
      actorId,
      entityType,
      entityId,
      action,
      beforeJson: beforeJson === undefined ? Prisma.JsonNull : (beforeJson as Prisma.InputJsonValue),
      afterJson: afterJson === undefined ? Prisma.JsonNull : (afterJson as Prisma.InputJsonValue),
    },
  });
}
