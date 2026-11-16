-- Phase 3 · PR 3.2: unified AI run ledger (DEC-027).
ALTER TABLE "AiRun" ADD COLUMN "attemptCount" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "AiRun" ADD COLUMN "failureStage" TEXT;
ALTER TABLE "AiRun" ADD COLUMN "contractId" TEXT;
