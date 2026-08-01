-- Contract: require Risk.createdById after backfilling existing rows to the seed admin user.
UPDATE "Risk"
SET "createdById" = (SELECT "id" FROM "User" WHERE "email" = 'admin@example.com')
WHERE "createdById" IS NULL;

ALTER TABLE "Risk" ALTER COLUMN "createdById" SET NOT NULL;
