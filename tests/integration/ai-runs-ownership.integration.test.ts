import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { getPrisma } from '@oma/db';
import { newId } from '@oma/domain';
import {
  authHeaders,
  createBrand,
  seedBrandTenant,
  seedEvidenceExcerpt,
  type BrandSeed,
} from '../helpers/strategy-test';

type Body = {
  data: Record<string, unknown> & {
    run?: { id: string; status: string };
    draft_id?: string | null;
    replayed?: boolean;
    status?: string;
  };
  error?: { code: string; details?: Array<Record<string, unknown>> };
};

async function post(seed: BrandSeed, path: string, body: unknown = {}) {
  const res = await fetch(`${seed.baseUrl}/api/v1/ai/${path}`, {
    method: 'POST',
    headers: authHeaders(seed) as Record<string, string>,
    body: JSON.stringify(body),
  });
  return { res, body: (await res.json()) as Body };
}

function runBody(brandId: string, extra: Record<string, unknown> = {}) {
  return {
    use_case: 'brand_profile_synthesis',
    source_entity_type: 'brand_profile',
    source_entity_id: brandId,
    source_version: 'v1',
    idempotency_key: `ai-run-${newId()}`,
    ...extra,
  };
}

describe('generic AI runs: ownership, allowed use cases, persisted review', () => {
  let a: BrandSeed;
  let b: BrandSeed;
  let brandA: string;
  let brandB: string;
  const saved: Record<string, string | undefined> = {};

  beforeAll(async () => {
    a = await seedBrandTenant();
    b = await seedBrandTenant();
    brandA = (await createBrand(a)).body.data.id as string;
    brandB = (await createBrand(b)).body.data.id as string;
  });
  afterAll(async () => {
    await a.app.close();
    await b.app.close();
  });
  beforeEach(() => {
    for (const k of ['AI_TEST_ADAPTER', 'AI_LIVE_ENABLED']) saved[k] = process.env[k];
    process.env.AI_TEST_ADAPTER = '1';
    process.env.AI_LIVE_ENABLED = 'false';
  });
  afterEach(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it('requires an authenticated session', async () => {
    const res = await fetch(`${a.baseUrl}/api/v1/ai/runs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(runBody(brandA)),
    });
    expect(res.status).toBe(401);
  });

  it('rejects use cases without a generic contract and unknown source types', async () => {
    const caption = await post(a, 'runs', runBody(brandA, { use_case: 'caption_generation' }));
    expect(caption.res.status).toBe(400);
    expect(caption.body.error?.details?.[0]).toMatchObject({ field: 'use_case' });

    const source = await post(a, 'runs', runBody(brandA, { source_entity_type: 'content' }));
    expect(source.res.status).toBe(400);
    expect(source.body.error?.details?.[0]).toMatchObject({ field: 'source_entity_type' });
  });

  it('refuses to run against a brand of another tenant', async () => {
    const res = await post(a, 'runs', runBody(brandB));
    expect(res.res.status).toBe(404);
    const runs = await getPrisma().aiRun.count({
      where: { tenantId: a.tenantId, sourceEntityId: brandB },
    });
    expect(runs).toBe(0);
  });

  it('refuses evidence refs that do not belong to the brand', async () => {
    const foreign = await seedEvidenceExcerpt(b.tenantId, brandB, b.userId);
    const res = await post(a, 'runs', runBody(brandA, { evidence_refs: [foreign] }));
    expect(res.res.status).toBe(400);
    expect(res.body.error?.details?.[0]).toMatchObject({ field: 'evidence_refs' });

    const own = await seedEvidenceExcerpt(a.tenantId, brandA, a.userId);
    const ok = await post(a, 'runs', runBody(brandA, { evidence_refs: [own, own] }));
    expect([200, 201]).toContain(ok.res.status);
  });

  it('accept never writes a draft for a brand outside the tenant', async () => {
    const created = await post(a, 'runs', runBody(brandA));
    expect([200, 201]).toContain(created.res.status);
    const runId = created.body.data.run!.id;
    // Simulate a tampered/legacy run that points at a foreign brand.
    await getPrisma().aiRun.update({ where: { id: runId }, data: { sourceEntityId: brandB } });
    const accepted = await post(a, `runs/${runId}/accept`);
    expect(accepted.res.status).toBe(404);
    const drafts = await getPrisma().profileVersion.count({
      where: { tenantId: a.tenantId, brandId: brandB },
    });
    expect(drafts).toBe(0);
  });

  it('accept is idempotent and blocks a later reject', async () => {
    const created = await post(a, 'runs', runBody(brandA));
    const runId = created.body.data.run!.id;
    const first = await post(a, `runs/${runId}/accept`);
    expect([200, 201]).toContain(first.res.status);
    expect(first.body.data.draft_id).toBeTruthy();
    expect(first.body.data.replayed).toBe(false);
    const second = await post(a, `runs/${runId}/accept`);
    expect(second.body.data.draft_id).toBe(first.body.data.draft_id);
    expect(second.body.data.replayed).toBe(true);
    const draft = await getPrisma().profileVersion.findUnique({
      where: { id: first.body.data.draft_id as string },
    });
    expect(draft).toMatchObject({ tenantId: a.tenantId, brandId: brandA, status: 'DRAFT' });
    expect(JSON.parse(draft!.sectionsJson!)).toMatchObject({
      ai_run_id: runId,
      requires_human_review: true,
    });

    const reject = await post(a, `runs/${runId}/reject`);
    expect(reject.res.status).toBe(409);
  });

  it('reject is persisted, keeps the settled cost, and blocks a later accept', async () => {
    const created = await post(a, 'runs', runBody(brandA));
    const runId = created.body.data.run!.id;
    const before = await getPrisma().aiRun.findUniqueOrThrow({ where: { id: runId } });
    const rejected = await post(a, `runs/${runId}/reject`, { reason: 'Off brand' });
    expect([200, 201]).toContain(rejected.res.status);
    expect(rejected.body.data).toMatchObject({ status: 'REFUSED', replayed: false });

    const row = await getPrisma().aiRun.findUniqueOrThrow({ where: { id: runId } });
    expect(row.refusalReason).toBe('HUMAN_REJECTED');
    expect(row.status).toBe(before.status);
    expect(row.settledCost).toBe(before.settledCost);
    expect(JSON.parse(row.metadataJson!).review).toMatchObject({
      decision: 'rejected',
      by: a.userId,
      reason: 'Off brand',
    });

    const again = await post(a, `runs/${runId}/reject`);
    expect(again.body.data.replayed).toBe(true);
    const accept = await post(a, `runs/${runId}/accept`);
    expect(accept.res.status).toBe(409);
  });

  it('another tenant cannot review the run', async () => {
    const created = await post(a, 'runs', runBody(brandA));
    const runId = created.body.data.run!.id;
    expect((await post(b, `runs/${runId}/accept`)).res.status).toBe(404);
    expect((await post(b, `runs/${runId}/reject`)).res.status).toBe(404);
  });
});
