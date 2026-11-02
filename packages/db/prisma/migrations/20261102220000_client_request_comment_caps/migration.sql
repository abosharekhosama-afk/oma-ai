-- Client guests need request.create + content.update (comments) without elevating to EDITOR.
-- Sync system CLIENT profile and grant the new caps to existing CLIENT memberships (idempotent).

UPDATE "CapabilityProfile"
SET "capabilityCodes" = (
  SELECT ARRAY(
    SELECT DISTINCT c
    FROM unnest(
      "capabilityCodes" || ARRAY['content.update', 'request.read', 'request.create']::text[]
    ) AS c
  )
)
WHERE "isSystem" = true
  AND "tenantId" IS NULL
  AND "code" = 'CLIENT';

INSERT INTO "CapabilityGrant" ("id", "membershipId", "tenantId", "capabilityCode", "sourceProfileCode", "grantedAt")
SELECT
  'mig_client_' || g."membershipId" || '_' || v.cap,
  g."membershipId",
  g."tenantId",
  v.cap,
  'CLIENT',
  NOW()
FROM (
  SELECT DISTINCT ON (g."membershipId")
    g."membershipId",
    g."tenantId"
  FROM "CapabilityGrant" g
  WHERE g."revokedAt" IS NULL
    AND g."sourceProfileCode" = 'CLIENT'
  ORDER BY g."membershipId", g."grantedAt"
) g
CROSS JOIN (
  VALUES
    ('content.update'),
    ('request.read'),
    ('request.create')
) AS v(cap)
WHERE NOT EXISTS (
  SELECT 1 FROM "CapabilityGrant" x
  WHERE x."membershipId" = g."membershipId"
    AND x."capabilityCode" = v.cap
    AND x."revokedAt" IS NULL
);
