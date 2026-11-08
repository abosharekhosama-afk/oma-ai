-- Parent/reply relation for inbox comments and messages.
ALTER TABLE "InboxMessage" ADD COLUMN "parentMessageId" TEXT;

CREATE INDEX "InboxMessage_parentMessageId_idx" ON "InboxMessage"("parentMessageId");

ALTER TABLE "InboxMessage" ADD CONSTRAINT "InboxMessage_parentMessageId_fkey" FOREIGN KEY ("parentMessageId") REFERENCES "InboxMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
