import { afterAll, describe, expect, it } from 'vitest';
import { getPrisma } from '@oma/db';
import {
  authHeaders,
  bringToApproved,
  createBrand,
  reviseStrategy,
  seedBothTracksReadyStrategy,
  seedBrandTenant,
  setTrackEnablement,
  type BrandSeed,
} from '../helpers/strategy-test';

const organicBody = {
  pillars: [
    { key: 'education', name_en: 'Education', name_ar: 'تثقيف', share_target_pct: 60 },
    { key: 'product', name_en: 'Product', name_ar: 'المنتج', share_target_pct: 40 },
  ],
  seo_keywords: [
    {
      keyword: 'روتين العناية بالبشرة',
      intent: 'INFORMATIONAL',
      pillar_key: 'education',
      monthly_volume: 1200,
      metric_source: 'AI_ESTIMATE',
    },
  ],
  content_gaps: [{ kind: 'MISSING_TOPIC', topic: 'Night routine guide', pillar_key: 'education' }],
};

const paidBody = {
  allocations: [
    { platform: 'INSTAGRAM', objective: 'AWARENESS', share_pct: 33 },
    { platform: 'TIKTOK', objective: 'TRAFFIC', share_pct: 33 },
    { platform: 'GOOGLE_SEARCH', objective: 'SALES', share_pct: 34 },
  ],
  audiences: [
    {
      key: 'gulf-women',
      name: 'Gulf women 25-40',
      targeting: { age_min: 25, age_max: 40, locations: ['SA', 'AE'] },
    },
  ],
  experiments: [
    {
      name: 'Hook test',
      hypothesis: 'UGC hooks beat studio hooks',
      variable: 'CREATIVE',
      audience_key: 'gulf-women',
      variants: [
        { key: 'A', description: 'UGC' },
        { key: 'B', description: 'Studio' },
      ],
      primary_metric: 'CTR',
    },
  ],
};

type Row = Record<string, unknown> & { key?: string; amount?: string | null };
type PlanResponse = {
  data: {
    row_version: number;
    editable: boolean;
    research: unknown;
    organic: { pillars: Row[]; seo_keywords: Row[]; content_gaps: Row[] };
    paid: {
      allocations: Row[];
      audiences: Row[];
      experiments: Array<Row & { variants: Row[] }>;
      allocation_total_pct: number;
    };
  };
  error: { code: string; message_key: string; details: unknown };
};

function planUrl(seed: BrandSeed, brandId: string, strategyId: string, versionId: string) {
  return `${seed.baseUrl}/api/v1/brands/${brandId}/strategies/${strategyId}/versions/${versionId}/plan`;
}

async function put(
  seed: BrandSeed,
  url: string,
  body: Record<string, unknown>,
): Promise<{ res: Response; body: PlanResponse }> {
  const res = await fetch(url, {
    method: 'PUT',
    headers: authHeaders(seed),
    body: JSON.stringify(body),
  });
  return { res, body: await res.json() };
}

async function get(seed: BrandSeed, url: string): Promise<{ res: Response; body: PlanResponse }> {
  const res = await fetch(url, { headers: { cookie: authHeaders(seed).cookie } });
  return { res, body: await res.json() };
}

describe('strategy plan v2 (organic + paid tracks)', () => {
  const closers: Array<() => Promise<void>> = [];
  afterAll(async () => {
    for (const c of closers) await c();
  });

  async function setup() {
    const seed = await seedBrandTenant();
    closers.push(async () => seed.app.close());
    const { body: brandBody } = await createBrand(seed);
    const brandId = brandBody.data.id as string;
    const ready = await seedBothTracksReadyStrategy(seed, brandId);
    return {
      seed,
      brandId,
      ...ready,
      url: planUrl(seed, brandId, ready.strategyId, ready.versionId),
    };
  }

  it('replaces organic and paid plans, splits budget, and records edits + audit', async () => {
    const ctx = await setup();
    const empty = await get(ctx.seed, ctx.url);
    expect(empty.res.status).toBe(200);
    expect(empty.body.data.organic.pillars).toEqual([]);
    expect(empty.body.data.editable).toBe(true);
    expect(empty.body.data.research).toEqual({ mode: 'manual', measured: false });

    const organic = await put(ctx.seed, `${ctx.url}/organic`, {
      row_version: ctx.rowVersion,
      ...organicBody,
    });
    expect(organic.res.status).toBe(200);
    expect(organic.body.data.row_version).toBe(ctx.rowVersion + 1);
    expect(organic.body.data.organic.pillars.map((p) => p.key)).toEqual(['education', 'product']);
    expect(organic.body.data.organic.seo_keywords[0]).toMatchObject({
      intent: 'INFORMATIONAL',
      metric_source: 'AI_ESTIMATE',
      pillar_key: 'education',
    });

    await getPrisma().strategyPaidTrack.update({
      where: { strategyVersionId: ctx.versionId },
      data: { budgetAmount: 1000, budgetCurrency: 'SAR' },
    });
    const paid = await put(ctx.seed, `${ctx.url}/paid`, {
      row_version: organic.body.data.row_version,
      ...paidBody,
    });
    expect(paid.res.status).toBe(200);
    expect(paid.body.data.paid.allocation_total_pct).toBe(100);
    expect(paid.body.data.paid.allocations.map((a) => a.amount)).toEqual([
      '330.00',
      '330.00',
      '340.00',
    ]);
    expect(paid.body.data.paid.experiments[0].variants).toHaveLength(2);

    const edits = await getPrisma().strategyHumanEdit.findMany({
      where: { strategyVersionId: ctx.versionId, fieldPath: { startsWith: 'plan.' } },
    });
    expect(edits.map((e) => e.fieldPath).sort()).toEqual(['plan.organic', 'plan.paid']);
    const audits = await getPrisma().auditEvent.findMany({
      where: { targetId: ctx.versionId, action: { startsWith: 'strategy.plan.' } },
    });
    expect(audits).toHaveLength(2);
  });

  it('rejects invariant violations with 400 and stale row_version with 409', async () => {
    const ctx = await setup();
    const bad = await put(ctx.seed, `${ctx.url}/paid`, {
      row_version: ctx.rowVersion,
      ...paidBody,
      allocations: [{ platform: 'META', objective: 'SALES', share_pct: 80 }],
    });
    expect(bad.res.status).toBe(400);
    expect(bad.body.error.message_key).toBe('errors.strategy_plan_invalid');
    expect(JSON.stringify(bad.body.error.details)).toContain('ALLOCATION_NOT_100');

    const unknownField = await put(ctx.seed, `${ctx.url}/organic`, {
      row_version: ctx.rowVersion,
      pillars: [{ key: 'a', name_en: 'A', name_ar: 'أ', bogus: true }],
    });
    expect(unknownField.res.status).toBe(400);

    const missingRow = await put(ctx.seed, `${ctx.url}/organic`, organicBody);
    expect(missingRow.res.status).toBe(400);

    const stale = await put(ctx.seed, `${ctx.url}/organic`, {
      row_version: ctx.rowVersion - 1,
      ...organicBody,
    });
    expect(stale.res.status).toBe(409);
    expect(stale.body.error.code).toBe('CONFLICT_VERSION');
  });

  it('refuses writes to a disabled track', async () => {
    const ctx = await setup();
    const toggled = await setTrackEnablement(
      ctx.seed,
      ctx.brandId,
      ctx.strategyId,
      ctx.versionId,
      ctx.rowVersion,
      { organic_enabled: true, paid_enabled: false, paid_disabled_rationale: 'Organic first' },
    );
    expect([200, 201]).toContain(toggled.res.status);
    const res = await put(ctx.seed, `${ctx.url}/paid`, {
      row_version: toggled.body.data.row_version,
      ...paidBody,
    });
    expect(res.res.status).toBe(409);
    expect(res.body.error.message_key).toBe('errors.strategy_track_disabled');
  });

  it('keeps approved versions immutable and copies the plan into a revision', async () => {
    const ctx = await setup();
    const organic = await put(ctx.seed, `${ctx.url}/organic`, {
      row_version: ctx.rowVersion,
      ...organicBody,
    });
    expect(organic.res.status).toBe(200);
    const paid = await put(ctx.seed, `${ctx.url}/paid`, {
      row_version: organic.body.data.row_version,
      ...paidBody,
    });
    const approved = await bringToApproved(
      ctx.seed,
      ctx.brandId,
      ctx.strategyId,
      ctx.versionId,
      paid.body.data.row_version,
    );
    const frozen = await put(ctx.seed, `${ctx.url}/organic`, {
      row_version: approved.rowVersion,
      ...organicBody,
    });
    expect(frozen.res.status).toBe(409);
    expect(JSON.stringify(frozen.body.error.details)).toContain('MUST_REVISE');

    const revised = await reviseStrategy(ctx.seed, ctx.brandId, ctx.strategyId, ctx.versionId);
    expect([200, 201]).toContain(revised.res.status);
    const newVersionId = (revised.body.data.latest_version?.id ?? revised.body.data.id) as string;
    expect(newVersionId).not.toBe(ctx.versionId);
    const copy = await get(ctx.seed, planUrl(ctx.seed, ctx.brandId, ctx.strategyId, newVersionId));
    expect(copy.res.status).toBe(200);
    expect(copy.body.data.editable).toBe(true);
    expect(copy.body.data.organic.pillars).toHaveLength(2);
    expect(copy.body.data.organic.seo_keywords[0].pillar_key).toBe('education');
    expect(copy.body.data.paid.audiences[0].key).toBe('gulf-women');
    expect(copy.body.data.paid.experiments[0].audience_key).toBe('gulf-women');
  });

  it('hides another tenant’s plan (404)', async () => {
    const ctx = await setup();
    const other = await seedBrandTenant();
    closers.push(async () => other.app.close());
    const { body: otherBrand } = await createBrand(other);
    const res = await get(other, planUrl(other, otherBrand.data.id, ctx.strategyId, ctx.versionId));
    expect(res.res.status).toBe(404);
    const write = await put(
      other,
      `${planUrl(other, otherBrand.data.id, ctx.strategyId, ctx.versionId)}/organic`,
      {
        row_version: ctx.rowVersion,
        ...organicBody,
      },
    );
    expect(write.res.status).toBe(404);
  });
});
