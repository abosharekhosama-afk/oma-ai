-- DEC-029 PR 4.1: v2 is the single organic plan model.
-- 1) Per-channel cadence table.
-- 2) Backfill v2 content pillars + cadence from legacy StrategyOrganicTrack JSON
--    (only for versions that have no v2 rows yet). Legacy columns stay for one release.

CREATE TABLE "StrategyChannelCadence" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "strategyVersionId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "postsPerWeek" INTEGER NOT NULL,
    "formats" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "infoClass" "StrategyInfoClass" NOT NULL DEFAULT 'USER_AUTHORED',
    "source" "StrategyDataSource" NOT NULL DEFAULT 'MANUAL',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StrategyChannelCadence_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StrategyChannelCadence_tenantId_strategyVersionId_idx" ON "StrategyChannelCadence"("tenantId", "strategyVersionId");
CREATE UNIQUE INDEX "StrategyChannelCadence_strategyVersionId_channel_key" ON "StrategyChannelCadence"("strategyVersionId", "channel");
ALTER TABLE "StrategyChannelCadence" ADD CONSTRAINT "StrategyChannelCadence_strategyVersionId_fkey" FOREIGN KEY ("strategyVersionId") REFERENCES "StrategyVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Tolerant JSON-array label reader (strings or {value|name|label}); invalid JSON -> empty.
CREATE OR REPLACE FUNCTION pg_temp.oma_legacy_labels(raw TEXT)
RETURNS TABLE(label TEXT, ord BIGINT) LANGUAGE plpgsql AS $$
DECLARE doc JSONB;
BEGIN
  BEGIN
    doc := raw::jsonb;
  EXCEPTION WHEN others THEN
    RETURN;
  END;
  IF doc IS NULL OR jsonb_typeof(doc) <> 'array' THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT btrim(CASE jsonb_typeof(e.value)
             WHEN 'string' THEN e.value #>> '{}'
             ELSE COALESCE(e.value ->> 'value', e.value ->> 'name', e.value ->> 'label')
           END) AS label,
           e.ord
    FROM jsonb_array_elements(doc) WITH ORDINALITY AS e(value, ord);
END;
$$;

INSERT INTO "StrategyContentPillar"
  ("id", "tenantId", "brandId", "strategyVersionId", "key", "nameEn", "nameAr", "sortOrder")
SELECT gen_random_uuid()::text, t."tenantId", t."brandId", t."strategyVersionId",
       'legacy-' || l.rn, left(l.label, 120), left(l.label, 120), (l.rn - 1)::int
FROM "StrategyOrganicTrack" t
CROSS JOIN LATERAL (
  SELECT x.label, row_number() OVER (ORDER BY x.ord) AS rn
  FROM pg_temp.oma_legacy_labels(t."pillarsJson") x
  WHERE x.label IS NOT NULL AND x.label <> ''
) l
WHERE l.rn <= 8
  AND NOT EXISTS (
    SELECT 1 FROM "StrategyContentPillar" p WHERE p."strategyVersionId" = t."strategyVersionId"
  );

INSERT INTO "StrategyChannelCadence"
  ("id", "tenantId", "brandId", "strategyVersionId", "channel", "postsPerWeek", "formats", "infoClass", "sortOrder")
SELECT gen_random_uuid()::text, t."tenantId", t."brandId", t."strategyVersionId",
       c.channel,
       COALESCE(LEAST(28, substring(t."frequency" FROM '(\d+)')::int), 3),
       COALESCE((
         SELECT array_agg(left(f.label, 40) ORDER BY f.ord)
         FROM pg_temp.oma_legacy_labels(t."formatsJson") f
         WHERE f.label IS NOT NULL AND f.label <> '' AND f.ord <= 8
       ), ARRAY[]::TEXT[]),
       (CASE WHEN substring(t."frequency" FROM '(\d+)') IS NULL THEN 'ASSUMPTION' ELSE 'USER_AUTHORED' END)::"StrategyInfoClass",
       (c.rn - 1)::int
FROM "StrategyOrganicTrack" t
CROSS JOIN LATERAL (
  SELECT d.channel, row_number() OVER (ORDER BY d.first_ord) AS rn
  FROM (
    SELECT left(x.label, 40) AS channel, min(x.ord) AS first_ord
    FROM pg_temp.oma_legacy_labels(t."channelsJson") x
    WHERE x.label IS NOT NULL AND x.label <> ''
    GROUP BY left(x.label, 40)
  ) d
) c
WHERE c.rn <= 12
  AND NOT EXISTS (
    SELECT 1 FROM "StrategyChannelCadence" k WHERE k."strategyVersionId" = t."strategyVersionId"
  );
