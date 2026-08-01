-- AlterTable
ALTER TABLE "GovernanceWorkflow" ADD COLUMN     "requiredRole" "Role",
ADD COLUMN     "stepIndex" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "RecertificationSchedule" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "cadenceDays" INTEGER NOT NULL,
    "nextDueDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecertificationSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RecertificationSchedule_assetId_key" ON "RecertificationSchedule"("assetId");

-- AddForeignKey
ALTER TABLE "RecertificationSchedule" ADD CONSTRAINT "RecertificationSchedule_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "AIAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
