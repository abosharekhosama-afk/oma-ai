-- Multi-level approval (DEC-026): ordered levels, frozen per-round plan, per-level decisions.

-- AlterTable
ALTER TABLE "ContentItem" ADD COLUMN "approvalLevels" JSONB,
ADD COLUMN "approvalRoundStartedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ApprovalLevel" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "brandId" TEXT,
    "position" INTEGER NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "minApprovals" INTEGER NOT NULL DEFAULT 1,
    "approverUserIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprovalLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentApprovalDecision" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "roundStartedAt" TIMESTAMP(3) NOT NULL,
    "levelPosition" INTEGER NOT NULL,
    "approverUserId" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "noteEn" TEXT,
    "noteAr" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentApprovalDecision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ApprovalLevel_tenantId_brandId_position_idx" ON "ApprovalLevel"("tenantId", "brandId", "position");

-- CreateIndex
CREATE INDEX "ContentApprovalDecision_tenantId_contentId_idx" ON "ContentApprovalDecision"("tenantId", "contentId");

-- CreateIndex
CREATE UNIQUE INDEX "ContentApprovalDecision_contentId_roundStartedAt_levelPosit_key" ON "ContentApprovalDecision"("contentId", "roundStartedAt", "levelPosition", "approverUserId");

-- AddForeignKey
ALTER TABLE "ContentApprovalDecision" ADD CONSTRAINT "ContentApprovalDecision_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "ContentItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
