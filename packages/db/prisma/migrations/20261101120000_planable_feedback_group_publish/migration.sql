-- Planable parity: group actions, preferred audience, richer comments
ALTER TABLE "ContentItem" ADD COLUMN IF NOT EXISTS "syncGroupId" TEXT;
ALTER TABLE "ContentItem" ADD COLUMN IF NOT EXISTS "preferredAudience" TEXT;
CREATE INDEX IF NOT EXISTS "ContentItem_tenantId_syncGroupId_idx" ON "ContentItem"("tenantId", "syncGroupId");

ALTER TABLE "ContentComment" ADD COLUMN IF NOT EXISTS "isInternal" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ContentComment" ADD COLUMN IF NOT EXISTS "parentId" TEXT;
ALTER TABLE "ContentComment" ADD COLUMN IF NOT EXISTS "resolvedAt" TIMESTAMP(3);
ALTER TABLE "ContentComment" ADD COLUMN IF NOT EXISTS "reactionsJson" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "ContentComment" ADD COLUMN IF NOT EXISTS "attachmentMediaIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
CREATE INDEX IF NOT EXISTS "ContentComment_parentId_idx" ON "ContentComment"("parentId");
