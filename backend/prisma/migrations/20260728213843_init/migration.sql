-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('MODEL', 'DATASET', 'SERVICE', 'LIBRARY');

-- CreateEnum
CREATE TYPE "HostingModel" AS ENUM ('SAAS_API', 'SELF_HOSTED', 'EMBEDDED_IN_APP');

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('DRAFT', 'UNDER_REVIEW', 'APPROVED', 'DEPLOYED', 'RETIRED');

-- CreateEnum
CREATE TYPE "SourceFramework" AS ENUM ('NIST_AI_RMF', 'EU_AI_ACT', 'OWASP_LLM_TOP10');

-- CreateEnum
CREATE TYPE "EuAiActRiskTier" AS ENUM ('UNACCEPTABLE', 'HIGH', 'LIMITED', 'MINIMAL');

-- CreateEnum
CREATE TYPE "RiskStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'MITIGATED', 'ACCEPTED');

-- CreateEnum
CREATE TYPE "ControlImplementationStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'IMPLEMENTED', 'VERIFIED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIAsset" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "type" "AssetType" NOT NULL,
    "supplier" TEXT NOT NULL,
    "provider" TEXT,
    "hostingModel" "HostingModel" NOT NULL,
    "license" TEXT,
    "dataClassificationTouched" TEXT,
    "trainingDataProvenance" TEXT,
    "downstreamConsumers" TEXT,
    "status" "AssetStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Risk" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "sourceFramework" "SourceFramework" NOT NULL,
    "sourceCategoryId" TEXT NOT NULL,
    "euAiActRiskTier" "EuAiActRiskTier",
    "description" TEXT NOT NULL,
    "likelihood" INTEGER NOT NULL,
    "impact" INTEGER NOT NULL,
    "inherentRiskScore" INTEGER NOT NULL,
    "residualRiskScore" INTEGER,
    "treatmentPlan" TEXT,
    "owner" TEXT,
    "dueDate" TIMESTAMP(3),
    "status" "RiskStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Risk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Control" (
    "id" TEXT NOT NULL,
    "riskId" TEXT NOT NULL,
    "mappedFramework" "SourceFramework" NOT NULL,
    "mappedControlId" TEXT NOT NULL,
    "implementationStatus" "ControlImplementationStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "evidenceNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Control_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GovernanceWorkflow" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "fromStatus" "AssetStatus" NOT NULL,
    "toStatus" "AssetStatus" NOT NULL,
    "approvedById" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "comments" TEXT,

    CONSTRAINT "GovernanceWorkflow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FrameworkCategory" (
    "id" TEXT NOT NULL,
    "framework" "SourceFramework" NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "FrameworkCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EuAiActRiskTierReference" (
    "id" TEXT NOT NULL,
    "tier" "EuAiActRiskTier" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "EuAiActRiskTierReference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "AIAsset_status_idx" ON "AIAsset"("status");

-- CreateIndex
CREATE INDEX "AIAsset_type_idx" ON "AIAsset"("type");

-- CreateIndex
CREATE INDEX "AIAsset_hostingModel_idx" ON "AIAsset"("hostingModel");

-- CreateIndex
CREATE INDEX "Risk_assetId_idx" ON "Risk"("assetId");

-- CreateIndex
CREATE INDEX "Risk_sourceFramework_idx" ON "Risk"("sourceFramework");

-- CreateIndex
CREATE INDEX "Risk_status_idx" ON "Risk"("status");

-- CreateIndex
CREATE INDEX "Risk_inherentRiskScore_idx" ON "Risk"("inherentRiskScore");

-- CreateIndex
CREATE INDEX "Control_riskId_idx" ON "Control"("riskId");

-- CreateIndex
CREATE INDEX "Control_mappedFramework_idx" ON "Control"("mappedFramework");

-- CreateIndex
CREATE INDEX "GovernanceWorkflow_assetId_idx" ON "GovernanceWorkflow"("assetId");

-- CreateIndex
CREATE INDEX "GovernanceWorkflow_timestamp_idx" ON "GovernanceWorkflow"("timestamp");

-- CreateIndex
CREATE INDEX "FrameworkCategory_framework_idx" ON "FrameworkCategory"("framework");

-- CreateIndex
CREATE UNIQUE INDEX "FrameworkCategory_framework_categoryId_key" ON "FrameworkCategory"("framework", "categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "EuAiActRiskTierReference_tier_key" ON "EuAiActRiskTierReference"("tier");

-- AddForeignKey
ALTER TABLE "AIAsset" ADD CONSTRAINT "AIAsset_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Risk" ADD CONSTRAINT "Risk_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "AIAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Risk" ADD CONSTRAINT "Risk_sourceFramework_sourceCategoryId_fkey" FOREIGN KEY ("sourceFramework", "sourceCategoryId") REFERENCES "FrameworkCategory"("framework", "categoryId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Control" ADD CONSTRAINT "Control_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "Risk"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GovernanceWorkflow" ADD CONSTRAINT "GovernanceWorkflow_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "AIAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GovernanceWorkflow" ADD CONSTRAINT "GovernanceWorkflow_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
