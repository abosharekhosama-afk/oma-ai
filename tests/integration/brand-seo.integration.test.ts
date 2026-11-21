import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { getPrisma } from '@oma/db';
import { authHeaders, createBrand, seedBrandTenant } from '../helpers/brand-test';

describe('brand SEO visibility (integration)', () => {
  let seed: Awaited<ReturnType<typeof seedBrandTenant>>;
  let app: INestApplication;

  beforeAll(async () => {
    process.env.BRAND_GSC_MODE = 'fixture';
    process.env.BRAND_KEYWORD_RESEARCH_MODE = 'external_fixture';
    seed = await seedBrandTenant();
    app = seed.app;
  });

  afterAll(async () => {
    await app.close();
  });

  it('exposes health, keyword research, and GSC sync with fixture port', async () => {
    const { body: brand } = await createBrand(seed);
    const brandId = brand.data.id as string;

    const healthRes = await fetch(`${seed.baseUrl}/api/v1/brands/${brandId}/seo/health`, {
      headers: authHeaders(seed),
    });
    expect(healthRes.status).toBe(200);
    const health = await healthRes.json();
    expect(health.data.search_console.gsc_mode).toBe('fixture');

    const kwRes = await fetch(`${seed.baseUrl}/api/v1/brands/${brandId}/seo/keywords/research`, {
      method: 'POST',
      headers: authHeaders(seed),
      body: JSON.stringify({ keywords: [{ keyword: 'عطر فاخر', locale: 'ar' }] }),
    });
    expect(kwRes.status).toBe(200);
    const kw = await kwRes.json();
    expect(kw.data.metrics[0].monthly_volume).toBeGreaterThan(0);
    expect(kw.data.provider).toBe('external');

    await fetch(`${seed.baseUrl}/api/v1/brands/${brandId}/seo/search-console/connect-fixture`, {
      method: 'POST',
      headers: authHeaders(seed),
      body: JSON.stringify({ site_url: 'https://seo-fixture.test/' }),
    });
    const syncRes = await fetch(
      `${seed.baseUrl}/api/v1/brands/${brandId}/seo/search-console/sync`,
      {
        method: 'POST',
        headers: authHeaders(seed),
      },
    );
    expect(syncRes.status).toBe(200);

    const analyticsRes = await fetch(
      `${seed.baseUrl}/api/v1/brands/${brandId}/seo/analytics?period=30`,
      { headers: authHeaders(seed) },
    );
    expect(analyticsRes.status).toBe(200);
    const analytics = await analyticsRes.json();
    expect(analytics.data.search_queries.length).toBeGreaterThan(0);

    const globalRes = await fetch(
      `${seed.baseUrl}/api/v1/analytics/seo?brandId=${brandId}&period=30`,
      {
        headers: authHeaders(seed),
      },
    );
    expect(globalRes.status).toBe(200);

    const prisma = getPrisma();
    const rows = await prisma.keywordRankObservation.count({
      where: { tenantId: seed.tenantId, brandId },
    });
    expect(rows).toBeGreaterThan(0);
  });
});
