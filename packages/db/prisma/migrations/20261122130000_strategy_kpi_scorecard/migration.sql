-- DEC-029 PR 4.5: KPIs bound to measurable metrics or recorded manually.
ALTER TABLE "StrategyKpi"
  ADD COLUMN "metric" TEXT,
  ADD COLUMN "targetNumber" DOUBLE PRECISION,
  ADD COLUMN "period" TEXT NOT NULL DEFAULT 'MONTH',
  ADD COLUMN "scope" TEXT NOT NULL DEFAULT 'STRATEGY_CONTENT',
  ADD COLUMN "pillarKey" TEXT,
  ADD COLUMN "channel" TEXT,
  ADD COLUMN "manualValue" DOUBLE PRECISION,
  ADD COLUMN "manualValueAt" TIMESTAMP(3),
  ADD COLUMN "manualNote" TEXT,
  ADD COLUMN "manualBy" TEXT;

-- Numeric legacy targets ("1,200", "4.5%") become targetNumber; text stays in targetValue.
UPDATE "StrategyKpi"
SET "targetNumber" = (regexp_match(replace("targetValue", ',', ''), '(-?\d+(?:\.\d+)?)'))[1]::double precision
WHERE "targetNumber" IS NULL AND "targetValue" ~ '\d';
