-- Storage strategy phase 4: SYNC_BACKUP replica jobs.

CREATE TYPE "BackupJobStatus" AS ENUM ('PENDING', 'RUNNING', 'DONE', 'FAILED', 'SKIPPED');

ALTER TABLE "WorkspaceStorageSetting" ADD COLUMN "backupPausedAt" TIMESTAMP(3);
ALTER TABLE "WorkspaceStorageSetting" ADD COLUMN "backupPausedReason" TEXT;

ALTER TABLE "MediaAsset" ADD COLUMN "replicaFileId" TEXT;
ALTER TABLE "MediaAsset" ADD COLUMN "replicaFolderId" TEXT;
ALTER TABLE "MediaAsset" ADD COLUMN "replicaStatus" TEXT;

CREATE TABLE "StorageBackupJob" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "mediaAssetId" TEXT NOT NULL,
    "workdriveConnectionId" TEXT NOT NULL,
    "status" "BackupJobStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3),
    "lastError" TEXT,
    "replicaPath" TEXT,
    "replicaFileId" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StorageBackupJob_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StorageBackupJob_mediaAssetId_workdriveConnectionId_key"
  ON "StorageBackupJob"("mediaAssetId", "workdriveConnectionId");
CREATE INDEX "StorageBackupJob_status_nextAttemptAt_idx"
  ON "StorageBackupJob"("status", "nextAttemptAt");
CREATE INDEX "StorageBackupJob_tenantId_status_idx"
  ON "StorageBackupJob"("tenantId", "status");

ALTER TABLE "StorageBackupJob"
  ADD CONSTRAINT "StorageBackupJob_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StorageBackupJob"
  ADD CONSTRAINT "StorageBackupJob_mediaAssetId_fkey"
  FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
