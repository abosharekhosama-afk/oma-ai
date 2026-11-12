import { describe, expect, it } from 'vitest';
import { buildBrandContext } from '@oma/domain';

describe('brand catalog context from approved profile', () => {
  it('feeds catalog summaries into content/strategy brand context', () => {
    const ctx = buildBrandContext({
      tenantId: 't1',
      brandId: 'b1',
      brandName: 'Acme',
      profile: {
        id: 'p1',
        tenantId: 't1',
        brandId: 'b1',
        status: 'APPROVED',
        sectionsJson: JSON.stringify({
          catalog: {
            products: { summary: 'Acme Widget Pro; Gadget Lite' },
            services: { summary: 'Installation' },
          },
        }),
      },
      claims: [],
    });
    expect(ctx.usedApprovedProfile).toBe(true);
    expect(ctx.products).toMatch(/Widget/);
    expect(ctx.services).toMatch(/Installation/);
  });
});
