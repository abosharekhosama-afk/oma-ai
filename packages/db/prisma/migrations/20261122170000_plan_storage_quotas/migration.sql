-- Plan storage quotas: Starter (regular) 5 GB, Pro 20 GB. Agency unchanged (200 GB).
-- Keyed by plan code so it works whatever ids the rows were seeded with.
-- Per-workspace super-admin overrides (WorkspaceStorageSetting.adminStorageLimitBytes,
-- WorkspaceUsageOverride) are left untouched.
INSERT INTO "PlanLimit" ("id", "planId", "key", "valueJson")
SELECT 'PLIM_STORAGE_' || p."code", p."id", 'storage_bytes',
       CASE p."code" WHEN 'starter' THEN '5368709120' WHEN 'pro' THEN '21474836480' END
FROM "Plan" p
WHERE p."code" IN ('starter', 'pro')
ON CONFLICT ("planId", "key") DO UPDATE SET "valueJson" = EXCLUDED."valueJson";
