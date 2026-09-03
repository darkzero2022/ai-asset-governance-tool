import { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";
import { severityOf } from "../riskScoring.js";
import { resolveStrideAtlas } from "../strideAtlas.js";
import type { riskSchema } from "../schemas.js";
import type { z } from "zod";

/** OWASP-linked risks auto-fill STRIDE-AI / ATLAS from the seeded lookup. */
export async function strideAtlasFor(body: z.infer<typeof riskSchema>) {
  const mapping =
    body.sourceFramework === "OWASP_LLM_TOP10"
      ? await prisma.strideAtlasMapping.findUnique({ where: { owaspCategoryId: body.sourceCategoryId } })
      : null;
  return resolveStrideAtlas(body, mapping);
}

export async function countRiskSeverityBuckets(where: Prisma.RiskWhereInput = {}) {
  const severities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
  const scores = Array.from({ length: 25 }, (_, index) => index + 1);
  const entries = await Promise.all(
    severities.map(async (severity) => {
      const matchingScores = scores.filter((score) => severityOf(score) === severity);
      const count = await prisma.risk.count({
        where: { ...where, inherentRiskScore: { in: matchingScores } },
      });
      return [severity, count] as const;
    }),
  );

  return Object.fromEntries(entries);
}
