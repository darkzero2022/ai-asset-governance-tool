import "../env.js";
import { prisma } from "../prisma.js";
import { sendSlackMessage } from "../integrations/slack.js";
import { logger } from "../log.js";

const dueSoonDays = Number(process.env.RECERTIFICATION_DUE_SOON_DAYS ?? 30);
const staleAssetDays = Number(process.env.STALE_ASSET_DAYS ?? 14);

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

async function main() {
  const now = new Date();
  const dueSoonCutoff = addDays(now, dueSoonDays);
  const staleCutoff = addDays(now, -staleAssetDays);
  const [recertifications, staleAssets] = await Promise.all([
    prisma.recertificationSchedule.findMany({
      where: { nextDueDate: { lte: dueSoonCutoff } },
      include: { asset: true },
      orderBy: { nextDueDate: "asc" },
    }),
    prisma.aIAsset.findMany({
      where: { status: { in: ["DRAFT", "UNDER_REVIEW"] }, updatedAt: { lte: staleCutoff } },
      orderBy: { updatedAt: "asc" },
    }),
  ]);

  for (const schedule of recertifications) {
    const status = schedule.nextDueDate < now ? "OVERDUE" : "DUE_SOON";
    await sendSlackMessage(
      `Recertification ${status}: ${schedule.asset.name} (${schedule.asset.id}) due ${schedule.nextDueDate.toISOString().slice(0, 10)}`,
    );
  }

  for (const asset of staleAssets) {
    await sendSlackMessage(
      `Stale asset workflow: ${asset.name} (${asset.id}) has been ${asset.status} since ${asset.updatedAt.toISOString().slice(0, 10)}`,
    );
  }

  logger.info(
    { recertifications: recertifications.length, staleAssets: staleAssets.length },
    "notification scan complete",
  );
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch((error) => {
    logger.error({ err: error }, "notification scan failed");
    process.exit(1);
  });
