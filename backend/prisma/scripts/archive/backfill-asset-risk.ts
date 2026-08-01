// Historical one-time Phase 2 migration record; this no longer compiles against the current schema.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const risks = await prisma.risk.findMany({ select: { id: true, assetId: true } });

  if (!risks.length) {
    console.log("No risks found; AssetRisk backfill skipped.");
    return;
  }

  await prisma.assetRisk.createMany({
    data: risks.map((risk) => ({ riskId: risk.id, assetId: risk.assetId })),
    skipDuplicates: true,
  });

  console.log(`Backfilled AssetRisk links for ${risks.length} risks.`);
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    process.exit(1);
  });
