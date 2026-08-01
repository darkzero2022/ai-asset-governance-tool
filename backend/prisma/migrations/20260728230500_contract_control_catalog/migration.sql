-- Contract legacy per-risk Control fields after RiskControl backfill.
ALTER TABLE "Control" DROP CONSTRAINT "Control_riskId_fkey";
DROP INDEX "Control_riskId_idx";
DROP INDEX "Control_mappedFramework_idx";
ALTER TABLE "Control" DROP COLUMN "riskId";
ALTER TABLE "Control" DROP COLUMN "implementationStatus";
ALTER TABLE "Control" DROP COLUMN "evidenceNotes";
CREATE UNIQUE INDEX "Control_mappedFramework_mappedControlId_key" ON "Control"("mappedFramework", "mappedControlId");
