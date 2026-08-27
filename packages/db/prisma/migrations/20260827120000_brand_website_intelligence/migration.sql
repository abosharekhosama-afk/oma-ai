-- Brand Website Intelligence migration (002)
-- Rollback: drop tables in reverse dependency order; drop enums last.

-- CreateEnum
CREATE TYPE "BrandWorkspaceStatus" AS ENUM ('DRAFT', 'READY_TO_SCAN', 'ACTIVE', 'ARCHIVED');
CREATE TYPE "WebsiteValidationStatus" AS ENUM ('VALID', 'REJECTED');
CREATE TYPE "ScanAttemptStatus" AS ENUM ('QUEUED', 'CRAWLING', 'EXTRACTING', 'ANALYZING', 'SUCCEEDED', 'PARTIAL', 'FAILED', 'CANCELLED');
CREATE TYPE "ScanTrigger" AS ENUM ('START', 'RETRY', 'RESCAN');
CREATE TYPE "BrandAiAvailability" AS ENUM ('NOT_CONFIGURED', 'UNAVAILABLE', 'USED', 'SKIPPED');
CREATE TYPE "PageClassification" AS ENUM ('HOME', 'PRODUCT', 'SERVICE', 'ABOUT', 'FAQ', 'CONTACT', 'LEGAL', 'OTHER', 'UNKNOWN');
CREATE TYPE "PageFetchStatus" AS ENUM ('FETCHED', 'FAILED', 'SKIPPED_ROBOTS', 'SKIPPED_LIMIT');
CREATE TYPE "ProductServiceKind" AS ENUM ('PRODUCT', 'SERVICE');
CREATE TYPE "DiscoveryTier" AS ENUM ('REQUIRED_FOR_APPROVAL', 'DISCOVER_WHEN_AVAILABLE', 'DEFERRED_ADVANCED');
CREATE TYPE "BrandInfoState" AS ENUM ('OBSERVED', 'AI_INFERRED', 'USER_CONFIRMED', 'USER_CORRECTED', 'STALE');
CREATE TYPE "ExtractionMethod" AS ENUM ('HTML_META', 'JSON_LD', 'OG', 'HEURISTIC', 'USER', 'AI');
CREATE TYPE "ProfileVersionStatus" AS ENUM ('DRAFT', 'NEEDS_REVIEW', 'APPROVED', 'SUPERSEDED', 'REJECTED');
CREATE TYPE "InsightReviewStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'EDITED');
CREATE TYPE "HumanEditAction" AS ENUM ('EDIT', 'ACCEPT', 'REJECT_INSIGHT', 'REJECT_VERSION', 'APPROVE_VERSION');
CREATE TYPE "InsightCreatedBy" AS ENUM ('SYSTEM', 'AI', 'USER');

-- CreateTable
CREATE TABLE "BrandWorkspace" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "BrandWorkspaceStatus" NOT NULL DEFAULT 'DRAFT',
    "currentApprovedProfileVersionId" TEXT,
    "primaryWebsiteSourceId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "BrandWorkspace_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WebsiteSource" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "normalizedUrl" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "attestationAcceptedAt" TIMESTAMP(3) NOT NULL,
    "attestedByUserId" TEXT NOT NULL,
    "validationStatus" "WebsiteValidationStatus" NOT NULL DEFAULT 'VALID',
    "validationReason" TEXT,
    "sourceRevision" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "replacedAt" TIMESTAMP(3),

    CONSTRAINT "WebsiteSource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ScanAttempt" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "websiteSourceId" TEXT NOT NULL,
    "status" "ScanAttemptStatus" NOT NULL DEFAULT 'QUEUED',
    "trigger" "ScanTrigger" NOT NULL DEFAULT 'START',
    "parentAttemptId" TEXT,
    "jobRunId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "correlationId" TEXT,
    "progressPercent" INTEGER NOT NULL DEFAULT 0,
    "pagesFetched" INTEGER NOT NULL DEFAULT 0,
    "pagesFailed" INTEGER NOT NULL DEFAULT 0,
    "pagesSkipped" INTEGER NOT NULL DEFAULT 0,
    "coverageJson" TEXT,
    "aiAvailability" "BrandAiAvailability" NOT NULL DEFAULT 'NOT_CONFIGURED',
    "errorCode" TEXT,
    "errorDetail" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "cancelRequestedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScanAttempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DiscoveredPage" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "scanAttemptId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "canonicalUrl" TEXT NOT NULL,
    "canonicalHash" TEXT NOT NULL,
    "title" TEXT,
    "httpStatus" INTEGER,
    "contentType" TEXT,
    "classification" "PageClassification" NOT NULL DEFAULT 'UNKNOWN',
    "fetchStatus" "PageFetchStatus" NOT NULL DEFAULT 'FETCHED',
    "failureReason" TEXT,
    "localeHint" TEXT,
    "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscoveredPage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DiscoveredProductService" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "scanAttemptId" TEXT NOT NULL,
    "kind" "ProductServiceKind" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "skuPublic" TEXT,
    "priceAmount" TEXT,
    "priceCurrency" TEXT,
    "availability" TEXT,
    "sourcePageId" TEXT,
    "parentProductId" TEXT,
    "dedupeKey" TEXT NOT NULL,

    CONSTRAINT "DiscoveredProductService_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExtractedObservation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "scanAttemptId" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "discoveryTier" "DiscoveryTier" NOT NULL,
    "valueJson" TEXT,
    "isUnknown" BOOLEAN NOT NULL DEFAULT false,
    "infoState" "BrandInfoState" NOT NULL DEFAULT 'OBSERVED',
    "confidence" DOUBLE PRECISION,
    "evidenceId" TEXT,
    "profileVersionId" TEXT,
    "immutable" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ExtractedObservation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EvidenceExcerpt" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "scanAttemptId" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "canonicalUrl" TEXT NOT NULL,
    "pageTitle" TEXT,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "excerptText" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "extractionMethod" "ExtractionMethod" NOT NULL,
    "discoveredPageId" TEXT,

    CONSTRAINT "EvidenceExcerpt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProfileVersion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "scanAttemptId" TEXT,
    "status" "ProfileVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "rowVersion" INTEGER NOT NULL DEFAULT 1,
    "aiAvailability" "BrandAiAvailability" NOT NULL DEFAULT 'NOT_CONFIGURED',
    "coverageSnapshotJson" TEXT,
    "sectionsJson" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvedByUserId" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectedByUserId" TEXT,
    "incompletenessAcknowledged" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfileVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InsightClaim" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "profileVersionId" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "infoState" "BrandInfoState" NOT NULL DEFAULT 'OBSERVED',
    "reviewStatus" "InsightReviewStatus" NOT NULL DEFAULT 'PENDING',
    "textValue" TEXT,
    "valueJson" TEXT,
    "evidenceId" TEXT,
    "discoveryTier" "DiscoveryTier" NOT NULL,
    "createdBy" "InsightCreatedBy" NOT NULL DEFAULT 'SYSTEM',
    "rowVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "InsightClaim_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HumanEdit" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "profileVersionId" TEXT NOT NULL,
    "insightId" TEXT,
    "actorUserId" TEXT NOT NULL,
    "action" "HumanEditAction" NOT NULL,
    "beforeRef" TEXT,
    "afterRef" TEXT,
    "acknowledgeIncomplete" BOOLEAN NOT NULL DEFAULT false,
    "correlationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HumanEdit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReviewDecision" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "profileVersionId" TEXT NOT NULL,
    "insightId" TEXT,
    "actorUserId" TEXT NOT NULL,
    "action" "HumanEditAction" NOT NULL,
    "beforeRef" TEXT,
    "afterRef" TEXT,
    "acknowledgeIncomplete" BOOLEAN NOT NULL DEFAULT false,
    "correlationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewDecision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ApprovalRecord" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "profileVersionId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "acknowledgedIncomplete" BOOLEAN NOT NULL DEFAULT false,
    "warningsJson" TEXT,
    "coverageSnapshotJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ScanAttempt_jobRunId_key" ON "ScanAttempt"("jobRunId");
CREATE UNIQUE INDEX "ScanAttempt_idempotencyKey_key" ON "ScanAttempt"("idempotencyKey");
CREATE INDEX "ScanAttempt_tenantId_brandId_createdAt_idx" ON "ScanAttempt"("tenantId", "brandId", "createdAt");
CREATE UNIQUE INDEX "DiscoveredPage_scanAttemptId_canonicalHash_key" ON "DiscoveredPage"("scanAttemptId", "canonicalHash");
CREATE INDEX "DiscoveredPage_tenantId_scanAttemptId_idx" ON "DiscoveredPage"("tenantId", "scanAttemptId");
CREATE UNIQUE INDEX "DiscoveredProductService_scanAttemptId_dedupeKey_key" ON "DiscoveredProductService"("scanAttemptId", "dedupeKey");
CREATE INDEX "DiscoveredProductService_tenantId_scanAttemptId_idx" ON "DiscoveredProductService"("tenantId", "scanAttemptId");
CREATE INDEX "ExtractedObservation_tenantId_scanAttemptId_idx" ON "ExtractedObservation"("tenantId", "scanAttemptId");
CREATE INDEX "ExtractedObservation_profileVersionId_idx" ON "ExtractedObservation"("profileVersionId");
CREATE INDEX "EvidenceExcerpt_tenantId_scanAttemptId_idx" ON "EvidenceExcerpt"("tenantId", "scanAttemptId");
CREATE INDEX "ProfileVersion_tenantId_brandId_createdAt_idx" ON "ProfileVersion"("tenantId", "brandId", "createdAt");
CREATE INDEX "InsightClaim_tenantId_profileVersionId_idx" ON "InsightClaim"("tenantId", "profileVersionId");
CREATE INDEX "HumanEdit_tenantId_profileVersionId_idx" ON "HumanEdit"("tenantId", "profileVersionId");
CREATE INDEX "ReviewDecision_tenantId_profileVersionId_idx" ON "ReviewDecision"("tenantId", "profileVersionId");
CREATE UNIQUE INDEX "ApprovalRecord_profileVersionId_key" ON "ApprovalRecord"("profileVersionId");
CREATE INDEX "BrandWorkspace_tenantId_status_updatedAt_idx" ON "BrandWorkspace"("tenantId", "status", "updatedAt");
CREATE INDEX "WebsiteSource_tenantId_brandId_idx" ON "WebsiteSource"("tenantId", "brandId");

-- AddForeignKey
ALTER TABLE "BrandWorkspace" ADD CONSTRAINT "BrandWorkspace_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WebsiteSource" ADD CONSTRAINT "WebsiteSource_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "BrandWorkspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ScanAttempt" ADD CONSTRAINT "ScanAttempt_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "BrandWorkspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ScanAttempt" ADD CONSTRAINT "ScanAttempt_websiteSourceId_fkey" FOREIGN KEY ("websiteSourceId") REFERENCES "WebsiteSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DiscoveredPage" ADD CONSTRAINT "DiscoveredPage_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "BrandWorkspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DiscoveredPage" ADD CONSTRAINT "DiscoveredPage_scanAttemptId_fkey" FOREIGN KEY ("scanAttemptId") REFERENCES "ScanAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DiscoveredProductService" ADD CONSTRAINT "DiscoveredProductService_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "BrandWorkspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DiscoveredProductService" ADD CONSTRAINT "DiscoveredProductService_scanAttemptId_fkey" FOREIGN KEY ("scanAttemptId") REFERENCES "ScanAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExtractedObservation" ADD CONSTRAINT "ExtractedObservation_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "BrandWorkspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExtractedObservation" ADD CONSTRAINT "ExtractedObservation_scanAttemptId_fkey" FOREIGN KEY ("scanAttemptId") REFERENCES "ScanAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExtractedObservation" ADD CONSTRAINT "ExtractedObservation_profileVersionId_fkey" FOREIGN KEY ("profileVersionId") REFERENCES "ProfileVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EvidenceExcerpt" ADD CONSTRAINT "EvidenceExcerpt_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "BrandWorkspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EvidenceExcerpt" ADD CONSTRAINT "EvidenceExcerpt_scanAttemptId_fkey" FOREIGN KEY ("scanAttemptId") REFERENCES "ScanAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EvidenceExcerpt" ADD CONSTRAINT "EvidenceExcerpt_discoveredPageId_fkey" FOREIGN KEY ("discoveredPageId") REFERENCES "DiscoveredPage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProfileVersion" ADD CONSTRAINT "ProfileVersion_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "BrandWorkspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProfileVersion" ADD CONSTRAINT "ProfileVersion_scanAttemptId_fkey" FOREIGN KEY ("scanAttemptId") REFERENCES "ScanAttempt"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InsightClaim" ADD CONSTRAINT "InsightClaim_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "BrandWorkspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InsightClaim" ADD CONSTRAINT "InsightClaim_profileVersionId_fkey" FOREIGN KEY ("profileVersionId") REFERENCES "ProfileVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InsightClaim" ADD CONSTRAINT "InsightClaim_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "EvidenceExcerpt"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HumanEdit" ADD CONSTRAINT "HumanEdit_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "BrandWorkspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HumanEdit" ADD CONSTRAINT "HumanEdit_profileVersionId_fkey" FOREIGN KEY ("profileVersionId") REFERENCES "ProfileVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HumanEdit" ADD CONSTRAINT "HumanEdit_insightId_fkey" FOREIGN KEY ("insightId") REFERENCES "InsightClaim"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReviewDecision" ADD CONSTRAINT "ReviewDecision_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "BrandWorkspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReviewDecision" ADD CONSTRAINT "ReviewDecision_profileVersionId_fkey" FOREIGN KEY ("profileVersionId") REFERENCES "ProfileVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ApprovalRecord" ADD CONSTRAINT "ApprovalRecord_profileVersionId_fkey" FOREIGN KEY ("profileVersionId") REFERENCES "ProfileVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
