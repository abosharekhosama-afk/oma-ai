import { describe, expect, it } from 'vitest';
import {
  availabilityKey,
  availabilityTone,
  carouselKeyTarget,
  catalogStats,
  filterProducts,
  formatProductPrice,
  pendingGeneratedMedia,
  productGallery,
} from '../../apps/web/src/lib/product-media';
import type { CatalogProductMedia, DiscoveredProduct } from '../../apps/web/src/lib/brand-types';

function media(partial: Partial<CatalogProductMedia> & { id: string }): CatalogProductMedia {
  return {
    role: 'SCAN_IMAGE',
    review_status: 'APPROVED',
    source_url: null,
    sort_order: 0,
    mime: 'image/jpeg',
    name: `${partial.id}.jpg`,
    status: 'READY',
    view_url: `/api/v1/media/${partial.id}/view`,
    stream_url: null,
    ...partial,
  };
}

function product(partial: Partial<DiscoveredProduct> & { id: string }): DiscoveredProduct {
  return {
    kind: 'PRODUCT',
    name: partial.id,
    description: null,
    category: null,
    sku_public: null,
    price_amount: null,
    price_currency: null,
    availability: null,
    source_page_id: null,
    parent_product_id: null,
    media: [],
    ...partial,
  };
}

describe('productGallery', () => {
  it('returns every product image, thumbnail first, then crawl order', () => {
    const gallery = productGallery([
      media({ id: 'c', sort_order: 2 }),
      media({ id: 'a', sort_order: 1 }),
      media({ id: 'thumb', role: 'SCAN_THUMBNAIL', sort_order: 5 }),
      media({ id: 'b', sort_order: 1, role: 'SCAN_VIDEO', mime: 'video/mp4', stream_url: '/s/b' }),
    ]);
    expect(gallery.map((g) => g.id)).toEqual(['thumb', 'a', 'b', 'c']);
    expect(gallery.find((g) => g.id === 'b')).toMatchObject({ kind: 'video', src: '/s/b' });
  });

  it('shows the same WorkDrive asset once even when linked under two roles', () => {
    const gallery = productGallery([
      media({ id: 'l1', role: 'SCAN_THUMBNAIL', view_url: '/api/v1/media/A/view' }),
      media({ id: 'l2', role: 'SCAN_IMAGE', view_url: '/api/v1/media/A/view', sort_order: 1 }),
      media({ id: 'l3', role: 'SCAN_IMAGE', view_url: '/api/v1/media/B/view', sort_order: 2 }),
    ]);
    expect(gallery.map((g) => g.id)).toEqual(['l1', 'l3']);
  });

  it('hides rejected, pending-generated, missing and non-media files; keeps approved generated last', () => {
    const gallery = productGallery([
      media({ id: 'gen-ok', role: 'GENERATED_IMAGE', review_status: 'APPROVED', sort_order: 0 }),
      media({ id: 'gen-pending', role: 'GENERATED_IMAGE', review_status: 'PENDING' }),
      media({ id: 'rejected', review_status: 'REJECTED' }),
      media({ id: 'missing', status: 'MISSING' }),
      media({ id: 'pdf', mime: 'application/pdf' }),
      media({ id: 'scan', sort_order: 9 }),
    ]);
    expect(gallery.map((g) => g.id)).toEqual(['scan', 'gen-ok']);
    expect(gallery[1]!.generated).toBe(true);
  });

  it('handles missing media arrays', () => {
    expect(productGallery(undefined)).toEqual([]);
    expect(productGallery(null)).toEqual([]);
  });

  it('lists generated media waiting for review', () => {
    const pending = pendingGeneratedMedia([
      media({ id: 'g1', role: 'GENERATED_VIDEO', review_status: 'PENDING', mime: 'video/mp4' }),
      media({ id: 's1', review_status: 'PENDING' }),
    ]);
    expect(pending.map((m) => m.id)).toEqual(['g1']);
  });
});

describe('availability + price formatting', () => {
  it('maps schema.org availability URLs and plain values', () => {
    expect(availabilityKey('https://schema.org/InStock')).toBe(
      'brand.discovery.availabilityValue.inStock',
    );
    expect(availabilityKey('OutOfStock')).toBe('brand.discovery.availabilityValue.outOfStock');
    expect(availabilityKey('pre_order')).toBe('brand.discovery.availabilityValue.preOrder');
    expect(availabilityKey('Ships in 3 days')).toBeNull();
    expect(availabilityKey(null)).toBeNull();
    expect(availabilityTone('http://schema.org/InStock')).toBe('success');
    expect(availabilityTone('SoldOut')).toBe('danger');
    expect(availabilityTone('BackOrder')).toBe('warning');
    expect(availabilityTone('custom')).toBe('neutral');
  });

  it('formats ISO currencies per locale and falls back to raw text', () => {
    expect(formatProductPrice('120', 'USD', 'en')).toBe('$120');
    expect(formatProductPrice('19.5', 'usd', 'en')).toBe('$19.50');
    expect(formatProductPrice('99', 'SAR', 'ar')).toMatch(/٩٩|99/);
    expect(formatProductPrice('from 10', 'EUR', 'en')).toBe('from 10 EUR');
    expect(formatProductPrice('10', null, 'en')).toBe('10');
    expect(formatProductPrice(null, 'USD', 'en')).toBeNull();
    expect(formatProductPrice('  ', 'USD', 'en')).toBeNull();
  });
});

describe('carouselKeyTarget', () => {
  it('moves in the direction the arrow points (LTR)', () => {
    expect(carouselKeyTarget('ArrowRight', 0, 3, 'ltr')).toBe(1);
    expect(carouselKeyTarget('ArrowLeft', 1, 3, 'ltr')).toBe(0);
    expect(carouselKeyTarget('ArrowRight', 2, 3, 'ltr')).toBe(2);
    expect(carouselKeyTarget('ArrowLeft', 0, 3, 'ltr')).toBe(0);
  });

  it('mirrors arrows in RTL', () => {
    expect(carouselKeyTarget('ArrowLeft', 0, 3, 'rtl')).toBe(1);
    expect(carouselKeyTarget('ArrowRight', 1, 3, 'rtl')).toBe(0);
  });

  it('supports Home/End and ignores other keys or empty carousels', () => {
    expect(carouselKeyTarget('Home', 2, 4, 'ltr')).toBe(0);
    expect(carouselKeyTarget('End', 0, 4, 'rtl')).toBe(3);
    expect(carouselKeyTarget('Enter', 0, 4, 'ltr')).toBeNull();
    expect(carouselKeyTarget('ArrowRight', 0, 0, 'ltr')).toBeNull();
  });
});

describe('filterProducts + catalogStats', () => {
  const list = [
    product({
      id: 'p1',
      name: 'Oud perfume',
      category: 'Fragrance',
      media: [media({ id: 'm1' }), media({ id: 'm2', sort_order: 1 })],
    }),
    product({ id: 's1', kind: 'SERVICE', name: 'Gift wrapping', description: 'Premium wrap' }),
    product({
      id: 'p2',
      name: 'Candle',
      sku_public: 'CND-01',
      media: [media({ id: 'g', role: 'GENERATED_IMAGE', review_status: 'PENDING' })],
    }),
  ];

  it('filters by query across name/description/category/SKU, kind and media', () => {
    expect(filterProducts(list, { query: 'fragr', kind: '', withMediaOnly: false })).toHaveLength(
      1,
    );
    expect(filterProducts(list, { query: 'cnd-01', kind: '', withMediaOnly: false })[0]!.id).toBe(
      'p2',
    );
    expect(filterProducts(list, { query: '', kind: 'SERVICE', withMediaOnly: false })).toHaveLength(
      1,
    );
    expect(
      filterProducts(list, { query: '', kind: '', withMediaOnly: true }).map((p) => p.id),
    ).toEqual(['p1']);
  });

  it('counts products, services, media coverage and pending reviews from real data', () => {
    expect(catalogStats(list)).toEqual({
      total: 3,
      products: 2,
      services: 1,
      withMedia: 1,
      mediaTotal: 2,
      pendingReview: 1,
    });
  });
});
