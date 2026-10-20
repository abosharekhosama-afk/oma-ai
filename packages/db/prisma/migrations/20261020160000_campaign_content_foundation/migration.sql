-- Campaign & Content foundation

CREATE TYPE "Track" AS ENUM ('ORGANIC', 'PAID');
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'UPCOMING', 'ACTIVE', 'IN_REVIEW', 'NEEDS_ATTENTION', 'COMPLETED', 'ARCHIVED');
CREATE TYPE "ContentType" AS ENUM ('POST', 'REEL', 'CAROUSEL', 'STATIC', 'STORY');
CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'SCHEDULED', 'PUBLISHED_SAMPLE');
CREATE TYPE "ContentApprovalState" AS ENUM ('NOT_REQUESTED', 'PENDING', 'PARTIALLY_APPROVED', 'APPROVED', 'CHANGES_REQUESTED', 'REJECTED');
CREATE TYPE "ContentScheduleState" AS ENUM ('UNSCHEDULED', 'SCHEDULED');
CREATE TYPE "ContentApprovalPolicy" AS ENUM ('NONE', 'OPTIONAL', 'REQUIRED');

CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "descriptionEn" TEXT,
    "descriptionAr" TEXT,
    "track" "Track" NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "timelineStart" DATE NOT NULL,
    "timelineEnd" DATE NOT NULL,
    "ownerUserId" TEXT,
    "links" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContentItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "campaignId" TEXT,
    "titleEn" TEXT NOT NULL,
    "titleAr" TEXT NOT NULL,
    "captionEn" TEXT,
    "captionAr" TEXT,
    "contentType" "ContentType" NOT NULL,
    "channel" TEXT NOT NULL,
    "track" "Track" NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "approvalState" "ContentApprovalState" NOT NULL DEFAULT 'NOT_REQUESTED',
    "scheduleState" "ContentScheduleState" NOT NULL DEFAULT 'UNSCHEDULED',
    "plannedAt" TIMESTAMP(3),
    "scheduledAt" TIMESTAMP(3),
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Dubai',
    "approverRequired" INTEGER NOT NULL DEFAULT 1,
    "approverApproved" INTEGER NOT NULL DEFAULT 0,
    "previewAssetUrl" TEXT,
    "labels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "assigneeUserId" TEXT,
    "clientVisible" BOOLEAN NOT NULL DEFAULT true,
    "archivedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContentApprovalEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "noteEn" TEXT,
    "noteAr" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentApprovalEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContentPreferences" (
    "brandId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "approvalPolicy" "ContentApprovalPolicy" NOT NULL DEFAULT 'OPTIONAL',
    "defaultTimezone" TEXT NOT NULL DEFAULT 'Asia/Dubai',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentPreferences_pkey" PRIMARY KEY ("brandId")
);

CREATE INDEX "Campaign_tenantId_brandId_idx" ON "Campaign"("tenantId", "brandId");
CREATE INDEX "Campaign_brandId_status_idx" ON "Campaign"("brandId", "status");
CREATE INDEX "Campaign_tenantId_status_idx" ON "Campaign"("tenantId", "status");

CREATE INDEX "ContentItem_tenantId_brandId_idx" ON "ContentItem"("tenantId", "brandId");
CREATE INDEX "ContentItem_brandId_campaignId_idx" ON "ContentItem"("brandId", "campaignId");
CREATE INDEX "ContentItem_brandId_status_idx" ON "ContentItem"("brandId", "status");
CREATE INDEX "ContentItem_scheduledAt_idx" ON "ContentItem"("scheduledAt");

CREATE INDEX "ContentApprovalEvent_contentId_at_idx" ON "ContentApprovalEvent"("contentId", "at");
CREATE INDEX "ContentApprovalEvent_tenantId_contentId_idx" ON "ContentApprovalEvent"("tenantId", "contentId");

ALTER TABLE "ContentItem" ADD CONSTRAINT "ContentItem_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ContentApprovalEvent" ADD CONSTRAINT "ContentApprovalEvent_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "ContentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
