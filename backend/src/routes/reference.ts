import express from "express";
import { prisma } from "../prisma.js";
import { requireAuth } from "../auth.js";
import { STRIDE_AI_CATEGORIES } from "../strideAtlas.js";

const router = express.Router();

router.get("/reference/framework-categories", requireAuth, async (req, res, next) => {
  try {
    const framework = req.query.framework as string | undefined;
    // Reference tables are small fixed sets (<20 rows) — no pagination.
    const categories = await prisma.frameworkCategory.findMany({
      where: framework ? { framework: framework as never } : undefined,
      orderBy: [{ framework: "asc" }, { categoryId: "asc" }],
    });
    res.json({ categories });
  } catch (error) {
    next(error);
  }
});

router.get("/reference/eu-ai-act-risk-tiers", requireAuth, async (_req, res, next) => {
  try {
    // Fixed reference set.
    const tiers = await prisma.euAiActRiskTierReference.findMany({ orderBy: { name: "asc" } });
    res.json({ tiers });
  } catch (error) {
    next(error);
  }
});

router.get("/reference/stride-ai-categories", requireAuth, (_req, res) => {
  res.json({ categories: STRIDE_AI_CATEGORIES });
});

router.get("/reference/atlas-techniques", requireAuth, async (_req, res, next) => {
  try {
    // Fixed reference set.
    const techniques = await prisma.atlasTechniqueReference.findMany({ orderBy: { name: "asc" } });
    res.json({ techniques });
  } catch (error) {
    next(error);
  }
});

router.get("/reference/atlas-mitigations", requireAuth, async (_req, res, next) => {
  try {
    // Fixed reference set (MITRE ATLAS mitigations, for Risk.atlasMitigations).
    const mitigations = await prisma.atlasMitigationReference.findMany({
      orderBy: { name: "asc" },
    });
    res.json({ mitigations });
  } catch (error) {
    next(error);
  }
});

router.get("/reference/frameworks", requireAuth, async (_req, res, next) => {
  try {
    // One row per SourceFramework: display title, the exact revision in use,
    // draft/released status, source URL, licence note. The UI badges drafts.
    const frameworks = await prisma.frameworkMeta.findMany({ orderBy: { framework: "asc" } });
    res.json({ frameworks });
  } catch (error) {
    next(error);
  }
});

router.get("/reference/threat-mappings", requireAuth, async (_req, res, next) => {
  try {
    // Framework category -> STRIDE-AI + ATLAS technique(s) + suggested ATLAS mitigation(s).
    const mappings = await prisma.frameworkThreatMapping.findMany({
      orderBy: [{ framework: "asc" }, { categoryId: "asc" }],
    });
    res.json({ mappings });
  } catch (error) {
    next(error);
  }
});

// Deprecated alias for /reference/threat-mappings — kept for one release.
router.get("/reference/stride-atlas-map", requireAuth, async (_req, res, next) => {
  try {
    const mappings = await prisma.frameworkThreatMapping.findMany({
      orderBy: [{ framework: "asc" }, { categoryId: "asc" }],
    });
    res.json({ mappings });
  } catch (error) {
    next(error);
  }
});

router.get("/reference/framework-crosswalk", requireAuth, async (req, res, next) => {
  try {
    const framework = req.query.framework as string | undefined;
    const categoryId = req.query.categoryId as string | undefined;
    const crosswalk = await prisma.frameworkCrosswalk.findMany({
      where:
        framework && categoryId
          ? { fromFramework: framework as never, fromCategoryId: categoryId }
          : undefined,
      orderBy: [
        { fromFramework: "asc" },
        { fromCategoryId: "asc" },
        { toFramework: "asc" },
        { toCategoryId: "asc" },
      ],
    });
    res.json({ crosswalk });
  } catch (error) {
    next(error);
  }
});

export default router;
