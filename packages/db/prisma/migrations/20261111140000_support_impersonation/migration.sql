-- CreateTable
CREATE TABLE "SupportImpersonationSession" (
    "id" TEXT NOT NULL,
    "supportUserId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sessionId" TEXT,
    "reason" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "endedReason" TEXT,

    CONSTRAINT "SupportImpersonationSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SupportImpersonationSession_sessionId_key" ON "SupportImpersonationSession"("sessionId");

-- CreateIndex
CREATE INDEX "SupportImpersonationSession_supportUserId_endedAt_idx" ON "SupportImpersonationSession"("supportUserId", "endedAt");

-- CreateIndex
CREATE INDEX "SupportImpersonationSession_targetUserId_idx" ON "SupportImpersonationSession"("targetUserId");

-- CreateIndex
CREATE INDEX "SupportImpersonationSession_tenantId_startedAt_idx" ON "SupportImpersonationSession"("tenantId", "startedAt");

-- AddForeignKey
ALTER TABLE "SupportImpersonationSession" ADD CONSTRAINT "SupportImpersonationSession_supportUserId_fkey" FOREIGN KEY ("supportUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportImpersonationSession" ADD CONSTRAINT "SupportImpersonationSession_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportImpersonationSession" ADD CONSTRAINT "SupportImpersonationSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportImpersonationSession" ADD CONSTRAINT "SupportImpersonationSession_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE SET NULL ON UPDATE CASCADE;
