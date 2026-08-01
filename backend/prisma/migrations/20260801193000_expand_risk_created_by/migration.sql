-- Expand: add nullable Risk.createdById before backfilling existing rows.
ALTER TABLE "Risk" ADD COLUMN "createdById" TEXT;

CREATE INDEX "Risk_createdById_idx" ON "Risk"("createdById");

ALTER TABLE "Risk" ADD CONSTRAINT "Risk_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
