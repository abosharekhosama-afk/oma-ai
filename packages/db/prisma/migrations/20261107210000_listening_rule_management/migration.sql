-- Per-rule listening management: sync status and independent hit attribution.

ALTER TABLE "ListeningRule" ADD COLUMN IF NOT EXISTS "syncStatus" TEXT NOT NULL DEFAULT 'IDLE';
ALTER TABLE "ListeningRule" ADD COLUMN IF NOT EXISTS "lastSyncStartedAt" TIMESTAMP(3);
ALTER TABLE "ListeningRule" ADD COLUMN IF NOT EXISTS "lastSyncFinishedAt" TIMESTAMP(3);
ALTER TABLE "ListeningRule" ADD COLUMN IF NOT EXISTS "lastSyncIngested" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ListeningRule" ADD COLUMN IF NOT EXISTS "lastSyncError" TEXT;

DROP INDEX IF EXISTS "ListeningHit_tenantId_platform_externalPostId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "ListeningHit_tenantId_ruleId_platform_externalPostId_key"
  ON "ListeningHit"("tenantId", "ruleId", "platform", "externalPostId");
