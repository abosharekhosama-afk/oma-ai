-- Store user profile images as tenant WorkDrive assets.
ALTER TABLE "User" ADD COLUMN "avatarAssetId" TEXT;
ALTER TABLE "MediaAsset" ALTER COLUMN "brandId" DROP NOT NULL;
DROP INDEX IF EXISTS "MediaAsset_tenantId_brandId_workdriveFileId_key";
CREATE UNIQUE INDEX "MediaAsset_tenantId_brandId_workdriveFileId_key"
  ON "MediaAsset"("tenantId", "brandId", "workdriveFileId");
