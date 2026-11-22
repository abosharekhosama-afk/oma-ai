-- DEC-029 PR 4.8: read-only Meta Ads insights.
CREATE TABLE "MetaAdsLink" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING_ACCOUNT',
  "adAccountId" TEXT,
  "adAccountName" TEXT,
  "currency" TEXT,
  "accessTokenEnc" TEXT,
  "tokenExpiresAt" TIMESTAMP(3),
  "lastSyncAt" TIMESTAMP(3),
  "lastError" TEXT,
  "connectedBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MetaAdsLink_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MetaAdsLink_brandId_key" ON "MetaAdsLink"("brandId");
CREATE INDEX "MetaAdsLink_tenantId_status_idx" ON "MetaAdsLink"("tenantId", "status");

CREATE TABLE "MetaAdsOAuthState" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MetaAdsOAuthState_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MetaAdsOAuthState_expiresAt_idx" ON "MetaAdsOAuthState"("expiresAt");

ALTER TABLE "PaidSpendEntry" ADD COLUMN "externalCampaignId" TEXT;
