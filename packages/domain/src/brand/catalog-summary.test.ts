import { describe, expect, it } from 'vitest';
import { buildCatalogFieldValue } from './catalog-summary';

describe('catalog-summary', () => {
  it('builds product and service summaries', () => {
    const value = buildCatalogFieldValue([
      {
        kind: 'PRODUCT',
        name: 'Widget',
        description: 'A useful widget',
        category: 'Hardware',
        priceAmount: '9.99',
        priceCurrency: 'USD',
      },
      { kind: 'SERVICE', name: 'Installation', description: 'On-site setup' },
    ]);
    expect(value.products?.items).toHaveLength(1);
    expect(value.products?.summary).toContain('Widget');
    expect(value.services?.summary).toContain('Installation');
  });

  it('regression: discovery rows yield catalog.products for extraction observations (T010)', () => {
    const value = buildCatalogFieldValue([
      { kind: 'PRODUCT', name: 'Alpha', description: 'one' },
      { kind: 'PRODUCT', name: 'Beta' },
    ]);
    expect(value.products?.items).toHaveLength(2);
    expect(value.products?.items.map((i) => i.name)).toEqual(['Alpha', 'Beta']);
    expect(value.products?.summary).toContain('Alpha');
  });
});
