CREATE TYPE "CatalogMediaRole" AS ENUM (
  'SCAN_THUMBNAIL',
  'SCAN_IMAGE',
  'SCAN_VIDEO',
  'GENERATED_IMAGE',
  'GENERATED_VIDEO',
  'GENERATED_SHORT_VIDEO'
);

CREATE TABLE "CatalogProductMedia" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "discoveredProductId" TEXT NOT NULL,
  "mediaAssetId" TEXT NOT NULL,
  "role" "CatalogMediaRole" NOT NULL,
  "sourceUrl" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CatalogProductMedia_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CatalogProductMedia_discoveredProductId_mediaAssetId_role_key" ON "CatalogProductMedia"("discoveredProductId", "mediaAssetId", "role");
CREATE INDEX "CatalogProductMedia_tenantId_brandId_discoveredProductId_idx" ON "CatalogProductMedia"("tenantId", "brandId", "discoveredProductId");
CREATE INDEX "CatalogProductMedia_tenantId_mediaAssetId_idx" ON "CatalogProductMedia"("tenantId", "mediaAssetId");

ALTER TABLE "CatalogProductMedia" ADD CONSTRAINT "CatalogProductMedia_discoveredProductId_fkey" FOREIGN KEY ("discoveredProductId") REFERENCES "DiscoveredProductService"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CatalogProductMedia" ADD CONSTRAINT "CatalogProductMedia_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;