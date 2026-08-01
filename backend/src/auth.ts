import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { Role } from "@prisma/client";
import { prisma } from "./prisma.js";

export type AuthUser = {
  id: string;
  email: string;
  role: Role;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

function jwtSecret() {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is required");
  }

  return process.env.JWT_SECRET;
}

export function signToken(user: AuthUser) {
  return jwt.sign(user, jwtSecret(), { expiresIn: "8h" });
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.header("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;

  if (!token) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  try {
    const user = jwt.verify(token, jwtSecret()) as AuthUser;
    const activeUser = await prisma.user.findUnique({ where: { id: user.id }, select: { active: true } });

    if (!activeUser?.active) {
      res.status(401).json({ error: "User account is deactivated" });
      return;
    }

    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
