-- Expand: add normalized model-card metrics while preserving ModelCard.performanceMetrics JSON.
CREATE TABLE "ModelCardMetric" (
    "id" TEXT NOT NULL,
    "modelCardId" TEXT NOT NULL,
    "metricName" TEXT NOT NULL,
    "metricValue" DOUBLE PRECISION NOT NULL,
    "slice" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModelCardMetric_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ModelCardMetric_modelCardId_idx" ON "ModelCardMetric"("modelCardId");
CREATE INDEX "ModelCardMetric_metricName_idx" ON "ModelCardMetric"("metricName");

ALTER TABLE "ModelCardMetric" ADD CONSTRAINT "ModelCardMetric_modelCardId_fkey" FOREIGN KEY ("modelCardId") REFERENCES "ModelCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
