import express from "express";
import { prisma } from "../prisma.js";
import { requireAuth } from "../auth.js";
import { requireRole } from "../rbac.js";
import { audit } from "../lib/audit.js";
import { controlSchema } from "../schemas.js";

const router = express.Router();

router.get("/controls", requireAuth, async (req, res, next) => {
  try {
    const includeArchived = req.query.includeArchived === "true";
    const controls = await prisma.control.findMany({ where: includeArchived ? {} : { archived: false }, include: { _count: { select: { links: true } } }, orderBy: [{ mappedFramework: "asc" }, { mappedControlId: "asc" }] });
    res.json({ controls });
  } catch (error) {
    next(error);
  }
});

router.put("/controls/:id", requireAuth, requireRole("ADMIN", "RISK_OWNER"), async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const body = controlSchema.parse(req.body);
    const before = await prisma.control.findUniqueOrThrow({ where: { id } });
    const control = await prisma.control.update({ where: { id }, data: { name: body.mappedControlId, mappedFramework: body.mappedFramework, mappedControlId: body.mappedControlId } });
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
