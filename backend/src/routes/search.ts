import express from "express";
import { prisma } from "../prisma.js";
import { requireAuth } from "../auth.js";

const router = express.Router();

router.get("/search", requireAuth, async (req, res, next) => {
  try {
    const q = String(req.query.q ?? "").trim();
    if (!q) {
      res.json({ assets: [], projects: [], risks: [] });
      return;
    }
    const [assets, projects, risks] = await Promise.all([
      prisma.aIAsset.findMany({ where: { name: { contains: q, mode: "insensitive" } }, take: 10 }),
      prisma.project.findMany({
        where: {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
          ],
        },
        take: 10,
      }),
      prisma.risk.findMany({
        where: { description: { contains: q, mode: "insensitive" } },
        take: 10,
      }),
    ]);
    res.json({ assets, projects, risks });
  } catch (error) {
    next(error);
  }
});

export default router;
