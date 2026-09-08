-- AlterTable
ALTER TABLE "Risk" ADD COLUMN     "atlasMitigations" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "AtlasMitigationReference" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "AtlasMitigationReference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AtlasMitigationReference_name_key" ON "AtlasMitigationReference"("name");
