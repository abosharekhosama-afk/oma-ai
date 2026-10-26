-- WorkDrive storage: per-tenant connection + media assets (DEC-003).

-- CreateEnum
CREATE TYPE "WorkDriveConnectionStatus" AS ENUM ('CONNECTED', 'ERROR');

-- CreateEnum
CREATE TYPE "MediaAssetStatus" AS ENUM ('READY', 'MISSING');

-- AlterTable
ALTER TABLE "BrandWorkspace" ADD COLUMN     "logoAssetId" TEXT;

-- AlterTable
ALTER TABLE "ContentItem" ADD COLUMN     "previewAssetId" TEXT;

-- AlterTable
ALTER TABLE "WorkDeliverable" ADD COLUMN     "assetId" TEXT;

-- AlterTable
ALTER TABLE "WorkDeliverableVersion" ADD COLUMN     "assetId" TEXT;

-- CreateTable
CREATE TABLE "WorkDriveConnection" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "apiKeyEnc" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "orgName" TEXT NOT NULL,
    "rootFolderId" TEXT,
    "rootFolderName" TEXT,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "WorkDriveConnectionStatus" NOT NULL DEFAULT 'CONNECTED',
    "lastCheckedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "connectedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkDriveConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "workdriveFileId" TEXT NOT NULL,
    "folderId" TEXT,
    "name" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" BIGINT NOT NULL,
    "sha256" TEXT,
    "status" "MediaAssetStatus" NOT NULL DEFAULT 'READY',
    "source" TEXT NOT NULL DEFAULT 'upload',
    "lastCheckedAt" TIMESTAMP(3),
    "missingSince" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkDriveConnection_tenantId_key" ON "WorkDriveConnection"("tenantId");

-- CreateIndex
CREATE INDEX "MediaAsset_tenantId_brandId_kind_createdAt_idx" ON "MediaAsset"("tenantId", "brandId", "kind", "createdAt");

-- CreateIndex
CREATE INDEX "MediaAsset_status_lastCheckedAt_idx" ON "MediaAsset"("status", "lastCheckedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MediaAsset_tenantId_brandId_workdriveFileId_key" ON "MediaAsset"("tenantId", "brandId", "workdriveFileId");
