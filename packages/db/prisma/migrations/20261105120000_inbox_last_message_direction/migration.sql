ALTER TABLE "InboxConversation" ADD COLUMN IF NOT EXISTS "lastMessageDirection" "InboxMessageDirection";

CREATE INDEX IF NOT EXISTS "InboxConversation_tenantId_lastMessageDirection_idx"
  ON "InboxConversation"("tenantId", "lastMessageDirection");
