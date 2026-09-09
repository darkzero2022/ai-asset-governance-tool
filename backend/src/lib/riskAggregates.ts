import { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";
import { severityOf } from "../riskScoring.js";
import { resolveStrideAtlas } from "../strideAtlas.js";
import type { riskSchema } from "../schemas.js";
import type { z } from "zod";

/**
 * A risk auto-fills STRIDE-AI / ATLAS technique / suggested ATLAS mitigations
 * from the seeded FrameworkThreatMapping for its (framework, category) — any
 * framework with a mapping row, not just OWASP LLM. Every value the mapping
 * provides is a default the request can override.
 */
export async function strideAtlasFor(body: z.infer<typeof riskSchema>) {
  const mapping = await prisma.frameworkThreatMapping.findUnique({
    where: {
      framework_categoryId: { framework: body.sourceFramework, categoryId: body.sourceCategoryId },
    },
  });
  return resolveStrideAtlas(body, mapping);
}

/**
 * Categories in other frameworks that our seeded crosswalk relates a risk's
 * classification to (e.g. an MCP06 risk relates to OWASP LLM01 and NIST MAP).
 * Read-only reference data — joined to category names for display + exports.
 */
export async function relatedClassificationsFor(sourceFramework: string, sourceCategoryId: string) {
  const links = await prisma.frameworkCrosswalk.findMany({
    where: { fromFramework: sourceFramework as never, fromCategoryId: sourceCategoryId },
    orderBy: [{ toFramework: "asc" }, { toCategoryId: "asc" }],
  });
  if (!links.length) return [];
  const categories = await prisma.frameworkCategory.findMany({
    where: {
      OR: links.map((link) => ({ framework: link.toFramework, categoryId: link.toCategoryId })),
    },
  });
  const nameOf = new Map(
    categories.map((category) => [`${category.framework}:${category.categoryId}`, category.name]),
  );
  return links.map((link) => ({
    framework: link.toFramework,
    categoryId: link.toCategoryId,
    categoryName: nameOf.get(`${link.toFramework}:${link.toCategoryId}`) ?? link.toCategoryId,
    relationship: link.relationship,
    rationale: link.rationale,
  }));
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
