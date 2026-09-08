import express from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { requireAuth } from "../auth.js";
import { AppError, notFound } from "../httpError.js";
import { assetForBom } from "../lib/responses.js";
import { buildCycloneDxBom, validateCycloneDxBom } from "../cyclonedx.js";
import { buildSpdxDocument } from "../spdx.js";

const router = express.Router();

router.get("/ai-systems/:id/export/cyclonedx", requireAuth, async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const asset = await prisma.aIAsset.findUnique({ where: { id }, include: { modelCard: { include: { metrics: true } }, riskLinks: { include: { risk: { include: { controlLinks: { include: { control: true } } } } } } } });

    if (!asset) {
      throw notFound("Asset not found");
    }

    const bom = buildCycloneDxBom([assetForBom(asset) as never]);
    const validation = await validateCycloneDxBom(bom);

    if (!validation.valid) {
      throw new AppError(500, "BOM_VALIDATION_FAILED", "Generated CycloneDX BOM failed schema validation", { validation });
    }

    res.json(bom);
  } catch (error) {
    next(error);
  }
});

router.get("/ai-systems/:id/export/spdx", requireAuth, async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const asset = await prisma.aIAsset.findUnique({ where: { id } });

    if (!asset) {
      throw notFound("Asset not found");
    }

    res.json(buildSpdxDocument([asset]));
  } catch (error) {
    next(error);
  }
});

router.get("/projects/:id/export/cyclonedx", requireAuth, async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const project = await prisma.project.findUnique({
      where: { id },
      include: { assetLinks: { include: { asset: { include: { modelCard: { include: { metrics: true } }, riskLinks: { include: { risk: { include: { controlLinks: { include: { control: true } } } } } } } } } } },
    });

    if (!project) {
      throw notFound("Project not found");
    }

    const bom = buildCycloneDxBom(project.assetLinks.map((link) => assetForBom(link.asset)) as never);
    const validation = await validateCycloneDxBom(bom);

    if (!validation.valid) {
      throw new AppError(500, "BOM_VALIDATION_FAILED", "Generated CycloneDX BOM failed schema validation", { validation });
    }

    res.json(bom);
  } catch (error) {
    next(error);
  }
});

router.post("/exports/cyclonedx", requireAuth, async (req, res, next) => {
  try {
    const body = z.object({ assetIds: z.array(z.string()).min(1).max(500) }).parse(req.body);
    const assets = await prisma.aIAsset.findMany({ where: { id: { in: body.assetIds } }, include: { modelCard: { include: { metrics: true } }, riskLinks: { include: { risk: { include: { controlLinks: { include: { control: true } } } } } } } });

    if (assets.length !== body.assetIds.length) {
      throw notFound("One or more assets were not found");
    }

    const bom = buildCycloneDxBom(assets.map(assetForBom) as never);
    const validation = await validateCycloneDxBom(bom);

    if (!validation.valid) {
      throw new AppError(500, "BOM_VALIDATION_FAILED", "Generated CycloneDX BOM failed schema validation", { validation });
    }

    res.json(bom);
  } catch (error) {
    next(error);
  }
});

export default router;
