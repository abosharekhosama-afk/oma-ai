-- Strategy plan → work request provenance (US-003 slice)
ALTER TABLE "WorkRequest" ADD COLUMN "strategyId" TEXT;
ALTER TABLE "WorkRequest" ADD COLUMN "strategyVersionId" TEXT;
ALTER TABLE "WorkRequest" ADD COLUMN "planSourceKey" TEXT;

CREATE INDEX "WorkRequest_strategyVersionId_idx" ON "WorkRequest"("strategyVersionId");

CREATE UNIQUE INDEX "WorkRequest_tenant_strategy_plan_source_key"
  ON "WorkRequest"("tenantId", "strategyVersionId", "planSourceKey")
  WHERE "strategyVersionId" IS NOT NULL AND "planSourceKey" IS NOT NULL;
