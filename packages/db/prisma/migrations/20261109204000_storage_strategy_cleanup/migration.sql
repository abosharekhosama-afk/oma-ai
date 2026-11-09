-- Phase 5: job kinds, migrations, quota reconcile snapshot.

CREATE TYPE "StorageJobKind" AS ENUM ('BACKUP', 'REPLICA_TRASH', 'MIGRATE');
CREATE TYPE "StorageMigrationStatus" AS ENUM ('PENDING', 'RUNNING', 'DONE', 'FAILED', 'CANCELLED');

ALTER TABLE "StorageBackupJob" ADD COLUMN "kind" "StorageJobKind" NOT NULL DEFAULT 'BACKUP';

DROP INDEX "StorageBackupJob_mediaAssetId_workdriveConnectionId_key";
DROP INDEX "StorageBackupJob_tenantId_status_idx";

CREATE UNIQUE INDEX "StorageBackupJob_mediaAssetId_workdriveConnectionId_kind_key"
  ON "StorageBackupJob"("mediaAssetId", "workdriveConnectionId", "kind");
CREATE INDEX "StorageBackupJob_tenantId_status_kind_idx"
  ON "StorageBackupJob"("tenantId", "status", "kind");

CREATE TABLE "StorageMigration" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "status" "StorageMigrationStatus" NOT NULL DEFAULT 'PENDING',
    "deleteSource" BOOLEAN NOT NULL DEFAULT false,
    "total" INTEGER NOT NULL DEFAULT 0,
    "completed" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "startedBy" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StorageMigration_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StorageMigration_tenantId_status_idx" ON "StorageMigration"("tenantId", "status");

ALTER TABLE "StorageMigration"
  ADD CONSTRAINT "StorageMigration_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "StorageQuotaReconcile" (
    "id" TEXT NOT NULL,
    "ranAt" TIMESTAMP(3) NOT NULL,
    "omaInternalBytes" BIGINT NOT NULL,
    "platformUsedBytes" BIGINT,
    "platformLimitBytes" BIGINT,
    "driftBytes" BIGINT,
    "tenantsScanned" INTEGER NOT NULL DEFAULT 0,
    "dryRun" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,

    CONSTRAINT "StorageQuotaReconcile_pkey" PRIMARY KEY ("id")
);
