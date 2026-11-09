-- Storage strategy phase 1: provider on assets, workspace mode, BYOS purpose.

CREATE TYPE "StorageProvider" AS ENUM ('OMA_INTERNAL', 'USER_WORKDRIVE');
CREATE TYPE "StorageMode" AS ENUM ('OMA_INTERNAL', 'USER_WORKDRIVE', 'SYNC_BACKUP');

ALTER TABLE "WorkDriveConnection" ADD COLUMN "purpose" TEXT NOT NULL DEFAULT 'tenant_byos';

ALTER TABLE "MediaAsset" ADD COLUMN "storageProvider" "StorageProvider" NOT NULL DEFAULT 'OMA_INTERNAL';
ALTER TABLE "MediaAsset" ADD COLUMN "storagePath" TEXT;

-- Existing files already live on the workspace's own WorkDrive connection.
UPDATE "MediaAsset" SET "storageProvider" = 'USER_WORKDRIVE';

CREATE INDEX "MediaAsset_tenantId_storageProvider_createdAt_idx"
  ON "MediaAsset"("tenantId", "storageProvider", "createdAt");
CREATE INDEX "MediaAsset_tenantId_status_idx" ON "MediaAsset"("tenantId", "status");

CREATE TABLE "WorkspaceStorageSetting" (
    "tenantId" TEXT NOT NULL,
    "mode" "StorageMode" NOT NULL DEFAULT 'OMA_INTERNAL',
    "workdriveRootFolderId" TEXT,
    "workdriveKeyRef" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceStorageSetting_pkey" PRIMARY KEY ("tenantId")
);

ALTER TABLE "WorkspaceStorageSetting"
  ADD CONSTRAINT "WorkspaceStorageSetting_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "WorkspaceStorageSetting" ("tenantId", "mode", "updatedAt")
SELECT "tenantId", 'USER_WORKDRIVE'::"StorageMode", CURRENT_TIMESTAMP
FROM "WorkDriveConnection"
ON CONFLICT ("tenantId") DO NOTHING;
