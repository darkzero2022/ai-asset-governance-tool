-- Add optional citation URL for imported/sourced asset records.
ALTER TABLE "AIAsset" ADD COLUMN "sourceUrl" TEXT;
