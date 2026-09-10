import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  authHeaders,
  createBrand,
  createEvidenceLink,
  createStrategy,
  openEvidenceLink,
  seedBrandTenant,
  seedEvidenceExcerpt,
} from '../helpers/strategy-test';

describe('strategy evidence reauth', () => {
  let owner: Awaited<ReturnType<typeof seedBrandTenant>>;
  let other: Awaited<ReturnType<typeof seedBrandTenant>>;
  let brandId: string;
  let strategyId: string;
  let versionId: string;
  let linkId: string;

  beforeAll(async () => {
    owner = await seedBrandTenant({ tenantSlug: `ev-a-${Date.now()}` });
    other = await seedBrandTenant({ tenantSlug: `ev-b-${Date.now()}` });
    const { body: brand } = await createBrand(owner);
    brandId = brand.data.id as string;
    const { body: created } = await createStrategy(owner, brandId, { name: 'Evidence Strat' });
    strategyId = created.data.id as string;
    versionId = created.data.latest_version.id as string;
    const excerptId = await seedEvidenceExcerpt(owner.tenantId, brandId, owner.userId);
    const link = await createEvidenceLink(owner, brandId, strategyId, versionId, {
      evidence_excerpt_id: excerptId,
      label: 'About page',
    });
    linkId = link.body.data.id as string;
  });

  afterAll(async () => {
    await owner.app.close();
    await other.app.close();
  });

  it('open evidence link requires auth', async () => {
    const { res } = await openEvidenceLink(owner, brandId, strategyId, versionId, linkId, {});
    expect([401, 403]).toContain(res.status);
  });

  it('cross-tenant evidence open returns 404', async () => {
    const { res, body } = await openEvidenceLink(other, brandId, strategyId, versionId, linkId, {
      cookie: authHeaders(other).cookie,
    });
    expect(res.status).toBe(404);
    expect(body.error?.code).toBe('NOT_FOUND');
  });

  it('same-tenant open returns seeded excerpt', async () => {
    const { res, body } = await openEvidenceLink(owner, brandId, strategyId, versionId, linkId);
    expect(res.status).toBe(200);
    expect(body.data.excerpt?.excerpt_text).toContain('Evidence excerpt');
    expect(body.data.label).toBe('About page');
  });
});
