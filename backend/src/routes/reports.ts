import express from "express";
import { prisma } from "../prisma.js";
import { requireAuth } from "../auth.js";
import { countRiskSeverityBuckets } from "../lib/riskAggregates.js";
import { MAX_LIST_ROWS } from "../lib/http.js";

const router = express.Router();

router.get("/reports/framework-coverage", requireAuth, async (req, res, next) => {
  try {
    const riskWhere = req.query.includeArchived === "true" ? {} : { archived: false };
    const [categories, risks] = await Promise.all([
      /* fixed reference set */ prisma.frameworkCategory.findMany({ orderBy: [{ framework: "asc" }, { categoryId: "asc" }] }),
      prisma.risk.groupBy({ by: ["sourceFramework", "sourceCategoryId"], where: riskWhere, _count: true }),
    ]);
    const riskCounts = new Map(risks.map((risk) => [`${risk.sourceFramework}:${risk.sourceCategoryId}`, risk._count]));
    res.json({ coverage: categories.map((category) => ({ ...category, riskCount: riskCounts.get(`${category.framework}:${category.categoryId}`) ?? 0 })) });
  } catch (error) {
    next(error);
  }
});

router.get("/reports/risk-summary", requireAuth, async (req, res, next) => {
  try {
    const riskWhere = req.query.includeArchived === "true" ? {} : { archived: false };
    const [total, statusGroups, frameworkGroups, bySeverity] = await Promise.all([
      prisma.risk.count({ where: riskWhere }),
      prisma.risk.groupBy({ by: ["status"], where: riskWhere, _count: true }),
      prisma.risk.groupBy({ by: ["sourceFramework"], where: riskWhere, _count: true }),
      countRiskSeverityBuckets(riskWhere),
    ]);
    const byStatus = Object.fromEntries(statusGroups.map((risk) => [risk.status, risk._count]));
    const byFramework = Object.fromEntries(frameworkGroups.map((risk) => [risk.sourceFramework, risk._count]));
    res.json({ total, byStatus, byFramework, bySeverity });
  } catch (error) {
    next(error);
  }
});

router.get("/reports/model-metrics", requireAuth, async (req, res, next) => {
  try {
    const metricName = typeof req.query.metricName === "string" ? req.query.metricName : undefined;
    const metrics = await prisma.modelCardMetric.findMany({
      where: metricName ? { metricName } : undefined,
      include: { modelCard: { include: { asset: true } } },
      orderBy: [{ metricName: "asc" }, { recordedAt: "desc" }],
      take: MAX_LIST_ROWS,
    });
    const aggregate = new Map<string, { group: string; values: number[] }>();

    for (const metric of metrics) {
      for (const group of [metric.modelCard.task, metric.modelCard.architectureFamily].filter((value): value is string => Boolean(value))) {
        const key = group;
        const entry = aggregate.get(key) ?? { group: key, values: [] };
        entry.values.push(metric.metricValue);
        aggregate.set(key, entry);
      }
    }

    res.json({
      metrics: metrics.map((metric) => ({
        id: metric.id,
        metricName: metric.metricName,
        metricValue: metric.metricValue,
        slice: metric.slice,
        recordedAt: metric.recordedAt,
        asset: { id: metric.modelCard.asset.id, name: metric.modelCard.asset.name },
        task: metric.modelCard.task,
        architectureFamily: metric.modelCard.architectureFamily,
      })),
      aggregate: [...aggregate.values()].map((entry) => ({
        group: entry.group,
        avg: entry.values.reduce((total, value) => total + value, 0) / entry.values.length,
        min: Math.min(...entry.values),
        max: Math.max(...entry.values),
        count: entry.values.length,
      })),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
