import { prisma } from "../prisma.js";
import { logger } from "../log.js";
import { deleteAttachment, ATTACHMENT_ENTITIES } from "./attachments.js";

/**
 * A tiny in-process job runner. Each job declares how often it wants to run; a
 * single interval ticks every minute and runs whatever is due. Good enough for
 * a single-instance deployment — if this ever runs multi-instance, move to a
 * real queue with leader election.
 */

type Job = {
  name: string;
  everyMs: number;
  run: () => Promise<void>;
};

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** Delete refresh-token sessions whose expiry has passed. */
export async function pruneExpiredSessions(): Promise<number> {
  const { count } = await prisma.session.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  if (count > 0) logger.info({ count }, "scheduler: pruned expired sessions");
  return count;
}

/**
 * Attachments reference their target row by (entityType, entityId) with no FK
 * (the target is polymorphic), so deleting a risk/control/... leaves orphan
 * rows and files. Sweep them.
 */
export async function pruneOrphanedAttachments(): Promise<number> {
  const existsById: Record<(typeof ATTACHMENT_ENTITIES)[number], (id: string) => Promise<boolean>> =
    {
      RISK: async (id) =>
        Boolean(await prisma.risk.findUnique({ where: { id }, select: { id: true } })),
      CONTROL: async (id) =>
        Boolean(await prisma.control.findUnique({ where: { id }, select: { id: true } })),
      MODEL_CARD: async (id) =>
        Boolean(await prisma.modelCard.findUnique({ where: { id }, select: { id: true } })),
      AI_SYSTEM: async (id) =>
        Boolean(await prisma.aIAsset.findUnique({ where: { id }, select: { id: true } })),
      PROJECT: async (id) =>
        Boolean(await prisma.project.findUnique({ where: { id }, select: { id: true } })),
    };

  const all = await prisma.attachment.findMany({
    select: { id: true, entityType: true, entityId: true, storageKey: true },
  });
  let removed = 0;
  for (const row of all) {
    if (await existsById[row.entityType](row.entityId)) continue;
    await prisma.attachment.delete({ where: { id: row.id } });
    deleteAttachment(row.storageKey);
    removed++;
  }
  if (removed > 0) logger.info({ removed }, "scheduler: pruned orphaned attachments");
  return removed;
}

const jobs: Job[] = [
  {
    name: "pruneExpiredSessions",
    everyMs: HOUR,
    run: async () => void (await pruneExpiredSessions()),
  },
  {
    name: "pruneOrphanedAttachments",
    everyMs: 6 * HOUR,
    run: async () => void (await pruneOrphanedAttachments()),
  },
];

const lastRun = new Map<string, number>();
let timer: NodeJS.Timeout | undefined;

export async function runDueJobs(now = Date.now()): Promise<void> {
  for (const job of jobs) {
    if (now - (lastRun.get(job.name) ?? 0) < job.everyMs) continue;
    lastRun.set(job.name, now);
    try {
      await job.run();
    } catch (err) {
      logger.error({ err, job: job.name }, "scheduler: job failed");
    }
  }
}

export function startScheduler(): void {
  if (timer) return;
  if (process.env.SCHEDULER_ENABLED === "false" || process.env.NODE_ENV === "test") {
    logger.info("scheduler disabled");
    return;
  }
  timer = setInterval(() => void runDueJobs(), MINUTE);
  timer.unref?.();
  setTimeout(() => void runDueJobs(), 10_000).unref?.();
  logger.info({ jobs: jobs.map((j) => j.name) }, "scheduler started");
}

export function stopScheduler(): void {
  if (timer) clearInterval(timer);
  timer = undefined;
  lastRun.clear();
}
