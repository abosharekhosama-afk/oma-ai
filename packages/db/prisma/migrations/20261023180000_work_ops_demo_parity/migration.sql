-- Work ops demo parity: task priority/department/READY, deliverable versions/annotations/comments, task checklist/comments

-- Task status enum extensions (Postgres)
DO $$ BEGIN
  ALTER TYPE "WorkTaskStatus" ADD VALUE IF NOT EXISTS 'READY';
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE "WorkTaskStatus" ADD VALUE IF NOT EXISTS 'OVERDUE';
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "WorkTaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "WorkDeliverableReviewStatus" AS ENUM (
    'NOT_STARTED', 'DRAFT', 'AWAITING_REVIEW', 'IN_REVIEW',
    'CHANGES_REQUESTED', 'APPROVED', 'REJECTED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- WorkTask columns
ALTER TABLE "WorkTask" ADD COLUMN IF NOT EXISTS "priority" "WorkTaskPriority" NOT NULL DEFAULT 'MEDIUM';
ALTER TABLE "WorkTask" ADD COLUMN IF NOT EXISTS "department" TEXT NOT NULL DEFAULT '';

-- WorkDeliverable reviewStatus → enum (safe path: add new col, copy, drop old if text)
ALTER TABLE "WorkDeliverable" ADD COLUMN IF NOT EXISTS "currentVersionId" TEXT;
ALTER TABLE "WorkDeliverable" ADD COLUMN IF NOT EXISTS "approvedVersionId" TEXT;

-- Migrate reviewStatus from text to enum when still text
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'WorkDeliverable' AND column_name = 'reviewStatus'
      AND data_type = 'text'
  ) THEN
    ALTER TABLE "WorkDeliverable" ADD COLUMN IF NOT EXISTS "reviewStatus_new" "WorkDeliverableReviewStatus" DEFAULT 'NOT_STARTED';
    UPDATE "WorkDeliverable" SET "reviewStatus_new" = CASE
      WHEN upper("reviewStatus") IN ('NOT_STARTED','DRAFT','AWAITING_REVIEW','IN_REVIEW','CHANGES_REQUESTED','APPROVED','REJECTED')
        THEN upper("reviewStatus")::"WorkDeliverableReviewStatus"
      WHEN upper("reviewStatus") = 'DONE' THEN 'APPROVED'::"WorkDeliverableReviewStatus"
      ELSE 'NOT_STARTED'::"WorkDeliverableReviewStatus"
    END;
    ALTER TABLE "WorkDeliverable" DROP COLUMN "reviewStatus";
    ALTER TABLE "WorkDeliverable" RENAME COLUMN "reviewStatus_new" TO "reviewStatus";
    ALTER TABLE "WorkDeliverable" ALTER COLUMN "reviewStatus" SET DEFAULT 'NOT_STARTED';
    ALTER TABLE "WorkDeliverable" ALTER COLUMN "reviewStatus" SET NOT NULL;
  END IF;
EXCEPTION WHEN others THEN
  -- keep text column if enum migration not possible
  NULL;
END $$;

CREATE TABLE IF NOT EXISTS "WorkDeliverableVersion" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "deliverableId" TEXT NOT NULL,
  "label" TEXT NOT NULL DEFAULT 'v1',
  "versionNumber" INTEGER NOT NULL DEFAULT 1,
  "assetUrl" TEXT,
  "notesEn" TEXT NOT NULL DEFAULT '',
  "notesAr" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkDeliverableVersion_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "WorkDeliverableVersion_deliverableId_versionNumber_idx"
  ON "WorkDeliverableVersion"("deliverableId", "versionNumber");
CREATE INDEX IF NOT EXISTS "WorkDeliverableVersion_tenantId_deliverableId_idx"
  ON "WorkDeliverableVersion"("tenantId", "deliverableId");
DO $$ BEGIN
  ALTER TABLE "WorkDeliverableVersion" ADD CONSTRAINT "WorkDeliverableVersion_deliverableId_fkey"
    FOREIGN KEY ("deliverableId") REFERENCES "WorkDeliverable"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "WorkDeliverableAnnotation" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "deliverableId" TEXT NOT NULL,
  "versionId" TEXT,
  "authorUserId" TEXT NOT NULL,
  "bodyEn" TEXT NOT NULL,
  "bodyAr" TEXT NOT NULL DEFAULT '',
  "x" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  "y" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  "resolved" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkDeliverableAnnotation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "WorkDeliverableAnnotation_deliverableId_createdAt_idx"
  ON "WorkDeliverableAnnotation"("deliverableId", "createdAt");
CREATE INDEX IF NOT EXISTS "WorkDeliverableAnnotation_tenantId_deliverableId_idx"
  ON "WorkDeliverableAnnotation"("tenantId", "deliverableId");
DO $$ BEGIN
  ALTER TABLE "WorkDeliverableAnnotation" ADD CONSTRAINT "WorkDeliverableAnnotation_deliverableId_fkey"
    FOREIGN KEY ("deliverableId") REFERENCES "WorkDeliverable"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "WorkDeliverableComment" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "deliverableId" TEXT NOT NULL,
  "versionId" TEXT,
  "authorUserId" TEXT NOT NULL,
  "bodyEn" TEXT NOT NULL,
  "bodyAr" TEXT NOT NULL DEFAULT '',
  "resolved" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkDeliverableComment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "WorkDeliverableComment_deliverableId_createdAt_idx"
  ON "WorkDeliverableComment"("deliverableId", "createdAt");
CREATE INDEX IF NOT EXISTS "WorkDeliverableComment_tenantId_deliverableId_idx"
  ON "WorkDeliverableComment"("tenantId", "deliverableId");
DO $$ BEGIN
  ALTER TABLE "WorkDeliverableComment" ADD CONSTRAINT "WorkDeliverableComment_deliverableId_fkey"
    FOREIGN KEY ("deliverableId") REFERENCES "WorkDeliverable"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "WorkTaskChecklistItem" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "titleEn" TEXT NOT NULL,
  "titleAr" TEXT NOT NULL DEFAULT '',
  "done" BOOLEAN NOT NULL DEFAULT false,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkTaskChecklistItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "WorkTaskChecklistItem_taskId_sortOrder_idx"
  ON "WorkTaskChecklistItem"("taskId", "sortOrder");
CREATE INDEX IF NOT EXISTS "WorkTaskChecklistItem_tenantId_taskId_idx"
  ON "WorkTaskChecklistItem"("tenantId", "taskId");
DO $$ BEGIN
  ALTER TABLE "WorkTaskChecklistItem" ADD CONSTRAINT "WorkTaskChecklistItem_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "WorkTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "WorkTaskComment" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "authorUserId" TEXT NOT NULL,
  "bodyEn" TEXT NOT NULL,
  "bodyAr" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkTaskComment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "WorkTaskComment_taskId_createdAt_idx"
  ON "WorkTaskComment"("taskId", "createdAt");
CREATE INDEX IF NOT EXISTS "WorkTaskComment_tenantId_taskId_idx"
  ON "WorkTaskComment"("tenantId", "taskId");
DO $$ BEGIN
  ALTER TABLE "WorkTaskComment" ADD CONSTRAINT "WorkTaskComment_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "WorkTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Backfill initial version for existing deliverables that have no versions
INSERT INTO "WorkDeliverableVersion" (
  "id", "tenantId", "deliverableId", "label", "versionNumber", "assetUrl",
  "status", "createdBy", "createdAt", "updatedAt"
)
SELECT
  'ver_' || d."id",
  d."tenantId",
  d."id",
  'v1',
  1,
  d."assetUrl",
  CASE WHEN d."status"::text = 'APPROVED' THEN 'APPROVED' ELSE 'DRAFT' END,
  d."createdBy",
  d."createdAt",
  d."updatedAt"
FROM "WorkDeliverable" d
WHERE NOT EXISTS (
  SELECT 1 FROM "WorkDeliverableVersion" v WHERE v."deliverableId" = d."id"
);

UPDATE "WorkDeliverable" d
SET
  "currentVersionId" = COALESCE(d."currentVersionId", 'ver_' || d."id"),
  "approvedVersionId" = CASE
    WHEN d."status"::text = 'APPROVED' THEN COALESCE(d."approvedVersionId", 'ver_' || d."id")
    ELSE d."approvedVersionId"
  END
WHERE d."currentVersionId" IS NULL OR (d."status"::text = 'APPROVED' AND d."approvedVersionId" IS NULL);
