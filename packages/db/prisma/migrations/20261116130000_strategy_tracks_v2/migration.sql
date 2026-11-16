-- Strategy tracks v2 (DEC-021): organic pillars / SEO keywords / content gaps,
-- paid allocations / audiences / experiments. Additive only.

CREATE TYPE "StrategySearchIntent" AS ENUM ('INFORMATIONAL', 'NAVIGATIONAL', 'COMMERCIAL', 'TRANSACTIONAL');

CREATE TYPE "StrategyDataSource" AS ENUM ('MANUAL', 'AI_ESTIMATE', 'DETERMINISTIC', 'BRAND_PROFILE', 'EXTERNAL');

CREATE TYPE "StrategyContentGapKind" AS ENUM ('MISSING_TOPIC', 'THIN_CONTENT', 'MISSING_FORMAT', 'FUNNEL_STAGE', 'COMPETITOR_ONLY');

CREATE TYPE "StrategyFunnelStage" AS ENUM ('AWARENESS', 'CONSIDERATION', 'CONVERSION', 'RETENTION');

CREATE TYPE "StrategyPaidPlatform" AS ENUM ('META', 'INSTAGRAM', 'FACEBOOK', 'TIKTOK', 'SNAPCHAT', 'X', 'LINKEDIN', 'YOUTUBE', 'GOOGLE_SEARCH');

CREATE TYPE "StrategyPaidObjective" AS ENUM ('AWARENESS', 'TRAFFIC', 'ENGAGEMENT', 'LEADS', 'APP_PROMOTION', 'SALES');

CREATE TYPE "StrategyExperimentVariable" AS ENUM ('CREATIVE', 'COPY', 'AUDIENCE', 'PLACEMENT', 'OFFER', 'LANDING_PAGE');

CREATE TYPE "StrategyExperimentStatus" AS ENUM ('PLANNED', 'RUNNING', 'CONCLUDED', 'CANCELLED');

CREATE TABLE "StrategyContentPillar" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "strategyVersionId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "description" TEXT,
    "funnelStage" "StrategyFunnelStage",
    "shareTargetPct" INTEGER,
    "infoClass" "StrategyInfoClass" NOT NULL DEFAULT 'USER_AUTHORED',
    "source" "StrategyDataSource" NOT NULL DEFAULT 'MANUAL',
    "evidenceRefs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "aiRunId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StrategyContentPillar_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StrategySeoKeyword" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "strategyVersionId" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'ar',
    "intent" "StrategySearchIntent" NOT NULL,
    "pillarKey" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 3,
    "monthlyVolume" INTEGER,
    "difficulty" INTEGER,
    "metricSource" "StrategyDataSource",
    "infoClass" "StrategyInfoClass" NOT NULL DEFAULT 'USER_AUTHORED',
    "source" "StrategyDataSource" NOT NULL DEFAULT 'MANUAL',
    "evidenceRefs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "aiRunId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StrategySeoKeyword_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StrategyContentGap" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "strategyVersionId" TEXT NOT NULL,
    "kind" "StrategyContentGapKind" NOT NULL,
    "topic" TEXT NOT NULL,
    "description" TEXT,
    "pillarKey" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 3,
    "infoClass" "StrategyInfoClass" NOT NULL DEFAULT 'USER_AUTHORED',
    "source" "StrategyDataSource" NOT NULL DEFAULT 'MANUAL',
    "evidenceRefs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "aiRunId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StrategyContentGap_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StrategyPaidAllocation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "strategyVersionId" TEXT NOT NULL,
    "platform" "StrategyPaidPlatform" NOT NULL,
    "objective" "StrategyPaidObjective" NOT NULL,
    "sharePct" INTEGER NOT NULL,
    "funnelStage" "StrategyFunnelStage",
    "rationale" TEXT,
    "infoClass" "StrategyInfoClass" NOT NULL DEFAULT 'USER_AUTHORED',
    "source" "StrategyDataSource" NOT NULL DEFAULT 'MANUAL',
    "evidenceRefs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "aiRunId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StrategyPaidAllocation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StrategyPaidAudience" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "strategyVersionId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "platform" "StrategyPaidPlatform",
    "funnelStage" "StrategyFunnelStage",
    "targetingJson" TEXT NOT NULL DEFAULT '{}',
    "infoClass" "StrategyInfoClass" NOT NULL DEFAULT 'USER_AUTHORED',
    "source" "StrategyDataSource" NOT NULL DEFAULT 'MANUAL',
    "evidenceRefs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "aiRunId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StrategyPaidAudience_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StrategyExperiment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "strategyVersionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hypothesis" TEXT NOT NULL,
    "variable" "StrategyExperimentVariable" NOT NULL,
    "platform" "StrategyPaidPlatform",
    "audienceKey" TEXT,
    "variantsJson" TEXT NOT NULL DEFAULT '[]',
    "primaryMetric" TEXT NOT NULL,
    "minSampleSize" INTEGER,
    "durationDays" INTEGER,
    "status" "StrategyExperimentStatus" NOT NULL DEFAULT 'PLANNED',
    "infoClass" "StrategyInfoClass" NOT NULL DEFAULT 'USER_AUTHORED',
    "source" "StrategyDataSource" NOT NULL DEFAULT 'MANUAL',
    "evidenceRefs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "aiRunId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StrategyExperiment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StrategyContentPillar_tenantId_strategyVersionId_idx" ON "StrategyContentPillar"("tenantId", "strategyVersionId");

CREATE UNIQUE INDEX "StrategyContentPillar_strategyVersionId_key_key" ON "StrategyContentPillar"("strategyVersionId", "key");

CREATE INDEX "StrategySeoKeyword_tenantId_strategyVersionId_idx" ON "StrategySeoKeyword"("tenantId", "strategyVersionId");

CREATE INDEX "StrategyContentGap_tenantId_strategyVersionId_idx" ON "StrategyContentGap"("tenantId", "strategyVersionId");

CREATE INDEX "StrategyPaidAllocation_tenantId_strategyVersionId_idx" ON "StrategyPaidAllocation"("tenantId", "strategyVersionId");

CREATE UNIQUE INDEX "StrategyPaidAllocation_strategyVersionId_platform_objective_key" ON "StrategyPaidAllocation"("strategyVersionId", "platform", "objective");

CREATE INDEX "StrategyPaidAudience_tenantId_strategyVersionId_idx" ON "StrategyPaidAudience"("tenantId", "strategyVersionId");

CREATE UNIQUE INDEX "StrategyPaidAudience_strategyVersionId_key_key" ON "StrategyPaidAudience"("strategyVersionId", "key");

CREATE INDEX "StrategyExperiment_tenantId_strategyVersionId_idx" ON "StrategyExperiment"("tenantId", "strategyVersionId");

ALTER TABLE "StrategyContentPillar" ADD CONSTRAINT "StrategyContentPillar_strategyVersionId_fkey" FOREIGN KEY ("strategyVersionId") REFERENCES "StrategyVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StrategySeoKeyword" ADD CONSTRAINT "StrategySeoKeyword_strategyVersionId_fkey" FOREIGN KEY ("strategyVersionId") REFERENCES "StrategyVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StrategyContentGap" ADD CONSTRAINT "StrategyContentGap_strategyVersionId_fkey" FOREIGN KEY ("strategyVersionId") REFERENCES "StrategyVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StrategyPaidAllocation" ADD CONSTRAINT "StrategyPaidAllocation_strategyVersionId_fkey" FOREIGN KEY ("strategyVersionId") REFERENCES "StrategyVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StrategyPaidAudience" ADD CONSTRAINT "StrategyPaidAudience_strategyVersionId_fkey" FOREIGN KEY ("strategyVersionId") REFERENCES "StrategyVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StrategyExperiment" ADD CONSTRAINT "StrategyExperiment_strategyVersionId_fkey" FOREIGN KEY ("strategyVersionId") REFERENCES "StrategyVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
