-- CreateEnum
CREATE TYPE "ScanAnalysisStatus" AS ENUM ('NOT_REQUESTED', 'QUEUED', 'ANALYZING', 'ANALYZED', 'FAILED', 'SKIPPED');

-- AlterTable
ALTER TABLE "ScanAttempt" ADD COLUMN "analysisStatus" "ScanAnalysisStatus" NOT NULL DEFAULT 'NOT_REQUESTED';
ALTER TABLE "ScanAttempt" ADD COLUMN "analysisErrorCode" TEXT;

-- AlterTable
ALTER TABLE "ProfileVersion" ADD COLUMN "analysisStatus" "ScanAnalysisStatus" NOT NULL DEFAULT 'NOT_REQUESTED';

-- AlterTable
ALTER TABLE "InsightClaim" ADD COLUMN "confidence" DOUBLE PRECISION;
