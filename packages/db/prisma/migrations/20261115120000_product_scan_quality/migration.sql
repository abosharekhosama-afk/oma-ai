-- Listing / category pages are classified separately from single-product pages.
ALTER TYPE "PageClassification" ADD VALUE IF NOT EXISTS 'COLLECTION';

-- Product extraction provenance and richer commerce fields.
ALTER TABLE "DiscoveredProductService" ADD COLUMN "sourceUrl" TEXT;
ALTER TABLE "DiscoveredProductService" ADD COLUMN "compareAtPrice" TEXT;
ALTER TABLE "DiscoveredProductService" ADD COLUMN "platformId" TEXT;
ALTER TABLE "DiscoveredProductService" ADD COLUMN "variantCount" INTEGER;
ALTER TABLE "DiscoveredProductService" ADD COLUMN "attributesJson" TEXT;
ALTER TABLE "DiscoveredProductService" ADD COLUMN "extractionSource" TEXT;
ALTER TABLE "DiscoveredProductService" ADD COLUMN "confidence" DOUBLE PRECISION;
