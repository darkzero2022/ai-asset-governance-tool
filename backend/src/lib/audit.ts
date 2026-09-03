import { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";

/** Write an audit-log row for a mutation. */
export async function audit(
  actorId: string,
  entityType: string,
  entityId: string,
  action: string,
  beforeJson: unknown,
  afterJson: unknown,
) {
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
