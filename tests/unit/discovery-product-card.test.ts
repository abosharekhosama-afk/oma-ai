import { describe, expect, it, vi } from 'vitest';
// Resolve React from the web app so the component and the renderer share one instance.
import * as React from '../../apps/web/node_modules/react';
import { renderToStaticMarkup } from '../../apps/web/node_modules/react-dom/server';
import type { DiscoveredProduct } from '../../apps/web/src/lib/brand-types';

(globalThis as { React?: typeof React }).React = React;

// The design-system controls (antd-backed) are out of scope here: stub them with plain markup.
vi.mock('@oma/ui/controls', async () => {
  const R = await import('../../apps/web/node_modules/react');
  const passthrough =
    (tag: string) =>
    ({ children, label }: { children?: React.ReactNode; label?: React.ReactNode }) =>
      R.createElement(tag, null, children ?? label ?? null);
  return {
    Button: passthrough('button'),
    SelectField: passthrough('select'),
    Tag: passthrough('span'),
  };
});
const { DiscoveryProductCard } =
  await import('../../apps/web/src/components/brand/discovery-product-card');
const { LocaleContext } = await import('../../apps/web/src/lib/locale-context');
const { needsLetterbox } = await import('../../apps/web/src/lib/product-media');
const { createElement } = React;

function product(over: Partial<DiscoveredProduct> = {}): DiscoveredProduct {
  return {
    id: 'p1',
    kind: 'PRODUCT',
    name: 'كتاب الأصوات التفاعلي',
    description: null,
    category: 'كتب تفاعلية › صوت',
    sku_public: 'toy-src-101',
    price_amount: '55',
    price_currency: 'ILS',
    availability: 'InStock',
    source_page_id: null,
    parent_product_id: null,
    compare_at_price: '70',
    attributes: [
      { label: 'brand', value: 'TOY BOOKS' },
      { label: 'العمر', value: '3-5 سنوات' },
    ],
    extraction_source: 'PLATFORM_API',
    confidence: 0.97,
    media: [],
    ...over,
  };
}

function render(p: DiscoveredProduct, locale: 'en' | 'ar' = 'ar') {
  return renderToStaticMarkup(
    createElement(
      LocaleContext.Provider,
      { value: locale },
      createElement(DiscoveryProductCard, {
        brandId: 'b1',
        product: p,
        profileApproved: false,
        onEvidence: () => undefined,
        onUpdated: () => undefined,
      }),
    ),
  );
}

describe('DiscoveryProductCard (SSR markup)', () => {
  it('shows price, struck compare-at price, attributes and the extraction source', () => {
    const html = render(product());
    expect(html).toMatch(/oma-discovery-product-card__price[^>]*>[^<]*55/);
    expect(html).toMatch(/<s [^>]*oma-discovery-product-card__compare[^>]*>[^<]*70/);
    expect(html).toContain('data-testid="product-attributes"');
    expect(html).toContain('TOY BOOKS');
    expect(html).toContain('3-5 سنوات');
    expect(html).toContain('العلامة'); // "brand" label localized
    expect(html).toContain('كتالوج المتجر');
    expect(html).toContain('97%');
    // Attributes stand in for a missing description, so no "no description" line.
    expect(html).not.toContain('oma-muted oma-discovery-product-card__description');
  });

  it('uses the compact placeholder when the product has no media', () => {
    const html = render(product({ attributes: [], compare_at_price: null }));
    expect(html).toContain('oma-media-carousel--empty');
    expect(html).toContain('oma-media-carousel__placeholder--compact');
    expect(html).not.toContain('<s ');
    expect(html).toContain('oma-discovery-product-card__description');
  });

  it('flags extreme aspect ratios for letterboxing only', () => {
    expect(needsLetterbox(1000, 1000)).toBe(false);
    expect(needsLetterbox(1200, 900)).toBe(false);
    expect(needsLetterbox(400, 1200)).toBe(true);
    expect(needsLetterbox(2000, 600)).toBe(true);
    expect(needsLetterbox(0, 0)).toBe(false);
  });
});
