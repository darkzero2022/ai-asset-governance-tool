/*
  Warnings:

  - You are about to drop the `StrideAtlasMapping` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "FrameworkStatus" AS ENUM ('DRAFT', 'RELEASED');

-- CreateEnum
CREATE TYPE "CrosswalkRelationship" AS ENUM ('EQUIVALENT', 'RELATED', 'BROADER', 'NARROWER');

-- AlterEnum
ALTER TYPE "SourceFramework" ADD VALUE 'OWASP_MCP_TOP10';

-- DropTable
DROP TABLE "StrideAtlasMapping";

-- CreateTable
CREATE TABLE "FrameworkThreatMapping" (
    "id" TEXT NOT NULL,
    "framework" "SourceFramework" NOT NULL,
    "categoryId" TEXT NOT NULL,
    "strideAiCategory" "StrideAiCategory",
    "atlasTechniques" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "atlasMitigations" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "FrameworkThreatMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FrameworkCrosswalk" (
    "id" TEXT NOT NULL,
    "fromFramework" "SourceFramework" NOT NULL,
    "fromCategoryId" TEXT NOT NULL,
    "toFramework" "SourceFramework" NOT NULL,
    "toCategoryId" TEXT NOT NULL,
    "relationship" "CrosswalkRelationship" NOT NULL,
    "rationale" TEXT,

    CONSTRAINT "FrameworkCrosswalk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FrameworkMeta" (
    "id" TEXT NOT NULL,
    "framework" "SourceFramework" NOT NULL,
    "title" TEXT NOT NULL,
    "revision" TEXT NOT NULL,
    "status" "FrameworkStatus" NOT NULL DEFAULT 'RELEASED',
    "sourceUrl" TEXT NOT NULL,
    "licenseNote" TEXT,

    CONSTRAINT "FrameworkMeta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FrameworkThreatMapping_framework_idx" ON "FrameworkThreatMapping"("framework");

-- CreateIndex
CREATE UNIQUE INDEX "FrameworkThreatMapping_framework_categoryId_key" ON "FrameworkThreatMapping"("framework", "categoryId");

-- CreateIndex
CREATE INDEX "FrameworkCrosswalk_fromFramework_fromCategoryId_idx" ON "FrameworkCrosswalk"("fromFramework", "fromCategoryId");

-- CreateIndex
CREATE UNIQUE INDEX "FrameworkCrosswalk_fromFramework_fromCategoryId_toFramework_key" ON "FrameworkCrosswalk"("fromFramework", "fromCategoryId", "toFramework", "toCategoryId");

-- CreateIndex
CREATE UNIQUE INDEX "FrameworkMeta_framework_key" ON "FrameworkMeta"("framework");
