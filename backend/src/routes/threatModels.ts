import express from "express";
import { z } from "zod";
import {
  threatModelCreateSchema,
  threatModelElementSchema,
  threatModelFlowSchema,
  threatModelUpdateSchema,
  threatStatusSchema,
  trustBoundarySchema,
} from "@aibom/shared";
import { prisma } from "../prisma.js";
import { requireAuth } from "../auth.js";
import { requireRole } from "../rbac.js";
import { badRequest, conflict, notFound } from "../httpError.js";
import { audit } from "../lib/audit.js";
import { evaluateRules, threatKey } from "../lib/threatRules.js";
import { buildThreatModelReport } from "../lib/threatReport.js";

const router = express.Router();
const manage = [requireAuth, requireRole("ADMIN", "RISK_OWNER")] as const;

const fullInclude = {
  elements: { orderBy: { name: "asc" } },
  flows: true,
  trustBoundaries: { orderBy: { name: "asc" } },
  threats: { orderBy: { createdAt: "asc" } },
} as const;

async function loadModel(id: string) {
  const model = await prisma.threatModel.findUnique({ where: { id }, include: fullInclude });
  if (!model) throw notFound("Threat model not found");
  return model;
}

async function loadModelForAsset(assetId: string) {
  const asset = await prisma.aIAsset.findUnique({ where: { id: assetId }, select: { id: true } });
  if (!asset) throw notFound("AI system not found");
  return prisma.threatModel.findUnique({ where: { assetId }, include: fullInclude });
}

// --- the model itself ----------------------------------------------------

router.get("/ai-systems/:assetId/threat-model", requireAuth, async (req, res, next) => {
  try {
    const model = await loadModelForAsset(String(req.params.assetId));
    res.json({ threatModel: model });
  } catch (error) {
    next(error);
  }
});

router.post("/ai-systems/:assetId/threat-model", ...manage, async (req, res, next) => {
  try {
    const assetId = String(req.params.assetId);
    const asset = await prisma.aIAsset.findUnique({ where: { id: assetId }, select: { id: true } });
    if (!asset) throw notFound("AI system not found");
    if (await prisma.threatModel.findUnique({ where: { assetId }, select: { id: true } })) {
      throw conflict("This AI system already has a threat model");
    }
    const body = threatModelCreateSchema.parse(req.body);
    const model = await prisma.threatModel.create({
      data: {
        assetId,
        title: body.title,
        description: body.description,
        createdById: req.user!.id,
      },
      include: fullInclude,
    });
    await audit(req.user!.id, "ThreatModel", model.id, "CREATE", undefined, { assetId });
    res.status(201).json({ threatModel: model });
  } catch (error) {
    next(error);
  }
});

router.put("/threat-models/:id", ...manage, async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const body = threatModelUpdateSchema.parse(req.body);
    await loadModel(id);
    const model = await prisma.threatModel.update({
      where: { id },
      data: { title: body.title, description: body.description },
      include: fullInclude,
    });
    await audit(req.user!.id, "ThreatModel", id, "UPDATE", undefined, body);
    res.json({ threatModel: model });
  } catch (error) {
    next(error);
  }
});

router.delete("/threat-models/:id", ...manage, async (req, res, next) => {
  try {
    const id = String(req.params.id);
    await loadModel(id);
    await prisma.threatModel.delete({ where: { id } });
    await audit(req.user!.id, "ThreatModel", id, "DELETE", undefined, undefined);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

// --- trust boundaries --------------------------------------------------

router.post("/threat-models/:id/trust-boundaries", ...manage, async (req, res, next) => {
  try {
    const id = String(req.params.id);
    await loadModel(id);
    const body = trustBoundarySchema.parse(req.body);
    await prisma.trustBoundary.create({ data: { threatModelId: id, ...body } });
    res.status(201).json({ threatModel: await loadModel(id) });
  } catch (error) {
    next(error);
  }
});

router.put("/threat-models/:id/trust-boundaries/:boundaryId", ...manage, async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const boundaryId = String(req.params.boundaryId);
    const body = trustBoundarySchema.parse(req.body);
    const existing = await prisma.trustBoundary.findFirst({
      where: { id: boundaryId, threatModelId: id },
    });
    if (!existing) throw notFound("Trust boundary not found");
    await prisma.trustBoundary.update({ where: { id: boundaryId }, data: body });
    res.json({ threatModel: await loadModel(id) });
  } catch (error) {
    next(error);
  }
});

router.delete(
  "/threat-models/:id/trust-boundaries/:boundaryId",
  ...manage,
  async (req, res, next) => {
    try {
      const id = String(req.params.id);
      const boundaryId = String(req.params.boundaryId);
      const existing = await prisma.trustBoundary.findFirst({
        where: { id: boundaryId, threatModelId: id },
      });
      if (!existing) throw notFound("Trust boundary not found");
      await prisma.trustBoundary.delete({ where: { id: boundaryId } });
      res.json({ threatModel: await loadModel(id) });
    } catch (error) {
      next(error);
    }
  },
);

// --- elements -----------------------------------------------------------

async function assertBoundary(modelId: string, boundaryId: string | null | undefined) {
  if (!boundaryId) return;
  const b = await prisma.trustBoundary.findFirst({
    where: { id: boundaryId, threatModelId: modelId },
  });
  if (!b) throw badRequest("trustBoundaryId does not belong to this threat model");
}

router.post("/threat-models/:id/elements", ...manage, async (req, res, next) => {
  try {
    const id = String(req.params.id);
    await loadModel(id);
    const body = threatModelElementSchema.parse(req.body);
    await assertBoundary(id, body.trustBoundaryId);
    await prisma.threatModelElement.create({
      data: {
        threatModelId: id,
        type: body.type,
        name: body.name,
        description: body.description,
        trustBoundaryId: body.trustBoundaryId ?? null,
        x: body.x,
        y: body.y,
      },
    });
    res.status(201).json({ threatModel: await loadModel(id) });
  } catch (error) {
    next(error);
  }
});

router.put("/threat-models/:id/elements/:elementId", ...manage, async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const elementId = String(req.params.elementId);
    const existing = await prisma.threatModelElement.findFirst({
      where: { id: elementId, threatModelId: id },
    });
    if (!existing) throw notFound("Element not found");
    const body = threatModelElementSchema.partial().parse(req.body);
    if (body.trustBoundaryId !== undefined) await assertBoundary(id, body.trustBoundaryId);
    await prisma.threatModelElement.update({
      where: { id: elementId },
      data: {
        type: body.type,
        name: body.name,
        description: body.description,
        trustBoundaryId:
          body.trustBoundaryId === undefined ? undefined : (body.trustBoundaryId ?? null),
        x: body.x,
        y: body.y,
      },
    });
    res.json({ threatModel: await loadModel(id) });
  } catch (error) {
    next(error);
  }
});

router.delete("/threat-models/:id/elements/:elementId", ...manage, async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const elementId = String(req.params.elementId);
    const existing = await prisma.threatModelElement.findFirst({
      where: { id: elementId, threatModelId: id },
    });
    if (!existing) throw notFound("Element not found");
    await prisma.threatModelElement.delete({ where: { id: elementId } });
    res.json({ threatModel: await loadModel(id) });
  } catch (error) {
    next(error);
  }
});

// --- flows ------------------------------------------------------------

router.post("/threat-models/:id/flows", ...manage, async (req, res, next) => {
  try {
    const id = String(req.params.id);
    await loadModel(id);
    const body = threatModelFlowSchema.parse(req.body);
    if (body.sourceId === body.targetId) throw badRequest("A flow needs two different elements");
    const ends = await prisma.threatModelElement.findMany({
      where: { id: { in: [body.sourceId, body.targetId] }, threatModelId: id },
    });
    if (ends.length !== 2) throw badRequest("Both flow ends must be elements of this threat model");
    await prisma.threatModelFlow.create({
      data: {
        threatModelId: id,
        sourceId: body.sourceId,
        targetId: body.targetId,
        label: body.label,
        protocol: body.protocol,
        authenticated: body.authenticated ?? false,
        encrypted: body.encrypted ?? false,
      },
    });
    res.status(201).json({ threatModel: await loadModel(id) });
  } catch (error) {
    next(error);
  }
});

router.delete("/threat-models/:id/flows/:flowId", ...manage, async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const flowId = String(req.params.flowId);
    const existing = await prisma.threatModelFlow.findFirst({
      where: { id: flowId, threatModelId: id },
    });
    if (!existing) throw notFound("Flow not found");
    await prisma.threatModelFlow.delete({ where: { id: flowId } });
    res.json({ threatModel: await loadModel(id) });
  } catch (error) {
    next(error);
  }
});

// --- suggestions (the rules engine) --------------------------------

router.post("/threat-models/:id/suggest", ...manage, async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const model = await loadModel(id);
    const graph = {
      elements: model.elements.map((e) => ({
        id: e.id,
        type: e.type,
        name: e.name,
        trustBoundaryId: e.trustBoundaryId,
      })),
      flows: model.flows.map((f) => ({
        id: f.id,
        sourceId: f.sourceId,
        targetId: f.targetId,
        label: f.label,
        authenticated: f.authenticated,
        encrypted: f.encrypted,
      })),
    };
    const suggestions = evaluateRules(graph);
    const existingKeys = new Set(
      model.threats
        .filter((t) => t.ruleId)
        .map((t) =>
          threatKey({
            ruleId: t.ruleId!,
            elementId: t.elementId ?? undefined,
            flowId: t.flowId ?? undefined,
          }),
        ),
    );
    const toCreate = suggestions.filter((s) => !existingKeys.has(threatKey(s)));
    if (toCreate.length > 0) {
      await prisma.threatModelThreat.createMany({
        data: toCreate.map((s) => ({
          threatModelId: id,
          ruleId: s.ruleId,
          elementId: s.elementId,
          flowId: s.flowId,
          title: s.title,
          description: s.description,
          strideAiCategory: s.strideAiCategory,
          sourceFramework: s.sourceFramework,
          sourceCategoryId: s.sourceCategoryId,
        })),
      });
    }
    await audit(req.user!.id, "ThreatModel", id, "UPDATE", undefined, {
      event: "suggest",
      added: toCreate.length,
    });
    res.json({ threatModel: await loadModel(id), added: toCreate.length });
  } catch (error) {
    next(error);
  }
});

router.put("/threat-models/:id/threats/:threatId", ...manage, async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const threatId = String(req.params.threatId);
    const threat = await prisma.threatModelThreat.findFirst({
      where: { id: threatId, threatModelId: id },
    });
    if (!threat) throw notFound("Threat not found");
    const { status } = threatStatusSchema.parse(req.body);
    if (status === "PROMOTED") throw badRequest("Use the promote endpoint to create a risk");
    if (threat.status === "PROMOTED") throw conflict("This threat is already linked to a risk");
    await prisma.threatModelThreat.update({ where: { id: threatId }, data: { status } });
    res.json({ threatModel: await loadModel(id) });
  } catch (error) {
    next(error);
  }
});

router.post("/threat-models/:id/threats/:threatId/promote", ...manage, async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const threatId = String(req.params.threatId);
    const model = await prisma.threatModel.findUnique({
      where: { id },
      select: { id: true, assetId: true },
    });
    if (!model) throw notFound("Threat model not found");
    const threat = await prisma.threatModelThreat.findFirst({
      where: { id: threatId, threatModelId: id },
    });
    if (!threat) throw notFound("Threat not found");
    if (threat.status === "PROMOTED") throw conflict("This threat is already linked to a risk");
    if (!threat.sourceFramework || !threat.sourceCategoryId) {
      throw badRequest("This threat has no framework category to base a risk on");
    }

    const likelihood = z.coerce.number().int().min(1).max(5).catch(2).parse(req.body?.likelihood);
    const impact = z.coerce.number().int().min(1).max(5).catch(3).parse(req.body?.impact);

    const risk = await prisma.$transaction(async (tx) => {
      const created = await tx.risk.create({
        data: {
          description: `${threat.title} — ${threat.description}`,
          sourceFramework: threat.sourceFramework!,
          sourceCategoryId: threat.sourceCategoryId!,
          strideAiCategory: threat.strideAiCategory,
          likelihood,
          impact,
          inherentRiskScore: likelihood * impact,
          status: "OPEN",
          createdById: req.user!.id,
          assets: { create: { assetId: model.assetId } },
        },
      });
      await tx.threatModelThreat.update({
        where: { id: threatId },
        data: { status: "PROMOTED", promotedRiskId: created.id },
      });
      return created;
    });
    await audit(req.user!.id, "Risk", risk.id, "CREATE", undefined, {
      via: "threat-model",
      threatModelId: id,
      threatId,
    });
    res.status(201).json({ riskId: risk.id, threatModel: await loadModel(id) });
  } catch (error) {
    next(error);
  }
});

// --- report ---------------------------------------------------------

router.get("/threat-models/:id/report", requireAuth, async (req, res, next) => {
  try {
    const model = await loadModel(String(req.params.id));
    res.json({ report: buildThreatModelReport(model) });
  } catch (error) {
    next(error);
  }
});

export default router;
