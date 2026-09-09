import { prisma } from "../prisma.js";
import type { BomFrameworkContext } from "../cyclonedx.js";
import { relatedClassificationsFor } from "./riskAggregates.js";

type AssetLike = {
  risks?: Array<{ id: string; sourceFramework: string; sourceCategoryId: string }>;
};

/**
 * Build the framework-revision + crosswalk context for a CycloneDX/SPDX export:
 * the `FrameworkMeta.revision` string for every framework in use, and the seeded
 * cross-framework relations for every risk. One batched query for revisions;
 * `relatedClassificationsFor` per distinct (framework, category).
 */
export async function buildBomFrameworkContext(assets: AssetLike[]): Promise<BomFrameworkContext> {
  const risks = assets.flatMap((asset) => asset.risks ?? []);
  if (!risks.length) return {};

  const frameworks = [...new Set(risks.map((risk) => risk.sourceFramework))];
  const meta = await prisma.frameworkMeta.findMany({
    where: { framework: { in: frameworks as never } },
  });
  const frameworkRevisions = Object.fromEntries(meta.map((row) => [row.framework, row.revision]));

  const relatedByRisk: BomFrameworkContext["relatedByRisk"] = {};
  const cache = new Map<string, Awaited<ReturnType<typeof relatedClassificationsFor>>>();
  for (const risk of risks) {
    const key = `${risk.sourceFramework}:${risk.sourceCategoryId}`;
    if (!cache.has(key))
      cache.set(key, await relatedClassificationsFor(risk.sourceFramework, risk.sourceCategoryId));
    const related = cache.get(key)!;
    if (related.length) {
      relatedByRisk[risk.id] = related.map((row) => ({
        framework: row.framework,
        categoryId: row.categoryId,
        relationship: row.relationship,
      }));
    }
  }

  return { frameworkRevisions, relatedByRisk };
}
