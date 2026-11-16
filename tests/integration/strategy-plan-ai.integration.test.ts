import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getPrisma } from '@oma/db';
import { newId } from '@oma/domain';
import {
  authHeaders,
  bringToApproved,
  createBrand,
  createStrategy,
  seedApprovedProfileVersion,
  seedBothTracksReadyStrategy,
  seedBrandTenant,
  type BrandSeed,
} from '../helpers/strategy-test';

type Row = Record<string, unknown>;
type ProposeResponse = {
  data: {
    mode: 'ai' | 'template';
    run_id: string | null;
    tracks: string[];
    requires_acceptance: boolean;
    auto_approved: boolean;
    brand_profile_version_id: string;
    proposal: {
      organic: { pillars: Row[]; seo_keywords: Row[]; content_gaps: Row[] } | null;
      paid: { allocations: Row[]; audiences: Row[]; experiments: Row[] } | null;
    };
  };
  error: { code: string; message_key: string; details: Array<Record<string, unknown>> };
};
type PlanResponse = {
  data: {
    status: string;
    row_version: number;
    ai_run_ids: string[];
    organic: { pillars: Row[]; seo_keywords: Row[] };
    paid: { allocations: Row[]; audiences: Row[]; experiments: Row[] };
  };
  error: { code: string; message_key: string };
};

function base(seed: BrandSeed, brandId: string, strategyId: string, versionId: string) {
  return `${seed.baseUrl}/api/v1/brands/${brandId}/strategies/${strategyId}/versions/${versionId}/plan`;
}

async function post<T>(seed: BrandSeed, url: string, body: unknown, headers: Row = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { ...authHeaders(seed), ...headers } as Record<string, string>,
    body: JSON.stringify(body),
  });
  return { res, body: (await res.json()) as T };
}

async function getPlan(seed: BrandSeed, url: string) {
  const res = await fetch(url, { headers: { cookie: authHeaders(seed).cookie } });
  return { res, body: (await res.json()) as PlanResponse };
}

describe('strategy plan AI generation (proposals only)', () => {
  const closers: Array<() => Promise<void>> = [];
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of ['AI_TEST_ADAPTER', 'AI_LIVE_ENABLED', 'STRATEGY_AI_MODE'])
      saved[k] = process.env[k];
    process.env.AI_TEST_ADAPTER = '1';
    process.env.AI_LIVE_ENABLED = 'false';
    process.env.STRATEGY_AI_MODE = 'live';
  });
  afterEach(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });
  afterAll(async () => {
    for (const c of closers) await c();
  });

  async function setup() {
    const seed = await seedBrandTenant();
    closers.push(async () => seed.app.close());
    const { body: brandBody } = await createBrand(seed);
    const brandId = brandBody.data.id as string;
    const ready = await seedBothTracksReadyStrategy(seed, brandId);
    return { seed, brandId, ...ready, url: base(seed, brandId, ready.strategyId, ready.versionId) };
  }

  it('proposes both tracks without writing, then applies only on explicit accept', async () => {
    const ctx = await setup();
    const proposed = await post<ProposeResponse>(
      ctx.seed,
      `${ctx.url}/ai/propose`,
      {},
      { 'Idempotency-Key': `plan-${newId()}` },
    );
    expect([200, 201]).toContain(proposed.res.status);
    expect(proposed.body.data).toMatchObject({
      mode: 'ai',
      requires_acceptance: true,
      auto_approved: false,
      tracks: ['organic', 'paid'],
    });
    expect(proposed.body.data.run_id).toBeTruthy();
    expect(proposed.body.data.proposal.organic!.pillars.length).toBeGreaterThan(0);
    expect(proposed.body.data.proposal.paid!.allocations.length).toBeGreaterThan(0);
    expect(proposed.body.data.proposal.organic!.pillars[0]).toMatchObject({
      info_class: 'AI_PROPOSAL',
      source: 'AI_ESTIMATE',
    });

    const untouched = await getPlan(ctx.seed, ctx.url);
    expect(untouched.body.data.organic.pillars).toEqual([]);
    expect(untouched.body.data.row_version).toBe(ctx.rowVersion);

    const stale = await post<PlanResponse>(ctx.seed, `${ctx.url}/ai/accept`, {
      run_id: proposed.body.data.run_id,
      row_version: ctx.rowVersion - 1,
    });
    expect(stale.res.status).toBe(409);

    const accepted = await post<PlanResponse>(ctx.seed, `${ctx.url}/ai/accept`, {
      run_id: proposed.body.data.run_id,
      row_version: ctx.rowVersion,
    });
    expect([200, 201]).toContain(accepted.res.status);
    expect(accepted.body.data.status).toBe('DRAFT');
    expect(accepted.body.data.row_version).toBe(ctx.rowVersion + 1);
    expect(accepted.body.data.ai_run_ids).toEqual([proposed.body.data.run_id]);
    expect(accepted.body.data.organic.pillars[0]).toMatchObject({ info_class: 'AI_PROPOSAL' });
    expect(accepted.body.data.paid.audiences.length).toBeGreaterThan(0);

    const audit = await getPrisma().auditEvent.findFirst({
      where: { targetId: ctx.versionId, action: 'strategy.plan.ai_proposal_accepted' },
    });
    expect(audit?.afterRef).toBe(`ai_run:${proposed.body.data.run_id}`);
  });

  it('accepts a single track from a two-track proposal', async () => {
    const ctx = await setup();
    const proposed = await post<ProposeResponse>(ctx.seed, `${ctx.url}/ai/propose`, {});
    const accepted = await post<PlanResponse>(ctx.seed, `${ctx.url}/ai/accept`, {
      run_id: proposed.body.data.run_id,
      row_version: ctx.rowVersion,
      tracks: ['organic'],
    });
    expect([200, 201]).toContain(accepted.res.status);
    expect(accepted.body.data.organic.pillars.length).toBeGreaterThan(0);
    expect(accepted.body.data.paid.allocations).toEqual([]);
  });

  it('auto-splits by enabled tracks: organic-only strategy gets no paid plan', async () => {
    const seed = await seedBrandTenant();
    closers.push(async () => seed.app.close());
    const { body: brandBody } = await createBrand(seed);
    const brandId = brandBody.data.id as string;
    await seedApprovedProfileVersion(seed.tenantId, brandId);
    const { body: created } = await createStrategy(seed, brandId, {
      organic_enabled: true,
      paid_enabled: false,
    });
    const url = base(seed, brandId, created.data.id, created.data.latest_version.id);
    const proposed = await post<ProposeResponse>(seed, `${url}/ai/propose`, {});
    expect([200, 201]).toContain(proposed.res.status);
    expect(proposed.body.data.tracks).toEqual(['organic']);
    expect(proposed.body.data.proposal.paid).toBeNull();

    const paidOnly = await post<ProposeResponse>(seed, `${url}/ai/propose`, { tracks: ['paid'] });
    expect(paidOnly.res.status).toBe(409);
    expect(paidOnly.body.error.message_key).toBe('errors.strategy_track_disabled');
  });

  it('offers an honest template fallback when AI is refused', async () => {
    const ctx = await setup();
    process.env.STRATEGY_AI_MODE = 'refuse';
    const refused = await post<ProposeResponse>(ctx.seed, `${ctx.url}/ai/propose`, {});
    expect(refused.res.status).toBe(503);
    expect(refused.body.error.details[0]).toMatchObject({ fallback: 'template' });

    const template = await post<ProposeResponse>(ctx.seed, `${ctx.url}/ai/propose`, {
      mode: 'template',
    });
    expect([200, 201]).toContain(template.res.status);
    expect(template.body.data.mode).toBe('template');
    expect(template.body.data.run_id).toBeNull();
    expect(template.body.data.proposal.organic!.pillars[0]).toMatchObject({
      source: 'DETERMINISTIC',
    });
    const kw = template.body.data.proposal.organic!.seo_keywords;
    expect(kw.every((k) => k.monthly_volume == null)).toBe(true);
  });

  it('requires an APPROVED brand profile and a draft version', async () => {
    const ctx = await setup();
    const proposed = await post<ProposeResponse>(ctx.seed, `${ctx.url}/ai/propose`, {});
    const plan = await getPlan(ctx.seed, ctx.url);
    await bringToApproved(
      ctx.seed,
      ctx.brandId,
      ctx.strategyId,
      ctx.versionId,
      plan.body.data.row_version,
    );
    const frozen = await post<ProposeResponse>(ctx.seed, `${ctx.url}/ai/propose`, {});
    expect(frozen.res.status).toBe(409);
    const late = await post<PlanResponse>(ctx.seed, `${ctx.url}/ai/accept`, {
      run_id: proposed.body.data.run_id,
      row_version: plan.body.data.row_version + 2,
    });
    expect(late.res.status).toBe(409);

    const other = await setup();
    await getPrisma().brandWorkspace.update({
      where: { id: other.brandId },
      data: { currentApprovedProfileVersionId: null },
    });
    await getPrisma().profileVersion.updateMany({
      where: { brandId: other.brandId, tenantId: other.seed.tenantId },
      data: { status: 'SUPERSEDED' },
    });
    const gated = await post<ProposeResponse>(other.seed, `${other.url}/ai/propose`, {});
    expect(gated.res.status).toBe(403);
    expect(gated.body.error.code).toBe('BRAND_PROFILE_NOT_APPROVED');
  });

  it('does not accept runs from another version or tenant', async () => {
    const a = await setup();
    const b = await setup();
    const proposed = await post<ProposeResponse>(a.seed, `${a.url}/ai/propose`, {});
    const foreign = await post<PlanResponse>(b.seed, `${b.url}/ai/accept`, {
      run_id: proposed.body.data.run_id,
      row_version: b.rowVersion,
    });
    expect(foreign.res.status).toBe(404);
    const crossTenant = await post<ProposeResponse>(
      b.seed,
      base(b.seed, b.brandId, a.strategyId, a.versionId) + '/ai/propose',
      {},
    );
    expect(crossTenant.res.status).toBe(404);
  });
});
