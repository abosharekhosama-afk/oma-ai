-- Internal analytics capability: grant analytics.read to every active team membership that
-- currently holds a profile that now includes it (owners, admins, writers, approvers, members, viewers).
-- Idempotent: skips memberships that already have an active analytics.read grant.
INSERT INTO "CapabilityGrant" ("id", "membershipId", "tenantId", "capabilityCode", "sourceProfileCode", "grantedAt")
SELECT DISTINCT ON (g."membershipId")
  'mig_analytics_' || g."membershipId",
  g."membershipId",
  g."tenantId",
  'analytics.read',
  g."sourceProfileCode",
  NOW()
FROM "CapabilityGrant" g
WHERE g."revokedAt" IS NULL
  AND g."sourceProfileCode" IN ('PLATFORM_OWNER', 'COMPANY_OWNER', 'ADMIN', 'WRITER', 'APPROVER', 'MEMBER', 'VIEWER')
  AND NOT EXISTS (
    SELECT 1 FROM "CapabilityGrant" x
    WHERE x."membershipId" = g."membershipId"
      AND x."capabilityCode" = 'analytics.read'
      AND x."revokedAt" IS NULL
  )
ORDER BY g."membershipId", g."grantedAt";

-- Keep seeded system profiles in sync with SYSTEM_PROFILES.
UPDATE "CapabilityProfile"
SET "capabilityCodes" = array_append("capabilityCodes", 'analytics.read')
WHERE "isSystem" = true
  AND "tenantId" IS NULL
  AND "code" IN ('PLATFORM_OWNER', 'COMPANY_OWNER', 'ADMIN', 'WRITER', 'APPROVER', 'MEMBER', 'VIEWER')
  AND NOT ('analytics.read' = ANY ("capabilityCodes"));
