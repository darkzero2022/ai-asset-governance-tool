-- Expand: add user activation state for admin-managed user lifecycle.
ALTER TABLE "User" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;
