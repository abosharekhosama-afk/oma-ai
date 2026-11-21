-- CreateEnum
CREATE TYPE "BrandSeoMetricSource" AS ENUM ('CRAWL', 'GSC_FIXTURE', 'GSC_LIVE', 'MIXED');

-- CreateTable
CREATE TABLE "BrandSeoAudit" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "scanAttemptId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "findingsCount" INTEGER NOT NULL,
    "summaryJson" TEXT NOT NULL,
    "metricSource" "BrandSeoMetricSource" NOT NULL DEFAULT 'CRAWL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BrandSeoAudit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SeoFinding" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "seoAuditId" TEXT NOT NULL,
    "pageUrl" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "detail" TEXT,
    CONSTRAINT "SeoFinding_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BrandSearchConsoleLink" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "siteUrl" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NOT_CONFIGURED',
    "accessTokenEnc" TEXT,
    "refreshTokenEnc" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "lastError" TEXT,
    "connectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BrandSearchConsoleLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GscOAuthState" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GscOAuthState_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KeywordRankObservation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'ar',
    "position" DOUBLE PRECISION,
    "impressions" INTEGER,
    "clicks" INTEGER,
    "ctr" DOUBLE PRECISION,
    "pageUrl" TEXT,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL,
    CONSTRAINT "KeywordRankObservation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BrandSeoAudit_scanAttemptId_key" ON "BrandSeoAudit"("scanAttemptId");
CREATE INDEX "BrandSeoAudit_tenantId_brandId_createdAt_idx" ON "BrandSeoAudit"("tenantId", "brandId", "createdAt");
CREATE INDEX "SeoFinding_tenantId_seoAuditId_idx" ON "SeoFinding"("tenantId", "seoAuditId");
CREATE INDEX "SeoFinding_tenantId_brandId_code_idx" ON "SeoFinding"("tenantId", "brandId", "code");
CREATE UNIQUE INDEX "BrandSearchConsoleLink_brandId_key" ON "BrandSearchConsoleLink"("brandId");
CREATE INDEX "BrandSearchConsoleLink_tenantId_status_idx" ON "BrandSearchConsoleLink"("tenantId", "status");
CREATE INDEX "GscOAuthState_expiresAt_idx" ON "GscOAuthState"("expiresAt");
CREATE INDEX "KeywordRankObservation_tenantId_brandId_capturedAt_idx" ON "KeywordRankObservation"("tenantId", "brandId", "capturedAt");
CREATE INDEX "KeywordRankObservation_tenantId_brandId_keyword_idx" ON "KeywordRankObservation"("tenantId", "brandId", "keyword");

ALTER TABLE "BrandSeoAudit" ADD CONSTRAINT "BrandSeoAudit_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "BrandWorkspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BrandSeoAudit" ADD CONSTRAINT "BrandSeoAudit_scanAttemptId_fkey" FOREIGN KEY ("scanAttemptId") REFERENCES "ScanAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SeoFinding" ADD CONSTRAINT "SeoFinding_seoAuditId_fkey" FOREIGN KEY ("seoAuditId") REFERENCES "BrandSeoAudit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BrandSearchConsoleLink" ADD CONSTRAINT "BrandSearchConsoleLink_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "BrandWorkspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;