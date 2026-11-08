-- Per-brand approval & publishing settings. Null inherits the workspace default.
ALTER TABLE "ContentPreferences" ADD COLUMN "approvalMode" TEXT;
ALTER TABLE "ContentPreferences" ADD COLUMN "requiredApprovers" INTEGER;
ALTER TABLE "ContentPreferences" ADD COLUMN "scheduleOnApproval" BOOLEAN;
ALTER TABLE "ContentPreferences" ADD COLUMN "lockAfterApproval" BOOLEAN;
ALTER TABLE "ContentPreferences" ADD COLUMN "reminderPendingApprovals" BOOLEAN;
