-- DEC-029 PR 4.4: content items carry their strategy context.
ALTER TABLE "ContentItem" ADD COLUMN "strategyVersionId" TEXT;
ALTER TABLE "ContentItem" ADD COLUMN "pillarKey" TEXT;
ALTER TABLE "ContentItem" ADD COLUMN "targetKeyword" TEXT;

CREATE INDEX "ContentItem_tenantId_strategyVersionId_pillarKey_idx"
  ON "ContentItem"("tenantId", "strategyVersionId", "pillarKey");

-- Backfill: anchor content of strategy plan requests.
UPDATE "ContentItem" c
SET "strategyVersionId" = r."strategyVersionId"
FROM "WorkRequest" r
WHERE r."contentId" = c."id"
  AND r."strategyVersionId" IS NOT NULL
  AND c."strategyVersionId" IS NULL;

-- Backfill: slot / plan content labelled with its version (PR 4.3+).
UPDATE "ContentItem" c
SET "strategyVersionId" = (
  SELECT substring(l FROM 'strategy-version:(.+)$')
  FROM unnest(c."labels") AS l
  WHERE l LIKE 'strategy-version:%'
  LIMIT 1
)
WHERE c."strategyVersionId" IS NULL
  AND EXISTS (SELECT 1 FROM unnest(c."labels") AS l WHERE l LIKE 'strategy-version:%');

-- Backfill pillar keys from slug-style plan source labels (legacy numeric keys are skipped).
UPDATE "ContentItem" c
SET "pillarKey" = (
  SELECT substring(l FROM '^organic:pillar:([a-z][a-z0-9-]*)$')
  FROM unnest(c."labels") AS l
  WHERE l ~ '^organic:pillar:[a-z][a-z0-9-]*$'
  LIMIT 1
)
WHERE c."pillarKey" IS NULL
  AND EXISTS (SELECT 1 FROM unnest(c."labels") AS l WHERE l ~ '^organic:pillar:[a-z][a-z0-9-]*$');
