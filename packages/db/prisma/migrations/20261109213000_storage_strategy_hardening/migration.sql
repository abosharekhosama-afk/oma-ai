-- Per-tenant platform scoped keys and inbound webhook replay log.

ALTER TABLE "WorkspaceStorageSetting" ADD COLUMN "platformKeyEnc" TEXT;
ALTER TABLE "WorkspaceStorageSetting" ADD COLUMN "platformKeyPrefix" TEXT;
ALTER TABLE "WorkspaceStorageSetting" ADD COLUMN "platformKeyId" TEXT;
ALTER TABLE "WorkspaceStorageSetting" ADD COLUMN "platformRootFolderId" TEXT;
ALTER TABLE "WorkspaceStorageSetting" ADD COLUMN "platformKeyStatus" TEXT;

CREATE TABLE "WorkDriveWebhookEvent" (
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkDriveWebhookEvent_pkey" PRIMARY KEY ("eventId")
);

CREATE INDEX "WorkDriveWebhookEvent_receivedAt_idx" ON "WorkDriveWebhookEvent"("receivedAt");
