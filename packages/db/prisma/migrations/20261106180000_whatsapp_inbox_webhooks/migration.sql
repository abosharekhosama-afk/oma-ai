-- AlterEnum
ALTER TYPE "SocialNetwork" ADD VALUE IF NOT EXISTS 'WHATSAPP';

-- AlterEnum
ALTER TYPE "InboxPlatform" ADD VALUE IF NOT EXISTS 'X';
ALTER TYPE "InboxPlatform" ADD VALUE IF NOT EXISTS 'WHATSAPP';

-- AlterTable
ALTER TABLE "ContentPublishTarget" ADD COLUMN IF NOT EXISTS "insightsJson" TEXT;
ALTER TABLE "ContentPublishTarget" ADD COLUMN IF NOT EXISTS "lastInsightsAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SocialWebhookEvent" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "signatureOk" BOOLEAN NOT NULL DEFAULT false,
    "payloadJson" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SocialWebhookEvent_platform_eventId_key" ON "SocialWebhookEvent"("platform", "eventId");
CREATE INDEX IF NOT EXISTS "SocialWebhookEvent_createdAt_idx" ON "SocialWebhookEvent"("createdAt");
CREATE INDEX IF NOT EXISTS "SocialWebhookEvent_processedAt_idx" ON "SocialWebhookEvent"("processedAt");
