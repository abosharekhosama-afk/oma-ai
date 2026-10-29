-- Add ordered media references while preserving previewAssetId as the first-item compatibility field.
ALTER TABLE "ContentItem"
ADD COLUMN "mediaAssetIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Backfill existing single-media posts into the ordered list.
UPDATE "ContentItem"
SET "mediaAssetIds" = ARRAY["previewAssetId"]
WHERE "previewAssetId" IS NOT NULL;
