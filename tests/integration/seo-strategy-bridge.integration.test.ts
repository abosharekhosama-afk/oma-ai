import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { getPrisma } from '@oma/db';
import { newId } from '@oma/domain';
import { authHeaders, createBrand, seedBrandTenant } from '../helpers/brand-test';
import { createStrategy } from '../helpers/strategy-test';
import { seedSucceededScanAttempt } from '../helpers/scan-fixture';

describe('SEO → organic strategy bridge', () => {
  let seed: Awaited<ReturnType<typeof seedBrandTenant>>;
  let app: INestApplication;

  beforeAll(async () => {
    process.env.BRAND_GSC_MODE = 'fixture';
    process.env.BRAND_KEYWORD_RESEARCH_MODE = 'external_fixture';
    seed = await seedBrandTenant();
    app = seed.app;
  });

  afterAll(async () => app.close());

  it('returns proposals and merges selected rows into the organic plan', async () => {
    const { body: brand } = await createBrand(seed);
    const brandId = brand.data.id as string;
    const scanId = await seedSucceededScanAttempt({
      tenantId: seed.tenantId,
      brandId,
      userId: seed.userId,
    });
    const prisma = getPrisma();
    const auditId = newId();
    await prisma.brandSeoAudit.create({
      data: {
        id: auditId,
        tenantId: seed.tenantId,
        brandId,
        scanAttemptId: scanId,
        score: 68,
        findingsCount: 1,
        metricSource: 'CRAWL',
        summaryJson: JSON.stringify({ pages: 3 }),
        findings: {
          create: {
            id: newId(),
            tenantId: seed.tenantId,
            brandId,
            pageUrl: 'https://bridge.test/about',
            code: 'SEO_META_DESC_MISSING',
            severity: 'warning',
            detail: 'missing meta',
          },
        },
      },
    });

    await fetch(`${seed.baseUrl}/api/v1/brands/${brandId}/seo/search-console/connect-fixture`, {
      method: 'POST',
      headers: authHeaders(seed),
      body: JSON.stringify({ site_url: 'https://bridge.test/' }),
    });
    await fetch(`${seed.baseUrl}/api/v1/brands/${brandId}/seo/search-console/sync`, {
      method: 'POST',
      headers: authHeaders(seed),
    });

    const proposalsRes = await fetch(
      `${seed.baseUrl}/api/v1/brands/${brandId}/seo/strategy-proposals`,
      { headers: authHeaders(seed) },
    );
    expect(proposalsRes.status).toBe(200);
    const proposals = await proposalsRes.json();
    expect(proposals.data.context.audit_score).toBe(68);
    expect(proposals.data.seo_keywords.length).toBeGreaterThan(0);
    expect(proposals.data.content_gaps.length).toBeGreaterThan(0);
    const ids = [
      proposals.data.seo_keywords[0].proposal_id,
      proposals.data.content_gaps[0].proposal_id,
    ];

    const { body: created } = await createStrategy(seed, brandId, { organic_enabled: true });
    const strategyId = created.data.id as string;
    const versionId = created.data.latest_version.id as string;

    const planRes = await fetch(
      `${seed.baseUrl}/api/v1/brands/${brandId}/strategies/${strategyId}/versions/${versionId}/plan`,
      { headers: authHeaders(seed) },
    );
    const plan = await planRes.json();
    expect(plan.data.organic.seo_keywords).toHaveLength(0);

    const mergeRes = await fetch(
      `${seed.baseUrl}/api/v1/brands/${brandId}/strategies/${strategyId}/versions/${versionId}/plan/organic/merge-seo`,
      {
        method: 'POST',
        headers: authHeaders(seed),
        body: JSON.stringify({ row_version: plan.data.row_version, proposal_ids: ids }),
      },
    );
    expect(mergeRes.status).toBe(200);
    const merged = await mergeRes.json();
    expect(merged.data.organic.seo_keywords.length).toBeGreaterThan(0);
    expect(merged.data.organic.content_gaps.length).toBeGreaterThan(0);
    const kw = merged.data.organic.seo_keywords[0];
    // Fixture Search Console rows are sample data: labelled FIXTURE, impressions kept apart
    // from market volume (DEC-029 4.0).
    expect(kw.source).toBe('FIXTURE');
    expect(kw.gsc_impressions).toBeGreaterThan(0);
    expect(kw.metric_source).not.toBe('EXTERNAL');
    if (kw.monthly_volume != null) expect(kw.metric_source).toBe('FIXTURE');
    expect(merged.data.organic.content_gaps[0].source).toBe('DETERMINISTIC');
  });
});
