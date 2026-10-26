-- Analytics hardening: tenant-scoped date windows and channel split (see scripts/bench/analytics-bench.ts).
CREATE INDEX IF NOT EXISTS "ContentItem_tenantId_scheduledAt_idx" ON "ContentItem"("tenantId", "scheduledAt");
CREATE INDEX IF NOT EXISTS "ContentItem_tenantId_plannedAt_idx" ON "ContentItem"("tenantId", "plannedAt");
CREATE INDEX IF NOT EXISTS "ContentItem_tenantId_createdAt_idx" ON "ContentItem"("tenantId", "createdAt");
CREATE INDEX IF NOT EXISTS "ContentItem_tenantId_channel_idx" ON "ContentItem"("tenantId", "channel");
CREATE INDEX IF NOT EXISTS "ContentApprovalEvent_tenantId_at_idx" ON "ContentApprovalEvent"("tenantId", "at");
CREATE INDEX IF NOT EXISTS "ContentComment_tenantId_createdAt_idx" ON "ContentComment"("tenantId", "createdAt");
