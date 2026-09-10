-- Feature 003 Strategy Organic/Paid Plans
-- Rollback: drop Strategy* tables (children first), drop Strategy* enums, DROP COLUMN BrandWorkspace.currentApprovedStrategyId

-- CreateEnum
CREATE TYPE "StrategyStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "StrategyVersionStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'REJECTED', 'SUPERSEDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "StrategyAiAvailability" AS ENUM ('NOT_CONFIGURED', 'UNAVAILABLE', 'REFUSED');

-- CreateEnum
CREATE TYPE "StrategyInfoClass" AS ENUM ('BRAND_LINKED', 'USER_AUTHORED', 'ASSUMPTION', 'UNKNOWN', 'RECOMMENDATION', 'AI_PROPOSAL');

-- CreateEnum
CREATE TYPE "StrategyKpiAppliesTo" AS ENUM ('STRATEGY', 'ORGANIC', 'PAID');

-- CreateEnum
CREATE TYPE "StrategyGapKind" AS ENUM ('RISK', 'ASSUMPTION', 'DEPENDENCY', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "StrategyReviewAction" AS ENUM ('SUBMIT', 'COMMENT', 'REQUEST_CHANGES', 'APPROVE_PACKAGE', 'REJECT', 'ARCHIVE');

-- AlterTable
ALTER TABLE "BrandWorkspace" ADD COLUMN     "currentApprovedStrategyId" TEXT;

-- CreateTable
CREATE TABLE "Strategy" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "StrategyStatus" NOT NULL DEFAULT 'ACTIVE',
    "originStrategyId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "Strategy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StrategyVersion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "strategyId" TEXT NOT NULL,
    "status" "StrategyVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "rowVersion" INTEGER NOT NULL DEFAULT 1,
    "versionNumber" INTEGER NOT NULL,
    "linkedApprovedProfileVersionId" TEXT,
    "draftProfileVersionId" TEXT,
    "organicEnabled" BOOLEAN NOT NULL DEFAULT true,
    "paidEnabled" BOOLEAN NOT NULL DEFAULT false,
    "organicDisabledRationale" TEXT,
    "paidDisabledRationale" TEXT,
    "aiAvailability" "StrategyAiAvailability" NOT NULL DEFAULT 'NOT_CONFIGURED',
    "foundationJson" TEXT,
    "unknownsAcknowledged" BOOLEAN NOT NULL DEFAULT false,
    "submittedAt" TIMESTAMP(3),
    "submittedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvedByUserId" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectedByUserId" TEXT,
    "supersedesVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StrategyVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StrategyOrganicTrack" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "strategyVersionId" TEXT NOT NULL,
    "pillarsJson" TEXT,
    "channelsJson" TEXT,
    "formatsJson" TEXT,
    "frequency" TEXT,
    "communityGoals" TEXT,
    "growthGoals" TEXT,
    "messageCta" TEXT,
    "funnelStagesJson" TEXT,
    "kpisJson" TEXT,
    "ownerRoleLabelsJson" TEXT,
    "dependenciesJson" TEXT,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "StrategyOrganicTrack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StrategyPaidTrack" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "strategyVersionId" TEXT NOT NULL,
    "campaignObjectivesJson" TEXT,
    "funnelStagesJson" TEXT,
    "audiencesJson" TEXT,
    "offerAngle" TEXT,
    "formatsJson" TEXT,
    "placementsJson" TEXT,
    "budgetAmount" DECIMAL(18,2),
    "budgetCurrency" TEXT,
    "allocationJson" TEXT,
    "expectedKpisJson" TEXT,
    "scheduleWindowStart" TIMESTAMP(3),
    "scheduleWindowEnd" TIMESTAMP(3),
    "landingDestination" TEXT,
    "approvalNotes" TEXT,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "StrategyPaidTrack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StrategyAudience" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "strategyVersionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "infoClass" "StrategyInfoClass" NOT NULL DEFAULT 'USER_AUTHORED',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "StrategyAudience_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StrategyCompetitorReference" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "strategyVersionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "sourceNote" TEXT,
    "capturedAt" TIMESTAMP(3),
    "uncertainty" TEXT,
    "infoClass" "StrategyInfoClass" NOT NULL DEFAULT 'USER_AUTHORED',

    CONSTRAINT "StrategyCompetitorReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StrategyKpi" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "strategyVersionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "targetValue" TEXT,
    "unit" TEXT,
    "appliesTo" "StrategyKpiAppliesTo" NOT NULL DEFAULT 'STRATEGY',
    "infoClass" "StrategyInfoClass" NOT NULL DEFAULT 'USER_AUTHORED',

    CONSTRAINT "StrategyKpi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StrategyRiskAssumptionDependency" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "strategyVersionId" TEXT NOT NULL,
    "kind" "StrategyGapKind" NOT NULL,
    "text" TEXT NOT NULL,
    "infoClass" "StrategyInfoClass" NOT NULL DEFAULT 'ASSUMPTION',

    CONSTRAINT "StrategyRiskAssumptionDependency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StrategyEvidenceLink" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "strategyVersionId" TEXT NOT NULL,
    "evidenceExcerptId" TEXT,
    "profileFieldKey" TEXT,
    "label" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StrategyEvidenceLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StrategyComment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "strategyVersionId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "anchorPath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StrategyComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StrategyReviewDecision" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "strategyVersionId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "action" "StrategyReviewAction" NOT NULL,
    "comment" TEXT,
    "capabilityCode" TEXT NOT NULL,
    "correlationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StrategyReviewDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StrategyApprovalRecord" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "strategyVersionId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "capabilityCode" TEXT NOT NULL,
    "linkedApprovedProfileVersionId" TEXT NOT NULL,
    "organicEnabled" BOOLEAN NOT NULL,
    "paidEnabled" BOOLEAN NOT NULL,
    "comment" TEXT,
    "unknownsAcknowledged" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StrategyApprovalRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StrategyHumanEdit" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "strategyVersionId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "fieldPath" TEXT NOT NULL,
    "beforeRef" TEXT,
    "afterRef" TEXT,
    "correlationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StrategyHumanEdit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Strategy_tenantId_brandId_updatedAt_idx" ON "Strategy"("tenantId", "brandId", "updatedAt");

-- CreateIndex
CREATE INDEX "Strategy_tenantId_brandId_status_idx" ON "Strategy"("tenantId", "brandId", "status");

-- CreateIndex
CREATE INDEX "StrategyVersion_tenantId_brandId_strategyId_createdAt_idx" ON "StrategyVersion"("tenantId", "brandId", "strategyId", "createdAt");

-- CreateIndex
CREATE INDEX "StrategyVersion_linkedApprovedProfileVersionId_idx" ON "StrategyVersion"("linkedApprovedProfileVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "StrategyVersion_strategyId_versionNumber_key" ON "StrategyVersion"("strategyId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "StrategyOrganicTrack_strategyVersionId_key" ON "StrategyOrganicTrack"("strategyVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "StrategyPaidTrack_strategyVersionId_key" ON "StrategyPaidTrack"("strategyVersionId");

-- CreateIndex
CREATE INDEX "StrategyAudience_tenantId_strategyVersionId_idx" ON "StrategyAudience"("tenantId", "strategyVersionId");

-- CreateIndex
CREATE INDEX "StrategyCompetitorReference_tenantId_strategyVersionId_idx" ON "StrategyCompetitorReference"("tenantId", "strategyVersionId");

-- CreateIndex
CREATE INDEX "StrategyKpi_tenantId_strategyVersionId_idx" ON "StrategyKpi"("tenantId", "strategyVersionId");

-- CreateIndex
CREATE INDEX "StrategyRiskAssumptionDependency_tenantId_strategyVersionId_idx" ON "StrategyRiskAssumptionDependency"("tenantId", "strategyVersionId");

-- CreateIndex
CREATE INDEX "StrategyEvidenceLink_tenantId_strategyVersionId_idx" ON "StrategyEvidenceLink"("tenantId", "strategyVersionId");

-- CreateIndex
CREATE INDEX "StrategyComment_tenantId_strategyVersionId_createdAt_idx" ON "StrategyComment"("tenantId", "strategyVersionId", "createdAt");

-- CreateIndex
CREATE INDEX "StrategyReviewDecision_tenantId_strategyVersionId_createdAt_idx" ON "StrategyReviewDecision"("tenantId", "strategyVersionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "StrategyApprovalRecord_strategyVersionId_key" ON "StrategyApprovalRecord"("strategyVersionId");

-- CreateIndex
CREATE INDEX "StrategyHumanEdit_tenantId_strategyVersionId_idx" ON "StrategyHumanEdit"("tenantId", "strategyVersionId");

-- CreateIndex
CREATE INDEX "BrandWorkspace_tenantId_currentApprovedStrategyId_idx" ON "BrandWorkspace"("tenantId", "currentApprovedStrategyId");

-- AddForeignKey
ALTER TABLE "Strategy" ADD CONSTRAINT "Strategy_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "BrandWorkspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StrategyVersion" ADD CONSTRAINT "StrategyVersion_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "Strategy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StrategyOrganicTrack" ADD CONSTRAINT "StrategyOrganicTrack_strategyVersionId_fkey" FOREIGN KEY ("strategyVersionId") REFERENCES "StrategyVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StrategyPaidTrack" ADD CONSTRAINT "StrategyPaidTrack_strategyVersionId_fkey" FOREIGN KEY ("strategyVersionId") REFERENCES "StrategyVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StrategyAudience" ADD CONSTRAINT "StrategyAudience_strategyVersionId_fkey" FOREIGN KEY ("strategyVersionId") REFERENCES "StrategyVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StrategyCompetitorReference" ADD CONSTRAINT "StrategyCompetitorReference_strategyVersionId_fkey" FOREIGN KEY ("strategyVersionId") REFERENCES "StrategyVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StrategyKpi" ADD CONSTRAINT "StrategyKpi_strategyVersionId_fkey" FOREIGN KEY ("strategyVersionId") REFERENCES "StrategyVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StrategyRiskAssumptionDependency" ADD CONSTRAINT "StrategyRiskAssumptionDependency_strategyVersionId_fkey" FOREIGN KEY ("strategyVersionId") REFERENCES "StrategyVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StrategyEvidenceLink" ADD CONSTRAINT "StrategyEvidenceLink_strategyVersionId_fkey" FOREIGN KEY ("strategyVersionId") REFERENCES "StrategyVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StrategyComment" ADD CONSTRAINT "StrategyComment_strategyVersionId_fkey" FOREIGN KEY ("strategyVersionId") REFERENCES "StrategyVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StrategyReviewDecision" ADD CONSTRAINT "StrategyReviewDecision_strategyVersionId_fkey" FOREIGN KEY ("strategyVersionId") REFERENCES "StrategyVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StrategyApprovalRecord" ADD CONSTRAINT "StrategyApprovalRecord_strategyVersionId_fkey" FOREIGN KEY ("strategyVersionId") REFERENCES "StrategyVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StrategyHumanEdit" ADD CONSTRAINT "StrategyHumanEdit_strategyVersionId_fkey" FOREIGN KEY ("strategyVersionId") REFERENCES "StrategyVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

