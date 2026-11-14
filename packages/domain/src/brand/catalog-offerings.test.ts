import { describe, expect, it } from 'vitest';
import {
  catalogOfferingsFromDiscoveryRows,
  catalogOfferingsFromProfileSections,
  estimateCatalogContentRequests,
} from './catalog-offerings';

describe('catalogOfferingsFromProfileSections', () => {
  it('parses catalog.items from approved profile sections', () => {
    const offerings = catalogOfferingsFromProfileSections({
      catalog: {
        products: {
          summary: 'Widget; Gadget',
          items: [{ name: 'Widget', category: 'Hardware' }],
        },
        services: {
          items: [{ name: 'Consulting' }],
        },
      },
    });
    expect(offerings).toHaveLength(2);
    expect(offerings[0]?.kind).toBe('product');
    expect(offerings[0]?.slug).toBe('widget');
  });
});

describe('estimateCatalogContentRequests', () => {
  it('caps organic and paid catalog request estimates', () => {
    const rows = catalogOfferingsFromDiscoveryRows(
      Array.from({ length: 20 }).map((_, index) => ({
        kind: 'PRODUCT' as const,
        name: `Product ${index}`,
      })),
    );
    expect(estimateCatalogContentRequests(rows, { organicEnabled: true, paidEnabled: false })).toBe(
      8,
    );
    expect(estimateCatalogContentRequests(rows, { organicEnabled: false, paidEnabled: true })).toBe(
      3,
    );
  });
});