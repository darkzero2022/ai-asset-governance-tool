import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.findUnique({ where: { email: "admin@example.com" }, select: { id: true } });

  if (!admin) {
    throw new Error("admin@example.com must exist before backfilling Risk.createdById");
  }

  await prisma.$executeRaw`UPDATE "Risk" SET "createdById" = ${admin.id} WHERE "createdById" IS NULL`;
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
