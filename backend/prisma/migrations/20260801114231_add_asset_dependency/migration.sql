-- CreateTable
CREATE TABLE "AssetDependency" (
    "id" TEXT NOT NULL,
    "parentAssetId" TEXT NOT NULL,
    "childAssetId" TEXT NOT NULL,

    CONSTRAINT "AssetDependency_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssetDependency_childAssetId_idx" ON "AssetDependency"("childAssetId");

-- CreateIndex
CREATE UNIQUE INDEX "AssetDependency_parentAssetId_childAssetId_key" ON "AssetDependency"("parentAssetId", "childAssetId");

-- AddForeignKey
ALTER TABLE "AssetDependency" ADD CONSTRAINT "AssetDependency_parentAssetId_fkey" FOREIGN KEY ("parentAssetId") REFERENCES "AIAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetDependency" ADD CONSTRAINT "AssetDependency_childAssetId_fkey" FOREIGN KEY ("childAssetId") REFERENCES "AIAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
