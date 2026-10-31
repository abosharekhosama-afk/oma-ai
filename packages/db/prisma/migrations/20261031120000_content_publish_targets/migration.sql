-- CreateEnum
CREATE TYPE "ContentPublishRollupState" AS ENUM ('NONE', 'IN_PROGRESS', 'ALL_SUCCEEDED', 'PARTIAL', 'FAILED');

-- CreateTable
CREATE TABLE "ContentPublishTarget" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contentItemId" TEXT NOT NULL,
    "socialPageId" TEXT NOT NULL,
    "publishState" "ContentPublishState" NOT NULL DEFAULT 'NONE',
    "publishAttempts" INTEGER NOT NULL DEFAULT 0,
    "nextPublishAt" TIMESTAMP(3),
    "lastPublishError" TEXT,
    "workerPickedAt" TIMESTAMP(3),
    "externalPostId" TEXT,
    "externalPostUrl" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentPublishTarget_pkey" PRIMARY KEY ("id")
);

-- Migrate ContentItem.publishState to rollup enum
ALTER TABLE "ContentItem" ALTER COLUMN "publishState" DROP DEFAULT;
ALTER TABLE "ContentItem"
  ALTER COLUMN "publishState" TYPE "ContentPublishRollupState"
  USING (
    CASE "publishState"::text
      WHEN 'NONE' THEN 'NONE'::"ContentPublishRollupState"
      WHEN 'QUEUED' THEN 'IN_PROGRESS'::"ContentPublishRollupState"
      WHEN 'PUBLISHING' THEN 'IN_PROGRESS'::"ContentPublishRollupState"
      WHEN 'PUBLISHED' THEN 'ALL_SUCCEEDED'::"ContentPublishRollupState"
      WHEN 'FAILED' THEN 'FAILED'::"ContentPublishRollupState"
      ELSE 'NONE'::"ContentPublishRollupState"
    END
  );
ALTER TABLE "ContentItem" ALTER COLUMN "publishState" SET DEFAULT 'NONE';

-- Backfill targets from legacy single socialPageId
INSERT INTO "ContentPublishTarget" (
  "id",
  "tenantId",
  "contentItemId",
  "socialPageId",
  "publishState",
  "publishAttempts",
  "nextPublishAt",
  "lastPublishError",
  "workerPickedAt",
  "externalPostId",
  "externalPostUrl",
  "publishedAt",
  "createdAt",
  "updatedAt"
)
SELECT
  "id" || '-tgt-' || substr(md5("socialPageId"), 1, 12),
  "tenantId",
  "id",
  "socialPageId",
  CASE "publishState"::text
    WHEN 'ALL_SUCCEEDED' THEN 'PUBLISHED'::"ContentPublishState"
    WHEN 'IN_PROGRESS' THEN 'QUEUED'::"ContentPublishState"
    WHEN 'PARTIAL' THEN 'QUEUED'::"ContentPublishState"
    WHEN 'FAILED' THEN 'FAILED'::"ContentPublishState"
    ELSE 'NONE'::"ContentPublishState"
  END,
  "publishAttempts",
  "nextPublishAt",
  "lastPublishError",
  "workerPickedAt",
  "externalPostId",
  "externalPostUrl",
  "publishedAt",
  "createdAt",
  "updatedAt"
FROM "ContentItem"
WHERE "socialPageId" IS NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "ContentPublishTarget_contentItemId_socialPageId_key" ON "ContentPublishTarget"("contentItemId", "socialPageId");
CREATE INDEX "ContentPublishTarget_tenantId_contentItemId_idx" ON "ContentPublishTarget"("tenantId", "contentItemId");
CREATE INDEX "ContentPublishTarget_publishState_nextPublishAt_idx" ON "ContentPublishTarget"("publishState", "nextPublishAt");
CREATE INDEX "ContentPublishTarget_socialPageId_idx" ON "ContentPublishTarget"("socialPageId");

-- AddForeignKey
ALTER TABLE "ContentPublishTarget" ADD CONSTRAINT "ContentPublishTarget_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContentPublishTarget" ADD CONSTRAINT "ContentPublishTarget_socialPageId_fkey" FOREIGN KEY ("socialPageId") REFERENCES "SocialPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
