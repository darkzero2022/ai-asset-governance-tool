import { PrismaClient } from "@prisma/client";
import { auditExtension } from "./db/auditExtension.js";

const base = new PrismaClient();

// The audit extension uses `base` (un-extended) for its own reads/writes so it
// never recurses. Downstream code imports the extended client as `prisma`.
export const prisma = base.$extends(auditExtension(base));
