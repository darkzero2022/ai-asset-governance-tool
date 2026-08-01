-- Contract Risk.assetId after AssetRisk backfill.
ALTER TABLE "Risk" DROP CONSTRAINT "Risk_assetId_fkey";
DROP INDEX "Risk_assetId_idx";
ALTER TABLE "Risk" DROP COLUMN "assetId";
