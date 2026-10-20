CREATE TABLE IF NOT EXISTS "CalendarDayNote" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "dayKey" TEXT NOT NULL,
    "textEn" TEXT NOT NULL DEFAULT '',
    "textAr" TEXT NOT NULL DEFAULT '',
    "color" TEXT NOT NULL DEFAULT 'yellow',
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CalendarDayNote_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CalendarDayNote_brandId_dayKey_key" ON "CalendarDayNote"("brandId", "dayKey");
CREATE INDEX IF NOT EXISTS "CalendarDayNote_tenantId_brandId_idx" ON "CalendarDayNote"("tenantId", "brandId");

CREATE TABLE IF NOT EXISTS "ContentLabel" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ContentLabel_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ContentLabel_brandId_nameEn_key" ON "ContentLabel"("brandId", "nameEn");
CREATE INDEX IF NOT EXISTS "ContentLabel_tenantId_brandId_idx" ON "ContentLabel"("tenantId", "brandId");

CREATE TABLE IF NOT EXISTS "ContentTemplate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "titleEn" TEXT,
    "titleAr" TEXT,
    "captionEn" TEXT,
    "captionAr" TEXT,
    "contentType" "ContentType" NOT NULL DEFAULT 'POST',
    "channel" TEXT NOT NULL DEFAULT 'instagram',
    "track" "Track" NOT NULL DEFAULT 'ORGANIC',
    "labels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "previewAssetUrl" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ContentTemplate_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ContentTemplate_tenantId_brandId_idx" ON "ContentTemplate"("tenantId", "brandId");
