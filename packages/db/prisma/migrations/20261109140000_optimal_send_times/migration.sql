-- Optimal send times: indexed post snapshots and precomputed 7x24 buckets / top slots.

CREATE TABLE "PostMetricSnapshot" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "socialPageId" TEXT NOT NULL,
    "publishTargetId" TEXT NOT NULL,
    "contentItemId" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "impressions" INTEGER,
    "reach" INTEGER,
    "likes" INTEGER,
    "comments" INTEGER,
    "shares" INTEGER,
    "views" INTEGER,
    "engagementRate" DOUBLE PRECISION,
    "excluded" BOOLEAN NOT NULL DEFAULT false,
    "excludeReason" TEXT,
    "source" TEXT NOT NULL DEFAULT 'insights_json',
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostMetricSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PostMetricSnapshot_publishTargetId_key" ON "PostMetricSnapshot"("publishTargetId");
CREATE INDEX "PostMetricSnapshot_tenantId_socialPageId_publishedAt_idx" ON "PostMetricSnapshot"("tenantId", "socialPageId", "publishedAt");
CREATE INDEX "PostMetricSnapshot_tenantId_brandId_idx" ON "PostMetricSnapshot"("tenantId", "brandId");
CREATE INDEX "PostMetricSnapshot_contentItemId_idx" ON "PostMetricSnapshot"("contentItemId");

ALTER TABLE "PostMetricSnapshot" ADD CONSTRAINT "PostMetricSnapshot_socialPageId_fkey" FOREIGN KEY ("socialPageId") REFERENCES "SocialPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AudienceActivityBucket" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "socialPageId" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "hourLocal" INTEGER NOT NULL,
    "postCount" INTEGER NOT NULL,
    "weightedEr" DOUBLE PRECISION NOT NULL,
    "weightSum" DOUBLE PRECISION NOT NULL,
    "engagementSum" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "priorScore" DOUBLE PRECISION NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AudienceActivityBucket_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AudienceActivityBucket_socialPageId_dayOfWeek_hourLocal_key" ON "AudienceActivityBucket"("socialPageId", "dayOfWeek", "hourLocal");
CREATE INDEX "AudienceActivityBucket_tenantId_socialPageId_idx" ON "AudienceActivityBucket"("tenantId", "socialPageId");

ALTER TABLE "AudienceActivityBucket" ADD CONSTRAINT "AudienceActivityBucket_socialPageId_fkey" FOREIGN KEY ("socialPageId") REFERENCES "SocialPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "OptimalTimeSlot" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "socialPageId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "minuteOfDay" INTEGER NOT NULL,
    "rank" INTEGER NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'model',
    "computedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OptimalTimeSlot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OptimalTimeSlot_socialPageId_dayOfWeek_rank_key" ON "OptimalTimeSlot"("socialPageId", "dayOfWeek", "rank");
CREATE INDEX "OptimalTimeSlot_tenantId_socialPageId_idx" ON "OptimalTimeSlot"("tenantId", "socialPageId");

ALTER TABLE "OptimalTimeSlot" ADD CONSTRAINT "OptimalTimeSlot_socialPageId_fkey" FOREIGN KEY ("socialPageId") REFERENCES "SocialPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
