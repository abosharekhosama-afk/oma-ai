-- Inbox operational fields for desk workflow
ALTER TABLE "InboxConversation" ADD COLUMN IF NOT EXISTS "priority" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "InboxConversation" ADD COLUMN IF NOT EXISTS "tagsJson" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "InboxConversation" ADD COLUMN IF NOT EXISTS "socialPageId" TEXT;
ALTER TABLE "InboxConversation" ADD COLUMN IF NOT EXISTS "firstResponseAt" TIMESTAMP(3);
ALTER TABLE "InboxConversation" ADD COLUMN IF NOT EXISTS "closedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "InboxConversation_tenantId_priority_lastMessageAt_idx"
  ON "InboxConversation"("tenantId", "priority", "lastMessageAt");
