-- Unified Inbox & Social Listening

CREATE TYPE "InboxPlatform" AS ENUM ('META_FB', 'META_IG', 'TIKTOK', 'LINKEDIN');
CREATE TYPE "InboxConversationType" AS ENUM ('DIRECT_MESSAGE', 'POST_COMMENT', 'DARK_COMMENT', 'MENTION');
CREATE TYPE "InboxConversationStatus" AS ENUM ('UNREAD', 'OPEN', 'PENDING', 'CLOSED');
CREATE TYPE "InboxSentiment" AS ENUM ('POSITIVE', 'NEUTRAL', 'NEGATIVE');
CREATE TYPE "InboxMessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');

CREATE TABLE "InboxConversation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "brandId" TEXT,
    "platform" "InboxPlatform" NOT NULL,
    "externalThreadId" TEXT NOT NULL,
    "type" "InboxConversationType" NOT NULL,
    "status" "InboxConversationStatus" NOT NULL DEFAULT 'UNREAD',
    "assignedToUserId" TEXT,
    "sentiment" "InboxSentiment",
    "subject" TEXT,
    "participantName" TEXT,
    "participantAvatar" TEXT,
    "participantExtId" TEXT,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastMessagePreview" TEXT,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "unreadCount" INTEGER NOT NULL DEFAULT 0,
    "metadataJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InboxConversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InboxMessage" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "externalMessageId" TEXT,
    "senderExternalId" TEXT NOT NULL,
    "senderName" TEXT NOT NULL,
    "senderAvatar" TEXT,
    "content" TEXT NOT NULL,
    "mediaUrlsJson" TEXT,
    "direction" "InboxMessageDirection" NOT NULL,
    "rawPayloadJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InboxMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InboxInternalNote" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InboxInternalNote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ListeningRule" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "brandId" TEXT,
    "name" TEXT NOT NULL,
    "keywordsJson" TEXT NOT NULL DEFAULT '[]',
    "hashtagsJson" TEXT NOT NULL DEFAULT '[]',
    "platformsJson" TEXT NOT NULL DEFAULT '[]',
    "isLive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ListeningRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ListeningHit" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ruleId" TEXT,
    "platform" "InboxPlatform" NOT NULL,
    "externalPostId" TEXT NOT NULL,
    "authorName" TEXT,
    "authorHandle" TEXT,
    "authorAvatar" TEXT,
    "content" TEXT NOT NULL,
    "url" TEXT,
    "mediaUrlsJson" TEXT,
    "sentiment" "InboxSentiment",
    "isHighPriority" BOOLEAN NOT NULL DEFAULT false,
    "matchedKeywordsJson" TEXT NOT NULL DEFAULT '[]',
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListeningHit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InboxConversation_tenantId_platform_externalThreadId_key" ON "InboxConversation"("tenantId", "platform", "externalThreadId");
CREATE INDEX "InboxConversation_tenantId_status_lastMessageAt_idx" ON "InboxConversation"("tenantId", "status", "lastMessageAt");
CREATE INDEX "InboxConversation_tenantId_platform_status_idx" ON "InboxConversation"("tenantId", "platform", "status");
CREATE INDEX "InboxConversation_tenantId_assignedToUserId_idx" ON "InboxConversation"("tenantId", "assignedToUserId");
CREATE INDEX "InboxConversation_tenantId_sentiment_idx" ON "InboxConversation"("tenantId", "sentiment");
CREATE INDEX "InboxConversation_tenantId_type_idx" ON "InboxConversation"("tenantId", "type");
CREATE INDEX "InboxConversation_brandId_idx" ON "InboxConversation"("brandId");

CREATE UNIQUE INDEX "InboxMessage_conversationId_externalMessageId_key" ON "InboxMessage"("conversationId", "externalMessageId");
CREATE INDEX "InboxMessage_tenantId_conversationId_createdAt_idx" ON "InboxMessage"("tenantId", "conversationId", "createdAt");
CREATE INDEX "InboxMessage_conversationId_createdAt_idx" ON "InboxMessage"("conversationId", "createdAt");

CREATE INDEX "InboxInternalNote_conversationId_createdAt_idx" ON "InboxInternalNote"("conversationId", "createdAt");
CREATE INDEX "InboxInternalNote_tenantId_conversationId_idx" ON "InboxInternalNote"("tenantId", "conversationId");

CREATE INDEX "ListeningRule_tenantId_isLive_idx" ON "ListeningRule"("tenantId", "isLive");
CREATE INDEX "ListeningRule_workspaceId_isLive_idx" ON "ListeningRule"("workspaceId", "isLive");

CREATE UNIQUE INDEX "ListeningHit_tenantId_platform_externalPostId_key" ON "ListeningHit"("tenantId", "platform", "externalPostId");
CREATE INDEX "ListeningHit_tenantId_capturedAt_idx" ON "ListeningHit"("tenantId", "capturedAt");
CREATE INDEX "ListeningHit_tenantId_ruleId_capturedAt_idx" ON "ListeningHit"("tenantId", "ruleId", "capturedAt");
CREATE INDEX "ListeningHit_tenantId_isHighPriority_capturedAt_idx" ON "ListeningHit"("tenantId", "isHighPriority", "capturedAt");
CREATE INDEX "ListeningHit_tenantId_sentiment_idx" ON "ListeningHit"("tenantId", "sentiment");

ALTER TABLE "InboxConversation" ADD CONSTRAINT "InboxConversation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InboxMessage" ADD CONSTRAINT "InboxMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "InboxConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InboxInternalNote" ADD CONSTRAINT "InboxInternalNote_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "InboxConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ListeningRule" ADD CONSTRAINT "ListeningRule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ListeningHit" ADD CONSTRAINT "ListeningHit_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ListeningHit" ADD CONSTRAINT "ListeningHit_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "ListeningRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
