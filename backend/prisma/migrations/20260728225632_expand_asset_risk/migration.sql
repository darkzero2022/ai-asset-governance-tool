-- CreateTable
CREATE TABLE "AssetRisk" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "riskId" TEXT NOT NULL,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetRisk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssetRisk_riskId_idx" ON "AssetRisk"("riskId");

-- CreateIndex
CREATE UNIQUE INDEX "AssetRisk_assetId_riskId_key" ON "AssetRisk"("assetId", "riskId");

-- AddForeignKey
ALTER TABLE "AssetRisk" ADD CONSTRAINT "AssetRisk_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "AIAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetRisk" ADD CONSTRAINT "AssetRisk_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "Risk"("id") ON DELETE CASCADE ON UPDATE CASCADE;
