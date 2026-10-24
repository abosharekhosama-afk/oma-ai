-- Production brief readiness fields on WorkRequest (Option B).
-- READY when objective, audience, and key message are non-empty (briefReadyAt set by the API).

ALTER TABLE "WorkRequest" ADD COLUMN IF NOT EXISTS "briefObjectiveEn" TEXT NOT NULL DEFAULT '';
ALTER TABLE "WorkRequest" ADD COLUMN IF NOT EXISTS "briefObjectiveAr" TEXT NOT NULL DEFAULT '';
ALTER TABLE "WorkRequest" ADD COLUMN IF NOT EXISTS "briefAudienceEn" TEXT NOT NULL DEFAULT '';
ALTER TABLE "WorkRequest" ADD COLUMN IF NOT EXISTS "briefAudienceAr" TEXT NOT NULL DEFAULT '';
ALTER TABLE "WorkRequest" ADD COLUMN IF NOT EXISTS "briefKeyMessageEn" TEXT NOT NULL DEFAULT '';
ALTER TABLE "WorkRequest" ADD COLUMN IF NOT EXISTS "briefKeyMessageAr" TEXT NOT NULL DEFAULT '';
ALTER TABLE "WorkRequest" ADD COLUMN IF NOT EXISTS "briefReadyAt" TIMESTAMP(3);
