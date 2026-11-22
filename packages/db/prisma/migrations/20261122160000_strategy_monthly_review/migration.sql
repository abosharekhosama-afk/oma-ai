-- DEC-029 PR 4.10: AI monthly strategy review → new draft version.
CREATE TABLE "StrategyMonthlyReview" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "strategyId" TEXT NOT NULL,
  "sourceVersionId" TEXT NOT NULL,
  "month" TEXT NOT NULL,
  "findingsJson" TEXT NOT NULL,
  "draftVersionId" TEXT,
  "aiRunId" TEXT,
  "status" TEXT NOT NULL,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StrategyMonthlyReview_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StrategyMonthlyReview_sourceVersionId_month_key" ON "StrategyMonthlyReview"("sourceVersionId", "month");
CREATE INDEX "StrategyMonthlyReview_tenantId_brandId_strategyId_createdAt_idx" ON "StrategyMonthlyReview"("tenantId", "brandId", "strategyId", "createdAt");
