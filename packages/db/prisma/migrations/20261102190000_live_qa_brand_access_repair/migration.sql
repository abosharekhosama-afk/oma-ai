-- Live QA Nov 02: repair multi-tenant brand visibility without wiping data.
-- 1) Contributors (MEMBER profile) need brand.read to list workspace brands.
-- 2) BrandMember ACL: when a user already has some BrandMember rows, newly created
--    brands were invisible. Backfill missing BrandMember rows for ACTIVE members
--    who do not hold tenant.manage (admins already see all brands).

INSERT INTO "CapabilityGrant" ("id", "membershipId", "tenantId", "capabilityCode", "sourceProfileCode", "grantedAt")
SELECT DISTINCT ON (g."membershipId")
  'mig_brand_read_' || g."membershipId",
  g."membershipId",
  g."tenantId",
  'brand.read',
  COALESCE(g."sourceProfileCode", 'MEMBER'),
  NOW()
FROM "CapabilityGrant" g
JOIN "Membership" m ON m."id" = g."membershipId" AND m."status" = 'ACTIVE'
WHERE g."revokedAt" IS NULL
  AND (
    g."sourceProfileCode" IN ('PLATFORM_OWNER', 'COMPANY_OWNER', 'ADMIN', 'WRITER', 'APPROVER', 'MEMBER', 'VIEWER', 'CLIENT', 'GUEST')
    OR g."capabilityCode" IN ('content.read', 'content.create', 'tenant.manage')
  )
  AND NOT EXISTS (
    SELECT 1 FROM "CapabilityGrant" x
    WHERE x."membershipId" = g."membershipId"
      AND x."capabilityCode" = 'brand.read'
      AND x."revokedAt" IS NULL
  )
ORDER BY g."membershipId", g."grantedAt";

-- Keep seeded system profiles in sync with SYSTEM_PROFILES (MEMBER now includes brand.read).
UPDATE "CapabilityProfile"
SET "capabilityCodes" = array_append("capabilityCodes", 'brand.read')
WHERE "isSystem" = true
  AND "tenantId" IS NULL
  AND "code" IN ('PLATFORM_OWNER', 'COMPANY_OWNER', 'ADMIN', 'WRITER', 'APPROVER', 'MEMBER', 'VIEWER', 'CLIENT', 'GUEST')
  AND NOT ('brand.read' = ANY ("capabilityCodes"));

-- Backfill BrandMember for every ACTIVE non-admin membership × brand in the same tenant.
INSERT INTO "BrandMember" ("id", "tenantId", "brandId", "userId", "role", "addedBy", "createdAt", "updatedAt")
SELECT
  'bm_qa_' || md5(b."id" || ':' || m."userId"),
  b."tenantId",
  b."id",
  m."userId",
  (CASE
    WHEN m."membershipKind" = 'client' THEN 'APPROVER'
    WHEN lower(coalesce(m."displayRole", '')) LIKE '%approv%' THEN 'APPROVER'
    WHEN lower(coalesce(m."displayRole", '')) IN ('viewer', 'guest') THEN 'VIEWER'
    WHEN lower(coalesce(m."displayRole", '')) IN ('owner', 'administrator', 'admin', 'manager') THEN 'MANAGER'
    ELSE 'EDITOR'
  END)::"BrandMemberRole",
  'migration-live-qa-nov02',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "BrandWorkspace" b
JOIN "Membership" m
  ON m."tenantId" = b."tenantId"
 AND m."status" = 'ACTIVE'
 AND m."userId" IS NOT NULL
WHERE b."deletedAt" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "CapabilityGrant" g
    WHERE g."membershipId" = m."id"
      AND g."capabilityCode" = 'tenant.manage'
      AND g."revokedAt" IS NULL
  )
ON CONFLICT ("brandId", "userId") DO NOTHING;
