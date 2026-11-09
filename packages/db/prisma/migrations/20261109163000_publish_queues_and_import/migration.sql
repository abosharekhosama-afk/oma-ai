-- Allow historical imports that are not tied to an OMA publish target.
ALTER TABLE "PostMetricSnapshot" ALTER COLUMN "publishTargetId" DROP NOT NULL;
ALTER TABLE "PostMetricSnapshot" ALTER COLUMN "contentItemId" DROP NOT NULL;
ALTER TABLE "PostMetricSnapshot" ADD COLUMN "externalPostId" TEXT;

CREATE UNIQUE INDEX "PostMetricSnapshot_socialPageId_externalPostId_key"
  ON "PostMetricSnapshot"("socialPageId", "externalPostId");

CREATE TABLE "PublishQueue" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "socialPageId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "slotsPerDay" INTEGER NOT NULL DEFAULT 3,
    "windowStart" TEXT,
    "windowEnd" TEXT,
    "split" TEXT NOT NULL DEFAULT 'per_day',
    "useSuggested" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublishQueue_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PublishQueue_socialPageId_key" ON "PublishQueue"("socialPageId");
CREATE INDEX "PublishQueue_tenantId_idx" ON "PublishQueue"("tenantId");

ALTER TABLE "PublishQueue" ADD CONSTRAINT "PublishQueue_socialPageId_fkey"
  FOREIGN KEY ("socialPageId") REFERENCES "SocialPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "QueueSlot" (
    "id" TEXT NOT NULL,
    "queueId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "timeLocal" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "QueueSlot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "QueueSlot_queueId_dayOfWeek_timeLocal_key"
  ON "QueueSlot"("queueId", "dayOfWeek", "timeLocal");

ALTER TABLE "QueueSlot" ADD CONSTRAINT "QueueSlot_queueId_fkey"
  FOREIGN KEY ("queueId") REFERENCES "PublishQueue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
