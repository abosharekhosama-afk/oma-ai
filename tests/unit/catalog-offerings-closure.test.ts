import { describe, expect, it } from 'vitest';
import {
  buildCatalogSectionsFromDiscovery,
  catalogOfferingsFromDiscoveryRows,
  catalogOfferingsFromProfileSections,
} from '@oma/domain';

describe('catalog-offerings closure', () => {
  it('buildCatalogSectionsFromDiscovery includes product_id', () => {
    const sections = buildCatalogSectionsFromDiscovery([
      {
        id: 'prod-1',
        kind: 'PRODUCT',
        name: 'Widget',
        description: 'Nice',
        category: 'Gadgets',
        priceAmount: '10',
        priceCurrency: 'USD',
      },
      {
        id: 'svc-1',
        kind: 'SERVICE',
        name: 'Install',
      },
    ]);
    expect(sections.products).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'Widget', product_id: 'prod-1' })]),
    );
    const offerings = catalogOfferingsFromProfileSections({ catalog: sections });
    expect(offerings.length).toBe(2);
    expect(offerings[0].product_id).toBe('prod-1');
  });

  it('catalogOfferingsFromDiscoveryRows maps discovery rows', () => {
    const offerings = catalogOfferingsFromDiscoveryRows([
      {
        id: 'p2',
        kind: 'PRODUCT',
        name: 'Chair',
        priceAmount: '20',
        priceCurrency: 'SAR',
      },
    ]);
    expect(offerings).toHaveLength(1);
    expect(offerings[0]).toMatchObject({ name: 'Chair', product_id: 'p2', kind: 'product' });
  });
});