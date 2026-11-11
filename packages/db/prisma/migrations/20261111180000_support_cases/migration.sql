-- CreateEnum
CREATE TYPE "SupportCaseStatus" AS ENUM ('OPEN', 'AWAITING_SUPPORT', 'AWAITING_CUSTOMER', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "SupportCasePriority" AS ENUM ('NORMAL', 'HIGH');

-- CreateTable
CREATE TABLE "SupportCase" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" "SupportCaseStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "SupportCasePriority" NOT NULL DEFAULT 'NORMAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "SupportCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportCaseMessage" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "authorKind" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "internal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportCaseMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupportCase_tenantId_updatedAt_idx" ON "SupportCase"("tenantId", "updatedAt");

-- CreateIndex
CREATE INDEX "SupportCase_status_updatedAt_idx" ON "SupportCase"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "SupportCaseMessage_caseId_createdAt_idx" ON "SupportCaseMessage"("caseId", "createdAt");

-- AddForeignKey
ALTER TABLE "SupportCase" ADD CONSTRAINT "SupportCase_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportCase" ADD CONSTRAINT "SupportCase_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportCaseMessage" ADD CONSTRAINT "SupportCaseMessage_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "SupportCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportCaseMessage" ADD CONSTRAINT "SupportCaseMessage_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
