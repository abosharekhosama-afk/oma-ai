-- Brief capabilities (DEC-019). Sync system profiles and grant the new caps to existing
-- memberships that hold the matching system profile (idempotent; never revokes anything).

CREATE TEMP TABLE "_brief_caps" ("profile" TEXT NOT NULL, "cap" TEXT NOT NULL);
INSERT INTO "_brief_caps" ("profile", "cap") VALUES
    ('PLATFORM_OWNER', 'brief.read'),
    ('PLATFORM_OWNER', 'brief.create'),
    ('PLATFORM_OWNER', 'brief.edit'),
    ('PLATFORM_OWNER', 'brief.submit'),
    ('PLATFORM_OWNER', 'brief.approve'),
    ('PLATFORM_OWNER', 'brief.convert'),
    ('PLATFORM_OWNER', 'brief.comment'),
    ('COMPANY_OWNER', 'brief.read'),
    ('COMPANY_OWNER', 'brief.create'),
    ('COMPANY_OWNER', 'brief.edit'),
    ('COMPANY_OWNER', 'brief.submit'),
    ('COMPANY_OWNER', 'brief.approve'),
    ('COMPANY_OWNER', 'brief.convert'),
    ('COMPANY_OWNER', 'brief.comment'),
    ('ADMIN', 'brief.read'),
    ('ADMIN', 'brief.create'),
    ('ADMIN', 'brief.edit'),
    ('ADMIN', 'brief.submit'),
    ('ADMIN', 'brief.approve'),
    ('ADMIN', 'brief.convert'),
    ('ADMIN', 'brief.comment'),
    ('WRITER', 'brief.read'),
    ('WRITER', 'brief.create'),
    ('WRITER', 'brief.edit'),
    ('WRITER', 'brief.submit'),
    ('WRITER', 'brief.comment'),
    ('WRITER', 'brief.convert'),
    ('APPROVER', 'brief.read'),
    ('APPROVER', 'brief.approve'),
    ('APPROVER', 'brief.comment'),
    ('MEMBER', 'brief.read'),
    ('MEMBER', 'brief.create'),
    ('MEMBER', 'brief.edit'),
    ('MEMBER', 'brief.submit'),
    ('MEMBER', 'brief.comment'),
    ('CLIENT', 'brief.read'),
    ('CLIENT', 'brief.approve'),
    ('CLIENT', 'brief.comment'),
    ('GUEST', 'brief.read'),
    ('VIEWER', 'brief.read');

UPDATE "CapabilityProfile" p
SET "capabilityCodes" = (
  SELECT ARRAY(
    SELECT DISTINCT c
    FROM unnest(p."capabilityCodes" || ARRAY(SELECT b."cap" FROM "_brief_caps" b WHERE b."profile" = p."code")) AS c
  )
)
WHERE p."isSystem" = true
  AND p."tenantId" IS NULL
  AND p."code" IN (SELECT DISTINCT "profile" FROM "_brief_caps");

INSERT INTO "CapabilityGrant" ("id", "membershipId", "tenantId", "capabilityCode", "sourceProfileCode", "grantedAt")
SELECT
  'mig_brief_' || md5(m."membershipId" || ':' || b."cap"),
  m."membershipId",
  m."tenantId",
  b."cap",
  m."profile",
  NOW()
FROM (
  SELECT DISTINCT ON (g."membershipId", g."sourceProfileCode")
    g."membershipId",
    g."tenantId",
    g."sourceProfileCode" AS "profile"
  FROM "CapabilityGrant" g
  WHERE g."revokedAt" IS NULL
    AND g."sourceProfileCode" IN (SELECT DISTINCT "profile" FROM "_brief_caps")
  ORDER BY g."membershipId", g."sourceProfileCode", g."grantedAt"
) m
JOIN "_brief_caps" b ON b."profile" = m."profile"
WHERE NOT EXISTS (
  SELECT 1 FROM "CapabilityGrant" x
  WHERE x."membershipId" = m."membershipId"
    AND x."capabilityCode" = b."cap"
    AND x."revokedAt" IS NULL
)
ON CONFLICT ("id") DO NOTHING;

DROP TABLE "_brief_caps";
