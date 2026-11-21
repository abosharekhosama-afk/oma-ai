ALTER TABLE "ScanAttempt" ADD COLUMN "progressUpdatedAt" TIMESTAMP(3);

UPDATE "ScanAttempt" SET "progressUpdatedAt" = COALESCE("startedAt", "createdAt") WHERE "progressUpdatedAt" IS NULL;