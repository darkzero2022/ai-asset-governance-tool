import express from "express";
import { prisma } from "../prisma.js";
import { requireAuth } from "../auth.js";
import { requireRole } from "../rbac.js";
import { audit } from "../lib/audit.js";
import { MAX_LIST_ROWS } from "../lib/http.js";
import { controlSchema, controlUpdateSchema } from "../schemas.js";
import { lockWhere, staleWrite } from "../lib/concurrency.js";

const router = express.Router();

router.get("/controls", requireAuth, async (req, res, next) => {
  try {
    const includeArchived = req.query.includeArchived === "true";
    const controls = await prisma.control.findMany({ where: includeArchived ? {} : { archived: false }, include: { _count: { select: { links: true } } }, orderBy: [{ mappedFramework: "asc" }, { mappedControlId: "asc" }] , take: MAX_LIST_ROWS });
    res.json({ controls });
  } catch (error) {
    next(error);
  }
});

router.put("/controls/:id", requireAuth, requireRole("ADMIN", "RISK_OWNER"), async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const body = controlUpdateSchema.parse(req.body);
    const before = await prisma.control.findUniqueOrThrow({ where: { id } });
    const { count } = await prisma.control.updateMany({
      where: lockWhere(id, body.expectedUpdatedAt),
      data: { name: body.mappedControlId, mappedFramework: body.mappedFramework, mappedControlId: body.mappedControlId },
    });
    if (count === 0) throw staleWrite();
    const control = await prisma.control.findUniqueOrThrow({ where: { id } });
    await audit(req.user!.id, "Control", control.id, "UPDATE", before, control);
    res.json({ control });
  } catch (error) {
    next(error);
  }
});

router.delete("/controls/:id", requireAuth, requireRole("ADMIN"), async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const before = await prisma.control.findUniqueOrThrow({ where: { id }, include: { links: true } });

    if (before.links.length > 0) {
      const control = await prisma.control.update({ where: { id }, data: { archived: true } });
      await audit(req.user!.id, "Control", id, "ARCHIVE", before, control);
    } else {
      await prisma.control.delete({ where: { id } });
      await audit(req.user!.id, "Control", id, "DELETE", before, undefined);
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
