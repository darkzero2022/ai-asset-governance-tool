-- CreateEnum
CREATE TYPE "StrideAiCategory" AS ENUM ('MODEL_IMPERSONATION', 'DATA_MODEL_POISONING', 'PROVENANCE_LOSS', 'MODEL_INVERSION', 'RESOURCE_EXHAUSTION', 'ALIGNMENT_BYPASS');

-- AlterTable (additive, nullable — no backfill required)
ALTER TABLE "Risk" ADD COLUMN "strideAiCategory" "StrideAiCategory";
ALTER TABLE "Risk" ADD COLUMN "atlasTechnique" TEXT;

-- CreateTable
CREATE TABLE "StrideAtlasMapping" (
    "id" TEXT NOT NULL,
    "owaspCategoryId" TEXT NOT NULL,
    "strideAiCategory" "StrideAiCategory" NOT NULL,
    "atlasTechnique" TEXT,

    CONSTRAINT "StrideAtlasMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AtlasTechniqueReference" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "AtlasTechniqueReference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StrideAtlasMapping_owaspCategoryId_key" ON "StrideAtlasMapping"("owaspCategoryId");

-- CreateIndex
CREATE UNIQUE INDEX "AtlasTechniqueReference_name_key" ON "AtlasTechniqueReference"("name");
