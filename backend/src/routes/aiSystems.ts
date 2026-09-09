import express from "express";
import { z } from "zod";
import { AssetStatus } from "@prisma/client";
import { prisma } from "../prisma.js";
import { requireAuth } from "../auth.js";
import { requireRole, canTransitionAsset } from "../rbac.js";
import { AppError, badRequest, forbidden, notFound } from "../httpError.js";
import { pagination, csv, MAX_EXPORT_ROWS } from "../lib/http.js";
import { audit } from "../lib/audit.js";
import {
  assetResponse,
  assetListResponse,
  modelCardResponse,
  modelCardData,
} from "../lib/responses.js";
import { fetchImportHtml, extractHtmlSuggestion } from "../lib/urlImport.js";
import { allowedTransitions, requiredRoleForTransition } from "../lib/transitions.js";
import {
  assetSchema,
  assetUpdateSchema,
  importUrlSchema,
  modelCardUpdateSchema,
  modelCardMetricSchema,
} from "../schemas.js";
import { lockWhere, staleWrite } from "../lib/concurrency.js";
import { modelCardCompleteness } from "../modelCardScoring.js";
import { HIGH_SEVERITY_MIN_SCORE } from "../riskScoring.js";

const router = express.Router();

router.get("/ai-systems", requireAuth, async (req, res, next) => {
  try {
    const { status, type, hostingModel, networkDependency } = req.query;
    const page = pagination(req.query);
    const where = {
      ...(status ? { status: status as never } : {}),
      ...(type ? { type: type as never } : {}),
      ...(hostingModel ? { hostingModel: hostingModel as never } : {}),
      ...(networkDependency ? { networkDependency: networkDependency as never } : {}),
    };
    const total = await prisma.aIAsset.count({ where });
    const assets = await prisma.aIAsset.findMany({
      where,
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        _count: { select: { riskLinks: true, projectLinks: true } },
      },
      orderBy: { updatedAt: "desc" },
      skip: page.skip,
      take: page.take,
    });
    res.json({ assets: assets.map(assetListResponse), pagination: { ...page, total } });
  } catch (error) {
    next(error);
  }
});

router.post(
  "/ai-systems",
  requireAuth,
  requireRole("ADMIN", "RISK_OWNER"),
  async (req, res, next) => {
    try {
      const body = assetSchema.parse(req.body);
      const asset = await prisma.aIAsset.create({ data: { ...body, createdById: req.user!.id } });
      await audit(req.user!.id, "AIAsset", asset.id, "CREATE", undefined, asset);
      res.status(201).json({ asset });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  "/ai-systems/import-url",
  requireAuth,
  requireRole("ADMIN", "RISK_OWNER"),
  async (req, res, next) => {
    try {
      const body = importUrlSchema.parse(req.body);
      const { finalUrl, html } = await fetchImportHtml(body.sourceUrl);
      res.json({ sourceUrl: finalUrl, ...extractHtmlSuggestion(html) });
    } catch (error) {
      if (error instanceof Error) {
        next(new AppError(400, "URL_IMPORT_FAILED", error.message));
        return;
      }
      next(error);
    }
  },
);

router.get("/ai-systems/export/csv", requireAuth, async (req, res, next) => {
  try {
    const { status, type, hostingModel, networkDependency } = req.query;
    const assets = await prisma.aIAsset.findMany({
      where: {
        ...(status ? { status: status as never } : {}),
        ...(type ? { type: type as never } : {}),
        ...(hostingModel ? { hostingModel: hostingModel as never } : {}),
        ...(networkDependency ? { networkDependency: networkDependency as never } : {}),
      },
      include: { _count: { select: { riskLinks: true, projectLinks: true } } },
      orderBy: { updatedAt: "desc" },
      take: MAX_EXPORT_ROWS,
    });
    const body = csv([
      [
        "id",
        "name",
        "version",
        "type",
        "supplier",
        "provider",
        "hostingModel",
        "networkDependency",
        "status",
        "riskCount",
        "projectUsageCount",
        "updatedAt",
      ],
      ...assets.map((asset) => [
        asset.id,
        asset.name,
        asset.version,
        asset.type,
        asset.supplier,
        asset.provider,
        asset.hostingModel,
        asset.networkDependency,
        asset.status,
        asset._count.riskLinks,
        asset._count.projectLinks,
        asset.updatedAt.toISOString(),
      ]),
    ]);
    res.header("Content-Type", "text/csv; charset=utf-8");
    res.attachment("assets.csv");
    res.send(body);
  } catch (error) {
    next(error);
  }
});

router.get("/ai-systems/:id", requireAuth, async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const asset = await prisma.aIAsset.findUnique({
      where: { id },
      include: {
        riskLinks: {
          include: {
            risk: {
              include: { controlLinks: { include: { control: true } }, frameworkCategory: true },
            },
          },
          orderBy: { linkedAt: "desc" },
        },
        projectLinks: { include: { project: true } },
        parentDependencies: { include: { childAsset: true } },
        childDependencies: { include: { parentAsset: true } },
        _count: { select: { projectLinks: true } },
        workflow: {
          include: { approvedBy: { select: { id: true, name: true, email: true } } },
          orderBy: { timestamp: "desc" },
        },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    if (!asset) {
      throw notFound("Asset not found");
    }

    res.json({ asset: { ...assetResponse(asset), projectUsageCount: asset._count.projectLinks } });
  } catch (error) {
    next(error);
  }
});

router.get("/ai-systems/:id/model-card", requireAuth, async (req, res, next) => {
  try {
    const assetId = String(req.params.id);
    const asset = await prisma.aIAsset.findUnique({ where: { id: assetId }, select: { id: true } });

    if (!asset) {
      throw notFound("Asset not found");
    }

    const modelCard = await prisma.modelCard.findUnique({
      where: { assetId },
      include: { metrics: { orderBy: { recordedAt: "desc" } } },
    });
    res.json({
      modelCard: modelCardResponse(modelCard),
      completeness: modelCardCompleteness(modelCard),
    });
  } catch (error) {
    next(error);
  }
});

router.put(
  "/ai-systems/:id/model-card",
  requireAuth,
  requireRole("ADMIN", "RISK_OWNER"),
  async (req, res, next) => {
    try {
      const assetId = String(req.params.id);
      const { expectedUpdatedAt, ...body } = modelCardUpdateSchema.parse(req.body);
      const asset = await prisma.aIAsset.findUnique({
        where: { id: assetId },
        select: { id: true },
      });

      if (!asset) {
        throw notFound("Asset not found");
      }

      const before = await prisma.modelCard.findUnique({ where: { assetId } });
      if (
        before &&
        expectedUpdatedAt &&
        before.updatedAt.getTime() !== new Date(expectedUpdatedAt).getTime()
      ) {
        throw staleWrite();
      }
      const data = modelCardData(body);
      const modelCard = await prisma.modelCard.upsert({
        where: { assetId },
        update: data,
        create: { assetId, ...data },
      });
      await audit(
        req.user!.id,
        "ModelCard",
        modelCard.id,
        before ? "UPDATE" : "CREATE",
        before,
        modelCard,
      );
      res.json({ modelCard: modelCardResponse(modelCard) });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  "/ai-systems/:id/model-card/metrics",
  requireAuth,
  requireRole("ADMIN", "RISK_OWNER"),
  async (req, res, next) => {
    try {
      const assetId = String(req.params.id);
      const body = modelCardMetricSchema.parse(req.body);
      const asset = await prisma.aIAsset.findUnique({
        where: { id: assetId },
        select: { id: true },
      });

      if (!asset) {
        throw notFound("Asset not found");
      }

      const modelCard = await prisma.modelCard.upsert({
        where: { assetId },
        update: {},
        create: { assetId },
      });
      const metric = await prisma.modelCardMetric.create({
        data: {
          modelCardId: modelCard.id,
          metricName: body.metricName,
          metricValue: body.metricValue,
          slice: body.slice,
          recordedAt: body.recordedAt ? new Date(body.recordedAt) : undefined,
        },
      });
      await audit(req.user!.id, "ModelCardMetric", metric.id, "CREATE", undefined, metric);
      res.status(201).json({ metric });
    } catch (error) {
      next(error);
    }
  },
);

router.put(
  "/ai-systems/:id/model-card/metrics/:metricId",
  requireAuth,
  requireRole("ADMIN", "RISK_OWNER"),
  async (req, res, next) => {
    try {
      const assetId = String(req.params.id);
      const metricId = String(req.params.metricId);
      const body = modelCardMetricSchema.parse(req.body);
      const before = await prisma.modelCardMetric.findFirstOrThrow({
        where: { id: metricId, modelCard: { assetId } },
      });
      const metric = await prisma.modelCardMetric.update({
        where: { id: metricId },
        data: {
          metricName: body.metricName,
          metricValue: body.metricValue,
          slice: body.slice,
          ...(body.recordedAt ? { recordedAt: new Date(body.recordedAt) } : {}),
        },
      });
      await audit(req.user!.id, "ModelCardMetric", metric.id, "UPDATE", before, metric);
      res.json({ metric });
    } catch (error) {
      next(error);
    }
  },
);

router.delete(
  "/ai-systems/:id/model-card/metrics/:metricId",
  requireAuth,
  requireRole("ADMIN", "RISK_OWNER"),
  async (req, res, next) => {
    try {
      const assetId = String(req.params.id);
      const metricId = String(req.params.metricId);
      const before = await prisma.modelCardMetric.findFirstOrThrow({
        where: { id: metricId, modelCard: { assetId } },
      });
      await prisma.modelCardMetric.delete({ where: { id: metricId } });
      await audit(req.user!.id, "ModelCardMetric", metricId, "DELETE", before, undefined);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },
);

router.put(
  "/ai-systems/:id",
  requireAuth,
  requireRole("ADMIN", "RISK_OWNER"),
  async (req, res, next) => {
    try {
      const id = String(req.params.id);
      const { expectedUpdatedAt, ...body } = assetUpdateSchema.parse(req.body);
      const before = await prisma.aIAsset.findUniqueOrThrow({ where: { id } });

      if (req.user!.role === "RISK_OWNER" && before.createdById !== req.user!.id) {
        throw forbidden("RISK_OWNER can only edit assets they created");
      }

      const { count } = await prisma.aIAsset.updateMany({
        where: lockWhere(id, expectedUpdatedAt),
        data: body,
      });
      if (count === 0) throw staleWrite();
      const asset = await prisma.aIAsset.findUniqueOrThrow({ where: { id } });
      await audit(req.user!.id, "AIAsset", asset.id, "UPDATE", before, asset);
      res.json({ asset });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  "/ai-systems/:id/import-url",
  requireAuth,
  requireRole("ADMIN", "RISK_OWNER"),
  async (req, res, next) => {
    try {
      const id = String(req.params.id);
      const body = importUrlSchema.parse(req.body);
      const asset = await prisma.aIAsset.findUnique({ where: { id } });

      if (!asset) {
        throw notFound("Asset not found");
      }

      if (req.user!.role === "RISK_OWNER" && asset.createdById !== req.user!.id) {
        throw forbidden("RISK_OWNER can only import URLs for assets they created");
      }

      const { finalUrl, html } = await fetchImportHtml(body.sourceUrl);
      res.json({ sourceUrl: finalUrl, ...extractHtmlSuggestion(html) });
    } catch (error) {
      if (error instanceof Error) {
        next(new AppError(400, "URL_IMPORT_FAILED", error.message));
        return;
      }
      next(error);
    }
  },
);

router.delete("/ai-systems/:id", requireAuth, requireRole("ADMIN"), async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const before = await prisma.aIAsset.findUniqueOrThrow({ where: { id } });
    await prisma.aIAsset.delete({ where: { id } });
    await audit(req.user!.id, "AIAsset", id, "DELETE", before, undefined);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.post("/ai-systems/:id/transition", requireAuth, async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const body = z
      .object({ toStatus: z.nativeEnum(AssetStatus), comments: z.string().optional().nullable() })
      .parse(req.body);
    const asset = await prisma.aIAsset.findUniqueOrThrow({ where: { id } });

    if (!allowedTransitions[asset.status].includes(body.toStatus)) {
      throw badRequest(`Invalid transition from ${asset.status} to ${body.toStatus}`);
    }

    if (!canTransitionAsset(req.user!.role, body.toStatus)) {
      throw forbidden("Insufficient permissions for asset transition");
    }

    if (body.toStatus === "APPROVED") {
      const underReviewStep = await prisma.governanceWorkflow.findFirst({
        where: { assetId: asset.id, toStatus: "UNDER_REVIEW" },
        orderBy: { timestamp: "desc" },
      });

      if (underReviewStep?.approvedById === req.user!.id) {
        throw forbidden("Segregation of duties prevents approving an asset you moved to review");
      }
    }

    if (body.toStatus === "APPROVED" || body.toStatus === "DEPLOYED") {
      // Bounded: open high/critical risks linked to this one asset.
      const blockingRisks = await prisma.risk.findMany({
        where: {
          archived: false,
          assets: { some: { assetId: asset.id } },
          status: { in: ["OPEN", "IN_PROGRESS"] },
          inherentRiskScore: { gte: HIGH_SEVERITY_MIN_SCORE },
        },
        select: { id: true, description: true, inherentRiskScore: true },
      });

      if (blockingRisks.length) {
        throw new AppError(400, "ASSET_HAS_OPEN_RISKS", "Asset has open high or critical risks", {
          blockingRisks,
        });
      }

      if (asset.type === "MODEL" || asset.type === "SERVICE") {
        const modelCard = await prisma.modelCard.findUnique({ where: { assetId: asset.id } });
        const completeness = modelCardCompleteness(modelCard);

        if (completeness.missingFields.length) {
          throw new AppError(400, "MODEL_CARD_INCOMPLETE", "Model card incomplete", {
            missingFields: completeness.missingFields,
          });
        }
      }
    }

    const stepIndex = await prisma.governanceWorkflow.count({ where: { assetId: asset.id } });

    const result = await prisma.$transaction(async (tx) => {
      const updatedAsset = await tx.aIAsset.update({
        where: { id: asset.id },
        data: { status: body.toStatus },
      });
      const workflow = await tx.governanceWorkflow.create({
        data: {
          assetId: asset.id,
          fromStatus: asset.status,
          toStatus: body.toStatus,
          stepIndex,
          requiredRole: requiredRoleForTransition(body.toStatus),
          approvedById: req.user!.id,
          comments: body.comments,
        },
      });
      return { asset: updatedAsset, workflow };
    });
    await audit(req.user!.id, "AIAsset", result.asset.id, "TRANSITION", asset, result.asset);

    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get("/ai-systems/:id/projects", requireAuth, async (req, res, next) => {
  try {
    const id = String(req.params.id);
    // Bounded: the projects a single asset is linked to.
    const links = await prisma.projectAsset.findMany({
      where: { assetId: id },
      include: { project: true },
      orderBy: { linkedAt: "desc" },
    });
    res.json({ projects: links.map((link) => link.project) });
  } catch (error) {
    next(error);
  }
});

router.post(
  "/ai-systems/:assetId/risks/:riskId",
  requireAuth,
  requireRole("ADMIN", "RISK_OWNER"),
  async (req, res, next) => {
    try {
      const assetId = String(req.params.assetId);
      const riskId = String(req.params.riskId);
      const link = await prisma.assetRisk.upsert({
        where: { assetId_riskId: { assetId, riskId } },
        update: {},
        create: { assetId, riskId },
      });
      res.status(201).json({ link });
    } catch (error) {
      next(error);
    }
  },
);

router.delete(
  "/ai-systems/:assetId/risks/:riskId",
  requireAuth,
  requireRole("ADMIN", "RISK_OWNER"),
  async (req, res, next) => {
    try {
      const assetId = String(req.params.assetId);
      const riskId = String(req.params.riskId);
      await prisma.assetRisk.findUniqueOrThrow({ where: { assetId_riskId: { assetId, riskId } } });
      await prisma.assetRisk.delete({ where: { assetId_riskId: { assetId, riskId } } });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  "/ai-systems/:parentAssetId/dependencies/:childAssetId",
  requireAuth,
  requireRole("ADMIN", "RISK_OWNER"),
  async (req, res, next) => {
    try {
      const parentAssetId = String(req.params.parentAssetId);
      const childAssetId = String(req.params.childAssetId);
      const dependency = await prisma.assetDependency.upsert({
        where: { parentAssetId_childAssetId: { parentAssetId, childAssetId } },
        update: {},
        create: { parentAssetId, childAssetId },
      });
      res.status(201).json({ dependency });
    } catch (error) {
      next(error);
    }
  },
);

router.delete(
  "/ai-systems/:parentAssetId/dependencies/:childAssetId",
  requireAuth,
  requireRole("ADMIN", "RISK_OWNER"),
  async (req, res, next) => {
    try {
      const parentAssetId = String(req.params.parentAssetId);
      const childAssetId = String(req.params.childAssetId);
      await prisma.assetDependency.findUniqueOrThrow({
        where: { parentAssetId_childAssetId: { parentAssetId, childAssetId } },
      });
      await prisma.assetDependency.delete({
        where: { parentAssetId_childAssetId: { parentAssetId, childAssetId } },
      });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },
);

router.get("/ai-systems/:id/recertification", requireAuth, async (req, res, next) => {
  try {
    const assetId = String(req.params.id);
    const recertification = await prisma.recertificationSchedule.findUnique({ where: { assetId } });
    res.json({ recertification });
  } catch (error) {
    next(error);
  }
});

router.post(
  "/ai-systems/:id/recertification",
  requireAuth,
  requireRole("ADMIN", "APPROVER"),
  async (req, res, next) => {
    try {
      const assetId = String(req.params.id);
      const body = z
        .object({ cadenceDays: z.number().int().min(1), nextDueDate: z.string().datetime() })
        .parse(req.body);
      const before = await prisma.recertificationSchedule.findUnique({ where: { assetId } });
      const recertification = await prisma.recertificationSchedule.upsert({
        where: { assetId },
        update: { cadenceDays: body.cadenceDays, nextDueDate: new Date(body.nextDueDate) },
        create: { assetId, cadenceDays: body.cadenceDays, nextDueDate: new Date(body.nextDueDate) },
      });
      await audit(
        req.user!.id,
        "RecertificationSchedule",
        recertification.id,
        before ? "UPDATE" : "CREATE",
        before,
        recertification,
      );
      res.json({ recertification });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
