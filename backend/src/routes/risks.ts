import express from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { requireAuth } from "../auth.js";
import { requireRole } from "../rbac.js";
import { forbidden, notFound } from "../httpError.js";
import { pagination, csv, MAX_EXPORT_ROWS } from "../lib/http.js";
import { audit } from "../lib/audit.js";
import { riskResponse } from "../lib/responses.js";
import { strideAtlasFor } from "../lib/riskAggregates.js";
import { riskSchema, riskUpdateSchema, controlSchema } from "../schemas.js";
import { staleWrite } from "../lib/concurrency.js";
import { sendSlackRiskStatusChange } from "../integrations/slack.js";
import { severityOf } from "../riskScoring.js";

const router = express.Router();

router.get("/risks", requireAuth, async (req, res, next) => {
  try {
    const { assetId, sourceFramework, status } = req.query;
    const includeArchived = req.query.includeArchived === "true";
    const page = pagination(req.query);
    const where = {
      ...(includeArchived ? {} : { archived: false }),
      ...(assetId ? { assets: { some: { assetId: String(assetId) } } } : {}),
      ...(sourceFramework ? { sourceFramework: sourceFramework as never } : {}),
      ...(status ? { status: status as never } : {}),
    };
    const total = await prisma.risk.count({ where });
    const risks = await prisma.risk.findMany({
      where,
      include: { assets: { include: { asset: true } }, controlLinks: { include: { control: true } }, frameworkCategory: true },
      orderBy: { inherentRiskScore: "desc" },
      skip: page.skip,
      take: page.take,
    });
    res.json({ risks: risks.map(riskResponse), pagination: { ...page, total } });
  } catch (error) {
    next(error);
  }
});

router.get("/risks/export/csv", requireAuth, async (req, res, next) => {
  try {
    const { assetId, sourceFramework, status } = req.query;
    const includeArchived = req.query.includeArchived === "true";
    const risks = await prisma.risk.findMany({
      where: {
        ...(includeArchived ? {} : { archived: false }),
        ...(assetId ? { assets: { some: { assetId: String(assetId) } } } : {}),
        ...(sourceFramework ? { sourceFramework: sourceFramework as never } : {}),
        ...(status ? { status: status as never } : {}),
      },
      include: { assets: { include: { asset: true } }, controlLinks: { include: { control: true } } },
      orderBy: { inherentRiskScore: "desc" },
      take: MAX_EXPORT_ROWS,
    });
    const body = csv([
      ["id", "description", "severity", "sourceFramework", "sourceCategoryId", "strideAiCategory", "atlasTechnique", "status", "likelihood", "impact", "inherentRiskScore", "residualRiskScore", "owner", "dueDate", "assetNames", "controlIds", "archived"],
      ...risks.map((risk) => [risk.id, risk.description, severityOf(risk.inherentRiskScore), risk.sourceFramework, risk.sourceCategoryId, risk.strideAiCategory ?? "", risk.atlasTechnique ?? "", risk.status, risk.likelihood, risk.impact, risk.inherentRiskScore, risk.residualRiskScore, risk.owner, risk.dueDate?.toISOString() ?? "", risk.assets.map((link) => link.asset.name).join("; "), risk.controlLinks.map((link) => link.control.mappedControlId).join("; "), risk.archived]),
    ]);
    res.header("Content-Type", "text/csv; charset=utf-8");
    res.attachment("risks.csv");
    res.send(body);
  } catch (error) {
    next(error);
  }
});

router.post("/risks", requireAuth, requireRole("ADMIN", "RISK_OWNER"), async (req, res, next) => {
  try {
    const body = riskSchema.parse(req.body);
    const { assetId, ...riskData } = body;
    const risk = await prisma.risk.create({
      data: {
        ...riskData,
        ...(await strideAtlasFor(body)),
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        inherentRiskScore: body.likelihood * body.impact,
        createdById: req.user!.id,
        assets: { create: { assetId } },
      },
      include: { assets: { include: { asset: true } }, controlLinks: { include: { control: true } }, frameworkCategory: true },
    });
    await audit(req.user!.id, "Risk", risk.id, "CREATE", undefined, risk);
    res.status(201).json({ risk: riskResponse(risk) });
  } catch (error) {
    next(error);
  }
});

router.get("/risks/:id", requireAuth, async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const risk = await prisma.risk.findUnique({ where: { id }, include: { assets: { include: { asset: true } }, projects: { include: { project: true } }, controlLinks: { include: { control: true } }, frameworkCategory: true } });

    if (!risk) {
      throw notFound("Risk not found");
    }

    res.json({ risk: riskResponse(risk) });
  } catch (error) {
    next(error);
  }
});

router.put("/risks/:id", requireAuth, requireRole("ADMIN", "RISK_OWNER"), async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const body = riskUpdateSchema.parse(req.body);
    const { assetId, expectedUpdatedAt, ...riskData } = body;
    const before = await prisma.risk.findUniqueOrThrow({ where: { id }, include: { assets: true, controlLinks: { include: { control: true } }, frameworkCategory: true } });

    if (req.user!.role === "RISK_OWNER" && before.createdById !== req.user!.id) {
      throw forbidden("RISK_OWNER can only edit risks they created");
    }

    if (riskData.status === "ACCEPTED" && before.createdById === req.user!.id) {
      throw forbidden("Segregation of duties prevents accepting a risk you created");
    }

    // Risk updates write relations (connectOrCreate), which updateMany can't do,
    // so this is a check-then-update rather than an atomic conditional update.
    if (expectedUpdatedAt && before.updatedAt.getTime() !== new Date(expectedUpdatedAt).getTime()) {
      throw staleWrite();
    }

    const risk = await prisma.risk.update({
      where: { id },
      data: {
        ...riskData,
        ...(await strideAtlasFor(body)),
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        inherentRiskScore: body.likelihood * body.impact,
        assets: { connectOrCreate: { where: { assetId_riskId: { assetId, riskId: id } }, create: { assetId } } },
      },
      include: { assets: { include: { asset: true } }, controlLinks: { include: { control: true } }, frameworkCategory: true },
    });
    if (before.status !== risk.status) {
      await sendSlackRiskStatusChange({ riskId: risk.id, description: risk.description, fromStatus: before.status, toStatus: risk.status });
    }
    await audit(req.user!.id, "Risk", risk.id, "UPDATE", before, risk);
    res.json({ risk: riskResponse(risk) });
  } catch (error) {
    next(error);
  }
});

router.delete("/risks/:id", requireAuth, requireRole("ADMIN"), async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const before = await prisma.risk.findUniqueOrThrow({ where: { id }, include: { assets: true, projects: true, controlLinks: { include: { control: true } } } });
    const hasLinks = before.assets.length > 0 || before.projects.length > 0 || before.controlLinks.length > 0;

    if (hasLinks) {
      const risk = await prisma.risk.update({ where: { id }, data: { archived: true } });
      await audit(req.user!.id, "Risk", id, "ARCHIVE", before, risk);
    } else {
      await prisma.risk.delete({ where: { id } });
      await audit(req.user!.id, "Risk", id, "DELETE", before, undefined);
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.post("/risks/:riskId/controls", requireAuth, requireRole("ADMIN", "RISK_OWNER"), async (req, res, next) => {
  try {
    const riskId = String(req.params.riskId);
    const body = controlSchema.parse(req.body);
    const control = await prisma.control.upsert({
      where: { mappedFramework_mappedControlId: { mappedFramework: body.mappedFramework, mappedControlId: body.mappedControlId } },
      update: { name: body.mappedControlId, archived: false },
      create: { name: body.mappedControlId, mappedFramework: body.mappedFramework, mappedControlId: body.mappedControlId },
    });
    const link = await prisma.riskControl.upsert({
      where: { riskId_controlId: { riskId, controlId: control.id } },
      update: { implementationStatus: body.implementationStatus, evidenceNotes: body.evidenceNotes },
      create: { riskId, controlId: control.id, implementationStatus: body.implementationStatus, evidenceNotes: body.evidenceNotes },
      include: { control: true },
    });
    const response = { ...link.control, implementationStatus: link.implementationStatus, evidenceNotes: link.evidenceNotes };
    await audit(req.user!.id, "Control", control.id, "CREATE", undefined, response);
    res.status(201).json({ control: response });
  } catch (error) {
    next(error);
  }
});

router.post("/risks/:riskId/controls/:controlId", requireAuth, requireRole("ADMIN", "RISK_OWNER"), async (req, res, next) => {
  try {
    const riskId = String(req.params.riskId);
    const controlId = String(req.params.controlId);
    const body = z.object({ implementationStatus: z.enum(["NOT_STARTED", "IN_PROGRESS", "IMPLEMENTED", "VERIFIED"]).optional(), evidenceNotes: z.string().optional().nullable() }).parse(req.body);
    const link = await prisma.riskControl.upsert({
      where: { riskId_controlId: { riskId, controlId } },
      update: body,
      create: { riskId, controlId, ...body },
      include: { control: true },
    });
    await audit(req.user!.id, "RiskControl", link.id, "CREATE", undefined, link);
    res.status(201).json({ link });
  } catch (error) {
    next(error);
  }
});

router.put("/risks/:riskId/controls/:controlId", requireAuth, requireRole("ADMIN", "RISK_OWNER"), async (req, res, next) => {
  try {
    const riskId = String(req.params.riskId);
    const controlId = String(req.params.controlId);
    const body = z.object({ implementationStatus: z.enum(["NOT_STARTED", "IN_PROGRESS", "IMPLEMENTED", "VERIFIED"]).optional(), evidenceNotes: z.string().optional().nullable() }).parse(req.body);
    const before = await prisma.riskControl.findUniqueOrThrow({ where: { riskId_controlId: { riskId, controlId } } });
    const link = await prisma.riskControl.update({ where: { riskId_controlId: { riskId, controlId } }, data: body, include: { control: true } });
    await audit(req.user!.id, "RiskControl", link.id, "UPDATE", before, link);
    res.json({ link });
  } catch (error) {
    next(error);
  }
});

router.delete("/risks/:riskId/controls/:controlId", requireAuth, requireRole("ADMIN", "RISK_OWNER"), async (req, res, next) => {
  try {
    const riskId = String(req.params.riskId);
    const controlId = String(req.params.controlId);
    const before = await prisma.riskControl.findUniqueOrThrow({ where: { riskId_controlId: { riskId, controlId } } });
    await prisma.riskControl.delete({ where: { riskId_controlId: { riskId, controlId } } });
    await audit(req.user!.id, "RiskControl", before.id, "DELETE", before, undefined);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
