-- AlterTable
ALTER TABLE "Control" ADD COLUMN     "archived" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Risk" ADD COLUMN     "archived" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Control_archived_idx" ON "Control"("archived");

-- CreateIndex
CREATE INDEX "Risk_archived_idx" ON "Risk"("archived");
