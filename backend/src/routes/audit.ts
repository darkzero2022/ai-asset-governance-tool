import express from "express";
import { prisma } from "../prisma.js";
import { requireAuth } from "../auth.js";
import { pagination } from "../lib/http.js";

const router = express.Router();

router.get("/audit-logs", requireAuth, async (req, res, next) => {
  try {
    const entityType = typeof req.query.entityType === "string" ? req.query.entityType : undefined;
    const entityId = typeof req.query.entityId === "string" ? req.query.entityId : undefined;
    const page = pagination(req.query);
    const where = {
      ...(entityType ? { entityType } : {}),
      ...(entityId ? { entityId } : {}),
    };
    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        include: { actor: { select: { id: true, name: true, email: true } } },
        orderBy: { timestamp: "desc" },
        skip: page.skip,
        take: page.take,
      }),
    ]);

    res.json({ logs, pagination: { ...page, total } });
  } catch (error) {
    next(error);
  }
});

export default router;
