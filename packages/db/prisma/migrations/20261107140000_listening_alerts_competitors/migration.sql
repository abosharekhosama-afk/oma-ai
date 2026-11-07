-- Listening rule kinds + workspace alerts (Planable-style competitors & alerts)

ALTER TABLE "ListeningRule" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'BRAND';

CREATE INDEX "ListeningRule_tenantId_kind_idx" ON "ListeningRule"("tenantId", "kind");

UPDATE "ListeningRule" SET "kind" = 'COMPETITOR' WHERE "name" ILIKE '%competitor%';
UPDATE "ListeningRule" SET "kind" = 'TOPIC' WHERE "name" ILIKE '%topic%' OR "name" ILIKE '%hashtag%';

CREATE TABLE "ListeningAlert" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "brandId" TEXT,
    "name" TEXT NOT NULL,
    "triggerType" TEXT NOT NULL,
    "thresholdJson" TEXT NOT NULL DEFAULT '{}',
    "platformsJson" TEXT NOT NULL DEFAULT '[]',
    "notifyInApp" BOOLEAN NOT NULL DEFAULT true,
    "notifyEmail" BOOLEAN NOT NULL DEFAULT false,
    "notifySlack" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastFiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ListeningAlert_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ListeningAlert_tenantId_isActive_idx" ON "ListeningAlert"("tenantId", "isActive");
CREATE INDEX "ListeningAlert_tenantId_brandId_idx" ON "ListeningAlert"("tenantId", "brandId");

ALTER TABLE "ListeningAlert" ADD CONSTRAINT "ListeningAlert_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
