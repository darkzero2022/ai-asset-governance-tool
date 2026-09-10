import bcrypt from "bcryptjs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "./prisma.js";
import { pruneExpiredSessions, pruneOrphanedAttachments } from "./lib/scheduler.js";
import { newStorageKey, storagePath, writeAttachment } from "./lib/attachments.js";
import fs from "node:fs";

let userId = "";

beforeAll(async () => {
  const user = await prisma.user.upsert({
    where: { email: "scheduler-test@example.com" },
    update: {},
    create: {
      email: "scheduler-test@example.com",
      name: "Scheduler",
      role: "ADMIN",
      passwordHash: await bcrypt.hash("x-not-used-here-x", 10),
    },
  });
  userId = user.id;
});

afterAll(async () => {
  await prisma.session.deleteMany({ where: { userId } });
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
});

describe("scheduler jobs", () => {
  it("pruneExpiredSessions removes only past-expiry rows", async () => {
    await prisma.session.create({
      data: {
        userId,
        tokenHash: `expired-${Date.now()}`,
        expiresAt: new Date(Date.now() - 1000),
      },
    });
    const live = await prisma.session.create({
      data: {
        userId,
        tokenHash: `live-${Date.now()}`,
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    const removed = await pruneExpiredSessions();
    expect(removed).toBeGreaterThanOrEqual(1);
    expect(await prisma.session.findUnique({ where: { id: live.id } })).not.toBeNull();

    await prisma.session.delete({ where: { id: live.id } });
  });

  it("pruneOrphanedAttachments deletes rows whose entity is gone", async () => {
    const storageKey = newStorageKey("orphan.txt");
    writeAttachment(storageKey, Buffer.from("orphan"));
    const row = await prisma.attachment.create({
      data: {
        entityType: "RISK",
        entityId: "risk-that-does-not-exist",
        filename: "orphan.txt",
        contentType: "text/plain",
        size: 6,
        storageKey,
        uploadedById: userId,
      },
    });

    const removed = await pruneOrphanedAttachments();
    expect(removed).toBeGreaterThanOrEqual(1);
    expect(await prisma.attachment.findUnique({ where: { id: row.id } })).toBeNull();
    expect(fs.existsSync(storagePath(storageKey))).toBe(false);
  });
});
