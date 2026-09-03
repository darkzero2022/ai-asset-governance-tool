import express from "express";
import { prisma } from "../prisma.js";
import { requireAuth } from "../auth.js";
import { assetListResponse } from "../lib/responses.js";
import { countRiskSeverityBuckets } from "../lib/riskAggregates.js";
import { modelCardCompleteness } from "../modelCardScoring.js";
import { severityOf, HIGH_SEVERITY_MIN_SCORE } from "../riskScoring.js";
import { MAX_LIST_ROWS } from "../lib/http.js";

const router = express.Router();

router.get("/dashboard/summary", requireAuth, async (req, res, next) => {
  try {
    const riskWhere = req.query.includeArchived === "true" ? {} : { archived: false };
    const [assetStatus, assetType, hostingModel, networkDependency, projectCount, riskSeverityBuckets, topAssets] = await Promise.all([
      prisma.aIAsset.groupBy({ by: ["status"], _count: true }),
      prisma.aIAsset.groupBy({ by: ["type"], _count: true }),
      prisma.aIAsset.groupBy({ by: ["hostingModel"], _count: true }),
      prisma.aIAsset.groupBy({ by: ["networkDependency"], _count: true }),
      prisma.project.count(),
      countRiskSeverityBuckets(riskWhere),
      prisma.aIAsset.findMany({ include: { _count: { select: { projectLinks: true } } }, orderBy: { projectLinks: { _count: "desc" } }, take: 10 }),
    ]);
    res.json({ assetStatus, assetType, hostingModel, networkDependency, projectCount, riskSeverityBuckets, topAssets: topAssets.map(assetListResponse) });
  } catch (error) {
    next(error);
  }
});

router.get("/dashboard/exposure", requireAuth, async (req, res, next) => {
  try {
    const includeArchived = req.query.includeArchived === "true";
    const risks = await prisma.risk.findMany({
      where: { ...(includeArchived ? {} : { archived: false }), status: { in: ["OPEN", "IN_PROGRESS"] }, inherentRiskScore: { gte: HIGH_SEVERITY_MIN_SCORE } },
      include: { assets: { include: { asset: true } }, projects: { include: { project: true } } },
      orderBy: { inherentRiskScore: "desc" },
      take: 50,
    });
    res.json({ exposures: risks.map((risk) => ({ ...risk, severity: severityOf(risk.inherentRiskScore) })) });
  } catch (error) {
    next(error);
  }
});

router.get("/dashboard/recertification", requireAuth, async (req, res, next) => {
  try {
    const days = Math.max(Number(req.query.days ?? 30) || 30, 0);
    const now = new Date();
    const dueBy = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    const schedules = await prisma.recertificationSchedule.findMany({
      where: {
        nextDueDate: { lte: dueBy },
        asset: { type: { in: ["MODEL", "SERVICE"] } },
      },
      include: { asset: true },
      orderBy: { nextDueDate: "asc" },
      take: MAX_LIST_ROWS,
    });

    res.json({
      dueWithinDays: days,
      recertifications: schedules.map((schedule) => ({
        ...schedule,
        dueStatus: schedule.nextDueDate < now ? "OVERDUE" : "DUE_SOON",
      })),
    });
  } catch (error) {
    next(error);
  }
});

router.get("/dashboard/model-card-coverage", requireAuth, async (_req, res, next) => {
  try {
    const assets = await prisma.aIAsset.findMany({
      where: { type: { in: ["MODEL", "SERVICE"] } },
      include: { modelCard: true },
      orderBy: { updatedAt: "desc" },
      take: MAX_LIST_ROWS, // aggregate scan — safety cap; missingAssets/average reflect up to this many

    });
    const withCard = assets.filter((asset) => asset.modelCard).length;
    const completenessScores = assets.map((asset) => modelCardCompleteness(asset.modelCard).percent);
    const averageCompleteness = completenessScores.length ? Math.round(completenessScores.reduce((sum, percent) => sum + percent, 0) / completenessScores.length) : 0;

    res.json({
      total: assets.length,
      withCard,
      withoutCard: assets.length - withCard,
      averageCompleteness,
      missingAssets: assets.filter((asset) => !asset.modelCard).map((asset) => ({ id: asset.id, name: asset.name, type: asset.type, status: asset.status })),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
