// Historical one-time Phase 2 migration record; this no longer compiles against the current schema.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const controls = await prisma.control.findMany({
    select: {
      id: true,
      riskId: true,
      mappedControlId: true,
      implementationStatus: true,
      evidenceNotes: true,
    },
  });

  for (const control of controls) {
    await prisma.control.update({
      where: { id: control.id },
      data: { name: control.mappedControlId },
    });
    await prisma.riskControl.upsert({
      where: { riskId_controlId: { riskId: control.riskId, controlId: control.id } },
      update: {
        implementationStatus: control.implementationStatus,
        evidenceNotes: control.evidenceNotes,
      },
      create: {
        riskId: control.riskId,
        controlId: control.id,
        implementationStatus: control.implementationStatus,
        evidenceNotes: control.evidenceNotes,
      },
    });
  }

  console.log(`Backfilled RiskControl links for ${controls.length} controls.`);
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    process.exit(1);
  });
