import express from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../prisma.js";
import { requireAuth } from "../auth.js";
import { requireRole } from "../rbac.js";
import { MAX_LIST_ROWS } from "../lib/http.js";
import { audit } from "../lib/audit.js";
import { userCreateSchema, userUpdateSchema } from "../schemas.js";

const router = express.Router();

router.get("/users", requireAuth, requireRole("ADMIN"), async (_req, res, next) => {
  try {
    const users = await prisma.user.findMany({ select: { id: true, email: true, name: true, role: true, active: true, createdAt: true }, orderBy: { createdAt: "desc" } , take: MAX_LIST_ROWS });
    res.json({ users });
  } catch (error) {
    next(error);
  }
});

router.post("/users", requireAuth, requireRole("ADMIN"), async (req, res, next) => {
  try {
    const body = userCreateSchema.parse(req.body);
    const user = await prisma.user.create({
      data: { email: body.email, name: body.name, role: body.role, passwordHash: await bcrypt.hash(body.password, 10) },
      select: { id: true, email: true, name: true, role: true, active: true, createdAt: true },
    });
    await audit(req.user!.id, "User", user.id, "CREATE", undefined, user);
    res.status(201).json({ user });
  } catch (error) {
    next(error);
  }
});

router.put("/users/:id", requireAuth, requireRole("ADMIN"), async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const body = userUpdateSchema.parse(req.body);
    const before = await prisma.user.findUniqueOrThrow({ where: { id }, select: { id: true, email: true, name: true, role: true, active: true, createdAt: true } });
    // An admin resetting the password, deactivating the account, or forcing a
    // reset should also kill any live sessions/tokens for that user.
    const revoke = body.password !== undefined || body.active === false || body.mustChangePassword === true;
    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.role !== undefined ? { role: body.role } : {}),
        ...(body.active !== undefined ? { active: body.active } : {}),
        ...(body.mustChangePassword !== undefined ? { mustChangePassword: body.mustChangePassword } : {}),
        ...(body.password !== undefined
          ? { passwordHash: await bcrypt.hash(body.password, 10), lockedUntil: null, failedLoginAttempts: 0 }
          : {}),
        ...(revoke ? { tokenVersion: { increment: 1 }, sessions: { deleteMany: {} } } : {}),
      },
      select: { id: true, email: true, name: true, role: true, active: true, createdAt: true },
    });
    await audit(req.user!.id, "User", id, "UPDATE", before, user);
    res.json({ user });
  } catch (error) {
    next(error);
  }
});

export default router;
