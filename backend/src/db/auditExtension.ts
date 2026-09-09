import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { getUserId, recordAutoAudit } from "../middleware/requestContext.js";

// Models whose row-level create/update/delete/upsert are auto-audited. Reference
// tables and AuditLog itself are excluded.
const AUDITED_MODELS = new Set([
  "AIAsset",
  "Risk",
  "Control",
  "Project",
  "ModelCard",
  "ModelCardMetric",
  "RecertificationSchedule",
  "User",
  "AssetRisk",
  "AssetDependency",
  "ProjectAsset",
  "ProjectRisk",
  "RiskControl",
  "GovernanceWorkflow",
]);

const WRITE_OPS = new Set(["create", "update", "delete", "upsert"]);

function accessor(model: string) {
  return model.charAt(0).toLowerCase() + model.slice(1);
}

function json(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  return value === undefined || value === null
    ? Prisma.JsonNull
    : (JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue);
}

/**
 * A Prisma query extension that writes an AuditLog row for every row-level
 * mutation on an audited model — a safety net so coverage can't be lost by a
 * route forgetting to call audit(). It only fires inside a request that has an
 * authenticated actor (so seeds and jobs are unaffected). An explicit audit()
 * for the same entity supersedes the auto row (lib/audit.ts).
 *
 * `base` is the un-extended client, used for the before-image lookup and the
 * audit write so neither recurses back through this extension.
 */
export function auditExtension(base: PrismaClient) {
  return Prisma.defineExtension({
    name: "audit-log",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!AUDITED_MODELS.has(model) || !WRITE_OPS.has(operation)) {
            return query(args);
          }

          const actorId = getUserId();
          if (!actorId) return query(args);

          const table = (
            base as unknown as Record<string, { findUnique: (a: unknown) => Promise<unknown> }>
          )[accessor(model)];
          const where = (args as { where?: unknown }).where;

          let before: unknown;
          if (operation !== "create" && where) {
            before = await table.findUnique({ where }).catch(() => undefined);
          }

          const result = await query(args);

          const entityId =
            (result as { id?: string } | null)?.id ?? (before as { id?: string } | undefined)?.id;
          if (!entityId) return result;

          let action = operation.toUpperCase();
          if (operation === "upsert") action = before ? "UPDATE" : "CREATE";
          if (operation === "delete") before = before ?? result;

          const after = operation === "delete" ? undefined : result;
          const row = await base.auditLog.create({
            data: {
              actorId,
              entityType: model,
              entityId,
              action,
              beforeJson: json(before),
              afterJson: json(after),
            },
          });
          recordAutoAudit(`${model}:${entityId}`, row.id);

          return result;
        },
      },
    },
  });
}
