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
    const mitigations = await prisma.atlasMitigationReference.findMany({ orderBy: { name: "asc" } });
    res.json({ mitigations });
  } catch (error) {
    next(error);
  }
});

router.get("/reference/stride-atlas-map", requireAuth, async (_req, res, next) => {
  try {
    // Fixed reference set (OWASP LLM Top 10 -> STRIDE-AI/ATLAS).
    const mappings = await prisma.strideAtlasMapping.findMany({ orderBy: { owaspCategoryId: "asc" } });
    res.json({ mappings });
  } catch (error) {
    next(error);
  }
});

export default router;
