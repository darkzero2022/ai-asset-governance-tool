-- CreateEnum
CREATE TYPE "ThreatModelElementType" AS ENUM ('MODEL', 'TRAINING_DATASET', 'INFERENCE_API', 'VECTOR_STORE', 'TOOL_MCP_SERVER', 'EXTERNAL_DATA_SOURCE', 'END_USER', 'DOWNSTREAM_CONSUMER', 'HUMAN_REVIEWER', 'DATA_STORE', 'PROCESS');

-- CreateEnum
CREATE TYPE "ThreatModelThreatStatus" AS ENUM ('SUGGESTED', 'ACCEPTED', 'DISMISSED', 'PROMOTED');

-- CreateTable
CREATE TABLE "ThreatModel" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ThreatModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrustBoundary" (
    "id" TEXT NOT NULL,
    "threatModelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "TrustBoundary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThreatModelElement" (
    "id" TEXT NOT NULL,
    "threatModelId" TEXT NOT NULL,
    "type" "ThreatModelElementType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "x" INTEGER,
    "y" INTEGER,
    "trustBoundaryId" TEXT,

    CONSTRAINT "ThreatModelElement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThreatModelFlow" (
    "id" TEXT NOT NULL,
    "threatModelId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "protocol" TEXT,
    "authenticated" BOOLEAN NOT NULL DEFAULT false,
    "encrypted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ThreatModelFlow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThreatModelThreat" (
    "id" TEXT NOT NULL,
    "threatModelId" TEXT NOT NULL,
    "ruleId" TEXT,
    "elementId" TEXT,
    "flowId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "strideAiCategory" "StrideAiCategory",
    "sourceFramework" "SourceFramework",
    "sourceCategoryId" TEXT,
    "status" "ThreatModelThreatStatus" NOT NULL DEFAULT 'SUGGESTED',
    "promotedRiskId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ThreatModelThreat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ThreatModel_assetId_key" ON "ThreatModel"("assetId");

-- CreateIndex
CREATE INDEX "TrustBoundary_threatModelId_idx" ON "TrustBoundary"("threatModelId");

-- CreateIndex
CREATE INDEX "ThreatModelElement_threatModelId_idx" ON "ThreatModelElement"("threatModelId");

-- CreateIndex
CREATE INDEX "ThreatModelFlow_threatModelId_idx" ON "ThreatModelFlow"("threatModelId");

-- CreateIndex
CREATE UNIQUE INDEX "ThreatModelThreat_promotedRiskId_key" ON "ThreatModelThreat"("promotedRiskId");

-- CreateIndex
CREATE INDEX "ThreatModelThreat_threatModelId_idx" ON "ThreatModelThreat"("threatModelId");

-- AddForeignKey
ALTER TABLE "ThreatModel" ADD CONSTRAINT "ThreatModel_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "AIAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThreatModel" ADD CONSTRAINT "ThreatModel_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustBoundary" ADD CONSTRAINT "TrustBoundary_threatModelId_fkey" FOREIGN KEY ("threatModelId") REFERENCES "ThreatModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThreatModelElement" ADD CONSTRAINT "ThreatModelElement_threatModelId_fkey" FOREIGN KEY ("threatModelId") REFERENCES "ThreatModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThreatModelElement" ADD CONSTRAINT "ThreatModelElement_trustBoundaryId_fkey" FOREIGN KEY ("trustBoundaryId") REFERENCES "TrustBoundary"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThreatModelFlow" ADD CONSTRAINT "ThreatModelFlow_threatModelId_fkey" FOREIGN KEY ("threatModelId") REFERENCES "ThreatModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThreatModelFlow" ADD CONSTRAINT "ThreatModelFlow_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "ThreatModelElement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThreatModelFlow" ADD CONSTRAINT "ThreatModelFlow_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "ThreatModelElement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThreatModelThreat" ADD CONSTRAINT "ThreatModelThreat_threatModelId_fkey" FOREIGN KEY ("threatModelId") REFERENCES "ThreatModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
