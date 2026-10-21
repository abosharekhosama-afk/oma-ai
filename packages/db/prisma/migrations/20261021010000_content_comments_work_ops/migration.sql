-- Content comments + work ops foundation

CREATE TABLE IF NOT EXISTS "ContentComment" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "contentId" TEXT NOT NULL,
  "authorUserId" TEXT NOT NULL,
  "bodyEn" TEXT NOT NULL,
  "bodyAr" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ContentComment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ContentComment_contentId_createdAt_idx" ON "ContentComment"("contentId", "createdAt");
CREATE INDEX IF NOT EXISTS "ContentComment_tenantId_contentId_idx" ON "ContentComment"("tenantId", "contentId");

DO $$ BEGIN
  ALTER TABLE "ContentComment" ADD CONSTRAINT "ContentComment_contentId_fkey"
    FOREIGN KEY ("contentId") REFERENCES "ContentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TYPE "WorkRequestStatus" AS ENUM ('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED');
CREATE TYPE "WorkRequestPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
CREATE TYPE "WorkRequestType" AS ENUM ('CONTENT', 'DESIGN', 'REVIEW', 'OTHER');
CREATE TYPE "WorkTaskStatus" AS ENUM ('BACKLOG', 'TODO', 'IN_PROGRESS', 'BLOCKED', 'IN_REVIEW', 'DONE', 'CANCELLED');
CREATE TYPE "WorkDeliverableStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'DELIVERED', 'ARCHIVED');

CREATE TABLE IF NOT EXISTS "WorkRequest" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "campaignId" TEXT,
  "contentId" TEXT,
  "titleEn" TEXT NOT NULL,
  "titleAr" TEXT NOT NULL,
  "descriptionEn" TEXT NOT NULL DEFAULT '',
  "descriptionAr" TEXT NOT NULL DEFAULT '',
  "type" "WorkRequestType" NOT NULL DEFAULT 'CONTENT',
  "priority" "WorkRequestPriority" NOT NULL DEFAULT 'MEDIUM',
  "status" "WorkRequestStatus" NOT NULL DEFAULT 'OPEN',
  "dueAt" TIMESTAMP(3),
  "requesterUserId" TEXT NOT NULL,
  "assigneeUserId" TEXT,
  "channels" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "formats" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "WorkRequest_tenantId_brandId_idx" ON "WorkRequest"("tenantId", "brandId");
CREATE INDEX IF NOT EXISTS "WorkRequest_brandId_status_idx" ON "WorkRequest"("brandId", "status");

CREATE TABLE IF NOT EXISTS "WorkTask" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "campaignId" TEXT,
  "requestId" TEXT,
  "contentId" TEXT,
  "titleEn" TEXT NOT NULL,
  "titleAr" TEXT NOT NULL,
  "descriptionEn" TEXT NOT NULL DEFAULT '',
  "descriptionAr" TEXT NOT NULL DEFAULT '',
  "status" "WorkTaskStatus" NOT NULL DEFAULT 'TODO',
  "assigneeUserId" TEXT,
  "dueAt" TIMESTAMP(3),
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkTask_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "WorkTask_tenantId_brandId_idx" ON "WorkTask"("tenantId", "brandId");
CREATE INDEX IF NOT EXISTS "WorkTask_requestId_idx" ON "WorkTask"("requestId");
DO $$ BEGIN
  ALTER TABLE "WorkTask" ADD CONSTRAINT "WorkTask_requestId_fkey"
    FOREIGN KEY ("requestId") REFERENCES "WorkRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "WorkDeliverable" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "campaignId" TEXT,
  "requestId" TEXT,
  "taskId" TEXT,
  "contentId" TEXT,
  "titleEn" TEXT NOT NULL,
  "titleAr" TEXT NOT NULL,
  "status" "WorkDeliverableStatus" NOT NULL DEFAULT 'DRAFT',
  "reviewStatus" TEXT NOT NULL DEFAULT 'NOT_STARTED',
  "assetUrl" TEXT,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkDeliverable_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "WorkDeliverable_tenantId_brandId_idx" ON "WorkDeliverable"("tenantId", "brandId");
DO $$ BEGIN
  ALTER TABLE "WorkDeliverable" ADD CONSTRAINT "WorkDeliverable_requestId_fkey"
    FOREIGN KEY ("requestId") REFERENCES "WorkRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "WorkDeliverable" ADD CONSTRAINT "WorkDeliverable_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "WorkTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
