import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getPrisma } from '@oma/db';
import {
  authHeaders,
  createBrand,
  createStrategy,
  seedBrandTenant,
} from '../helpers/strategy-test';

describe('strategy competitor no egress', () => {
  let seed: Awaited<ReturnType<typeof seedBrandTenant>>;

  beforeAll(async () => {
    seed = await seedBrandTenant();
  });

  afterAll(async () => {
    await seed.app.close();
  });

  it('stores competitor locally without outbound research job or crawl', async () => {
    const { body: brand } = await createBrand(seed);
    const brandId = brand.data.id as string;
    const { body: created } = await createStrategy(seed, brandId);
    const strategyId = created.data.id as string;
    const versionId = created.data.latest_version.id as string;

    const jobsBefore = await getPrisma().jobRun.count({
      where: { tenantId: seed.tenantId },
    });

    const res = await fetch(
      `${seed.baseUrl}/api/v1/brands/${brandId}/strategies/${strategyId}/versions/${versionId}/competitors`,
      {
        method: 'POST',
        headers: authHeaders(seed),
        body: JSON.stringify({
          title: 'Rival Co',
          source_url: 'https://rival.example/about',
          source_note: 'Manual capture — no live crawl',
          info_class: 'USER_AUTHORED',
        }),
      },
    );
    expect([200, 201]).toContain(res.status);
    const body = await res.json();
    expect(body.data.title).toBe('Rival Co');

    const jobsAfter = await getPrisma().jobRun.count({
      where: { tenantId: seed.tenantId },
    });
    expect(jobsAfter).toBe(jobsBefore);

    const row = await getPrisma().strategyCompetitorReference.findUniqueOrThrow({
      where: { id: body.data.id },
    });
    expect(row.sourceUrl).toBe('https://rival.example/about');
    expect(row.infoClass).toBe('USER_AUTHORED');
  });

  it('AI propose refuses rather than fabricating competitor research', async () => {
    const { body: brand } = await createBrand(seed);
    const { body: created } = await createStrategy(seed, brand.data.id);
    const res = await fetch(
      `${seed.baseUrl}/api/v1/brands/${brand.data.id}/strategies/${created.data.id}/versions/${created.data.latest_version.id}/ai/propose`,
      { method: 'POST', headers: authHeaders(seed), body: '{}' },
    );
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(['AI_NOT_CONFIGURED', 'AI_REFUSED', 'AI_UNAVAILABLE']).toContain(body.error.code);
  });
});
