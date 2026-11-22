-- DEC-029 PR 4.7: paid flights, experiment results, manual/CSV spend.
CREATE TABLE "StrategyPaidFlight" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "strategyVersionId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "platform" "StrategyPaidPlatform" NOT NULL,
  "objective" "StrategyPaidObjective",
  "audienceKey" TEXT,
  "startDate" DATE NOT NULL,
  "endDate" DATE NOT NULL,
  "budgetAmount" DECIMAL(18,2),
  "currency" TEXT,
  "notes" TEXT,
  "campaignId" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StrategyPaidFlight_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StrategyPaidFlight_strategyVersionId_key_key" ON "StrategyPaidFlight"("strategyVersionId", "key");
CREATE INDEX "StrategyPaidFlight_tenantId_brandId_idx" ON "StrategyPaidFlight"("tenantId", "brandId");
ALTER TABLE "StrategyPaidFlight" ADD CONSTRAINT "StrategyPaidFlight_strategyVersionId_fkey"
  FOREIGN KEY ("strategyVersionId") REFERENCES "StrategyVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PaidSpendEntry" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "strategyVersionId" TEXT,
  "flightKey" TEXT NOT NULL DEFAULT '',
  "platform" "StrategyPaidPlatform" NOT NULL,
  "spendDate" DATE NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "currency" TEXT NOT NULL,
  "impressions" INTEGER,
  "clicks" INTEGER,
  "conversions" INTEGER,
  "source" TEXT NOT NULL DEFAULT 'MANUAL',
  "importBatchId" TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PaidSpendEntry_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PaidSpendEntry_tenantId_brandId_platform_spendDate_flightKe_key"
  ON "PaidSpendEntry"("tenantId", "brandId", "platform", "spendDate", "flightKey", "source");
CREATE INDEX "PaidSpendEntry_tenantId_brandId_spendDate_idx" ON "PaidSpendEntry"("tenantId", "brandId", "spendDate");

ALTER TABLE "StrategyExperiment"
  ADD COLUMN "resultSummary" TEXT,
  ADD COLUMN "winnerVariantKey" TEXT,
  ADD COLUMN "resultsJson" TEXT,
  ADD COLUMN "startedAt" TIMESTAMP(3),
  ADD COLUMN "endedAt" TIMESTAMP(3),
  ADD COLUMN "statusUpdatedAt" TIMESTAMP(3),
  ADD COLUMN "statusUpdatedBy" TEXT;
