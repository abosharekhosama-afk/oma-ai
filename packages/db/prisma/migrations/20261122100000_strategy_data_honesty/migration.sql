-- DEC-029 4.0: sample data is labelled FIXTURE; Search Console performance is stored apart from market volume.
ALTER TYPE "StrategyDataSource" ADD VALUE IF NOT EXISTS 'FIXTURE';

ALTER TABLE "StrategySeoKeyword" ADD COLUMN "gscImpressions" INTEGER,
ADD COLUMN "gscClicks" INTEGER,
ADD COLUMN "gscPosition" DOUBLE PRECISION;
