import express from "express";
import { prisma } from "../prisma.js";
import { requireAuth } from "../auth.js";
import { requireRole } from "../rbac.js";
import { notFound } from "../httpError.js";
import { pagination } from "../lib/http.js";
import { audit } from "../lib/audit.js";
import { riskResponse } from "../lib/responses.js";
import { projectSchema } from "../schemas.js";

const router = express.Router();

router.get("/projects", requireAuth, async (req, res, next) => {
  try {
    const status = req.query.status as string | undefined;
    const page = pagination(req.query);
    const where = status ? { status: status as never } : {};
    const total = await prisma.project.count({ where });
    const projects = await prisma.project.findMany({
      where,
      include: { _count: { select: { assetLinks: true, riskLinks: true } }, createdBy: { select: { id: true, name: true, email: true } } },
      orderBy: { updatedAt: "desc" },
      skip: page.skip,
      take: page.take,
    });
    res.json({ projects, pagination: { ...page, total } });
  } catch (error) {
    next(error);
  }
});

router.post("/projects", requireAuth, requireRole("ADMIN", "RISK_OWNER"), async (req, res, next) => {
  try {
    const body = projectSchema.parse(req.body);
    const project = await prisma.project.create({ data: { ...body, createdById: req.user!.id } });
    await audit(req.user!.id, "Project", project.id, "CREATE", undefined, project);
    res.status(201).json({ project });
  } catch (error) {
    next(error);
  }
});

router.get("/projects/:id", requireAuth, async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const project = await prisma.project.findUnique({
      where: { id },
      include: { assetLinks: { include: { asset: true } }, riskLinks: { include: { risk: true } }, createdBy: { select: { id: true, name: true, email: true } } },
    });

    if (!project) {
      throw notFound("Project not found");
    }

    res.json({ project });
  } catch (error) {
    next(error);
  }
});

router.put("/projects/:id", requireAuth, requireRole("ADMIN", "RISK_OWNER"), async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const body = projectSchema.parse(req.body);
    const before = await prisma.project.findUniqueOrThrow({ where: { id } });
    const project = await prisma.project.update({ where: { id }, data: body });
    await audit(req.user!.id, "Project", id, "UPDATE", before, project);
    res.json({ project });
  } catch (error) {
    next(error);
  }
});

router.delete("/projects/:id", requireAuth, requireRole("ADMIN"), async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const before = await prisma.project.findUniqueOrThrow({ where: { id } });
    await prisma.project.delete({ where: { id } });
    await audit(req.user!.id, "Project", id, "DELETE", before, undefined);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.post("/projects/:projectId/assets/:assetId", requireAuth, requireRole("ADMIN", "RISK_OWNER"), async (req, res, next) => {
  try {
    const projectId = String(req.params.projectId);
    const assetId = String(req.params.assetId);
    const link = await prisma.projectAsset.upsert({ where: { projectId_assetId: { projectId, assetId } }, update: {}, create: { projectId, assetId } });
    res.status(201).json({ link });
  } catch (error) {
    next(error);
  }
});

router.delete("/projects/:projectId/assets/:assetId", requireAuth, requireRole("ADMIN", "RISK_OWNER"), async (req, res, next) => {
  try {
    const projectId = String(req.params.projectId);
    const assetId = String(req.params.assetId);
    await prisma.projectAsset.findUniqueOrThrow({ where: { projectId_assetId: { projectId, assetId } } });
    await prisma.projectAsset.delete({ where: { projectId_assetId: { projectId, assetId } } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.post("/projects/:projectId/risks/:riskId", requireAuth, requireRole("ADMIN", "RISK_OWNER"), async (req, res, next) => {
  try {
    const projectId = String(req.params.projectId);
    const riskId = String(req.params.riskId);
    const link = await prisma.projectRisk.upsert({ where: { projectId_riskId: { projectId, riskId } }, update: {}, create: { projectId, riskId } });
    res.status(201).json({ link });
  } catch (error) {
    next(error);
  }
});

router.delete("/projects/:projectId/risks/:riskId", requireAuth, requireRole("ADMIN", "RISK_OWNER"), async (req, res, next) => {
  try {
    const projectId = String(req.params.projectId);
    const riskId = String(req.params.riskId);
    await prisma.projectRisk.findUniqueOrThrow({ where: { projectId_riskId: { projectId, riskId } } });
    await prisma.projectRisk.delete({ where: { projectId_riskId: { projectId, riskId } } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.get("/projects/:id/risks", requireAuth, async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const project = await prisma.project.findUniqueOrThrow({
      where: { id },
      include: {
        riskLinks: { include: { risk: { include: { assets: { include: { asset: true } }, controlLinks: { include: { control: true } }, frameworkCategory: true } } } },
        assetLinks: { include: { asset: { include: { riskLinks: { include: { risk: { include: { assets: { include: { asset: true } }, controlLinks: { include: { control: true } }, frameworkCategory: true } } } } } } } },
      },
    });
    const risks = new Map<string, unknown>();
    for (const link of project.riskLinks) risks.set(link.riskId, { ...riskResponse(link.risk), origin: "project" });
    for (const assetLink of project.assetLinks) {
      for (const riskLink of assetLink.asset.riskLinks) {
        if (!risks.has(riskLink.riskId)) risks.set(riskLink.riskId, { ...riskResponse(riskLink.risk), origin: "asset" });
      }
    }
    res.json({ risks: [...risks.values()] });
  } catch (error) {
    next(error);
  }
});

export default router;
