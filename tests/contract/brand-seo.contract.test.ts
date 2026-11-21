import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { authHeaders, createBrand, seedBrandTenant } from '../helpers/brand-test';

describe('brand SEO contract', () => {
  let seed: Awaited<ReturnType<typeof seedBrandTenant>>;
  let app: INestApplication;

  beforeAll(async () => {
    process.env.BRAND_GSC_MODE = 'fixture';
    seed = await seedBrandTenant();
    app = seed.app;
  });

  afterAll(async () => app.close());

  it('returns stable JSON shapes for health, research, and analytics', async () => {
    const { body: brand } = await createBrand(seed);
    const brandId = brand.data.id as string;

    const health = await (
      await fetch(`${seed.baseUrl}/api/v1/brands/${brandId}/seo/health`, {
        headers: authHeaders(seed),
      })
    ).json();
    expect(health.data).toMatchObject({
      audit: null,
      search_console: expect.objectContaining({
        status: expect.any(String),
        gsc_mode: 'fixture',
      }),
    });

    const kw = await (
      await fetch(`${seed.baseUrl}/api/v1/brands/${brandId}/seo/keywords/research`, {
        method: 'POST',
        headers: authHeaders(seed),
        body: JSON.stringify({ keywords: [{ keyword: 'test', locale: 'en' }] }),
      })
    ).json();
    expect(kw.data.metrics[0]).toMatchObject({
      keyword: 'test',
      locale: 'en',
      source: 'EXTERNAL',
    });
    expect(kw.data.measured).toBe(true);

    await fetch(`${seed.baseUrl}/api/v1/brands/${brandId}/seo/search-console/connect-fixture`, {
      method: 'POST',
      headers: authHeaders(seed),
      body: JSON.stringify({ site_url: 'https://contract.test/' }),
    });
    await fetch(`${seed.baseUrl}/api/v1/brands/${brandId}/seo/search-console/sync`, {
      method: 'POST',
      headers: authHeaders(seed),
    });

    const analytics = await (
      await fetch(`${seed.baseUrl}/api/v1/brands/${brandId}/seo/analytics?period=30`, {
        headers: authHeaders(seed),
      })
    ).json();
    expect(analytics.data).toMatchObject({
      period_days: 30,
      totals: expect.objectContaining({
        gsc_clicks: expect.any(Number),
        gsc_impressions: expect.any(Number),
        published_posts: expect.any(Number),
      }),
      search_queries: expect.any(Array),
      metric_sources: expect.any(Object),
    });
  });
});