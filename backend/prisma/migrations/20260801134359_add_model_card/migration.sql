-- CreateTable
CREATE TABLE "ModelCard" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "approach" TEXT,
    "task" TEXT,
    "architectureFamily" TEXT,
    "modelArchitecture" TEXT,
    "datasetsDescription" TEXT,
    "inputsDescription" TEXT,
    "outputsDescription" TEXT,
    "intendedUsers" TEXT,
    "useCases" TEXT,
    "technicalLimitations" TEXT,
    "performanceTradeoffs" TEXT,
    "ethicalConsiderations" TEXT,
    "fairnessAssessments" TEXT,
    "environmentalConsiderations" TEXT,
    "performanceMetrics" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModelCard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ModelCard_assetId_key" ON "ModelCard"("assetId");

-- AddForeignKey
ALTER TABLE "ModelCard" ADD CONSTRAINT "ModelCard_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "AIAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
