-- Offline-ready text intelligence runs. No secrets or raw prompts.

CREATE TYPE "AiRunStatus" AS ENUM (
  'QUEUED',
  'RUNNING',
  'SUCCEEDED',
  'FAILED',
  'CANCELLED',
  'DISABLED',
  'SCHEMA_INVALID',
  'REFUSED'
);

CREATE TABLE "AiRun" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "useCase" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "promptVersion" TEXT NOT NULL,
  "schemaVersion" TEXT NOT NULL,
  "sourceEntityType" TEXT NOT NULL,
  "sourceEntityId" TEXT NOT NULL,
  "sourceVersion" TEXT NOT NULL,
  "status" "AiRunStatus" NOT NULL DEFAULT 'DISABLED',
  "idempotencyKey" TEXT NOT NULL,
  "correlationId" TEXT,
  "inputHash" TEXT NOT NULL,
  "outputHash" TEXT,
  "inputTokens" INTEGER NOT NULL DEFAULT 0,
  "outputTokens" INTEGER NOT NULL DEFAULT 0,
  "estimatedCost" TEXT NOT NULL DEFAULT '0',
  "reservedCost" TEXT NOT NULL DEFAULT '0',
  "settledCost" TEXT NOT NULL DEFAULT '0',
  "latencyMs" INTEGER,
  "errorCode" TEXT,
  "refusalReason" TEXT,
  "proposalJson" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiRun_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AiRun_tenantId_idempotencyKey_key" ON "AiRun"("tenantId", "idempotencyKey");
CREATE INDEX "AiRun_tenantId_createdAt_idx" ON "AiRun"("tenantId", "createdAt");
CREATE INDEX "AiRun_tenantId_status_idx" ON "AiRun"("tenantId", "status");

ALTER TABLE "AiRun" ADD CONSTRAINT "AiRun_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
