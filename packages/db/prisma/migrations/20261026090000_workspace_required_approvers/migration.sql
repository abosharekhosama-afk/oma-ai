-- Planable approval policy: number of distinct approvers required under the REQUIRED policy.
ALTER TABLE "WorkspaceSetting" ADD COLUMN IF NOT EXISTS "requiredApprovers" INTEGER NOT NULL DEFAULT 1;
-- Normalise legacy browser-only values ('multi_level') to the persisted policy set.
UPDATE "WorkspaceSetting" SET "approvalMode" = 'required' WHERE "approvalMode" = 'multi_level';
