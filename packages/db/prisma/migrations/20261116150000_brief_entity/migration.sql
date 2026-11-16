-- Brief entity (DEC-019): Brief, BriefVersion, BriefDecision, BriefComment + WorkTask brief link.

-- CreateEnum
CREATE TYPE "BriefStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'CONVERTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BriefDecisionKind" AS ENUM ('SUBMIT', 'APPROVE', 'REQUEST_CHANGES', 'REVISE', 'CONVERT', 'CANCEL');

-- AlterTable
ALTER TABLE "WorkTask" ADD COLUMN     "briefDeliverableKey" TEXT,
ADD COLUMN     "briefId" TEXT,
ADD COLUMN     "briefVersionId" TEXT;

-- CreateTable
CREATE TABLE "Brief" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "BriefStatus" NOT NULL DEFAULT 'DRAFT',
    "requestId" TEXT,
    "strategyId" TEXT,
    "strategyVersionId" TEXT,
    "currentVersionId" TEXT,
    "currentVersionNo" INTEGER NOT NULL DEFAULT 1,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,
    "origin" TEXT NOT NULL DEFAULT 'manual',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "convertedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),

CONSTRAINT "Brief_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BriefVersion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "briefId" TEXT NOT NULL,
    "versionNo" INTEGER NOT NULL,
    "contentJson" TEXT NOT NULL DEFAULT '{}',
    "authorUserId" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

CONSTRAINT "BriefVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BriefDecision" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "briefId" TEXT NOT NULL,
    "briefVersionId" TEXT NOT NULL,
    "kind" "BriefDecisionKind" NOT NULL,
    "fromStatus" "BriefStatus" NOT NULL,
    "toStatus" "BriefStatus" NOT NULL,
    "comment" TEXT,
    "actorUserId" TEXT NOT NULL,
    "selfApproval" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

CONSTRAINT "BriefDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BriefComment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "briefId" TEXT NOT NULL,
    "briefVersionId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

CONSTRAINT "BriefComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Brief_tenantId_brandId_status_idx" ON "Brief"("tenantId", "brandId", "status");

-- CreateIndex
CREATE INDEX "Brief_strategyVersionId_idx" ON "Brief"("strategyVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "Brief_tenantId_requestId_key" ON "Brief"("tenantId", "requestId");

-- CreateIndex
CREATE INDEX "BriefVersion_tenantId_briefId_idx" ON "BriefVersion"("tenantId", "briefId");

-- CreateIndex
CREATE UNIQUE INDEX "BriefVersion_briefId_versionNo_key" ON "BriefVersion"("briefId", "versionNo");

-- CreateIndex
CREATE INDEX "BriefDecision_tenantId_briefId_createdAt_idx" ON "BriefDecision"("tenantId", "briefId", "createdAt");

-- CreateIndex
CREATE INDEX "BriefComment_tenantId_briefId_createdAt_idx" ON "BriefComment"("tenantId", "briefId", "createdAt");

-- CreateIndex
CREATE INDEX "WorkTask_briefId_idx" ON "WorkTask"("briefId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkTask_briefVersionId_briefDeliverableKey_key" ON "WorkTask"("briefVersionId", "briefDeliverableKey");

-- AddForeignKey
ALTER TABLE "WorkTask" ADD CONSTRAINT "WorkTask_briefId_fkey" FOREIGN KEY ("briefId") REFERENCES "Brief"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkTask" ADD CONSTRAINT "WorkTask_briefVersionId_fkey" FOREIGN KEY ("briefVersionId") REFERENCES "BriefVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BriefVersion" ADD CONSTRAINT "BriefVersion_briefId_fkey" FOREIGN KEY ("briefId") REFERENCES "Brief"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BriefDecision" ADD CONSTRAINT "BriefDecision_briefId_fkey" FOREIGN KEY ("briefId") REFERENCES "Brief"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BriefDecision" ADD CONSTRAINT "BriefDecision_briefVersionId_fkey" FOREIGN KEY ("briefVersionId") REFERENCES "BriefVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BriefComment" ADD CONSTRAINT "BriefComment_briefId_fkey" FOREIGN KEY ("briefId") REFERENCES "Brief"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BriefComment" ADD CONSTRAINT "BriefComment_briefVersionId_fkey" FOREIGN KEY ("briefVersionId") REFERENCES "BriefVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
