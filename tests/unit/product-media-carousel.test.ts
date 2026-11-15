import { describe, expect, it } from 'vitest';
// The web app owns react/react-dom; resolve them from there so the component and the
// renderer share one React instance.
import * as React from '../../apps/web/node_modules/react';
import { renderToStaticMarkup } from '../../apps/web/node_modules/react-dom/server';
import type { GalleryItem } from '../../apps/web/src/lib/product-media';

// The root vitest config compiles TSX with the classic runtime, so expose React globally
// before loading the client components.
(globalThis as { React?: typeof React }).React = React;
const { ProductMediaCarousel } =
  await import('../../apps/web/src/components/brand/product-media-carousel');
const { LocaleContext } = await import('../../apps/web/src/lib/locale-context');
const { createElement } = React;

function items(n: number): GalleryItem[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `m${i}`,
    kind: 'image' as const,
    src: `/api/v1/media/m${i}/view`,
    streamUrl: null,
    role: i === 0 ? 'SCAN_THUMBNAIL' : 'SCAN_IMAGE',
    generated: false,
  }));
}

function render(list: GalleryItem[], locale: 'en' | 'ar' = 'en') {
  return renderToStaticMarkup(
    createElement(
      LocaleContext.Provider,
      { value: locale },
      createElement(ProductMediaCarousel, {
        items: list,
        label: 'Oud perfume',
        onOpen: () => undefined,
        testId: 'carousel',
      }),
    ),
  );
}

describe('ProductMediaCarousel (SSR markup)', () => {
  it('renders one slide per image with lazy loading after the first', () => {
    const html = render(items(4));
    expect(html.match(/<li[^>]*oma-media-carousel__slide/g)).toHaveLength(4);
    expect(html.match(/loading="eager"/g)).toHaveLength(1);
    expect(html.match(/loading="lazy"/g)).toHaveLength(3);
    expect(html).toContain('data-count="4"');
    expect(html).toContain('aria-roledescription="Media carousel"');
    expect(html).toContain('aria-label="Oud perfume"');
  });

  it('exposes arrows, dots and a counter only when there is more than one image', () => {
    const many = render(items(3));
    expect(many).toContain('aria-label="Next media"');
    expect(many).toContain('aria-label="Previous media"');
    expect(many.match(/oma-media-carousel__dot/g)?.length).toBeGreaterThanOrEqual(3);
    expect(many).toContain('1/3');
    expect(many).toMatch(/aria-current="true"/);
    // At the first slide "previous" is disabled.
    expect(many).toMatch(/oma-media-carousel__nav--prev"[^>]*disabled=""/);

    const single = render(items(1));
    expect(single).not.toContain('oma-media-carousel__nav');
    expect(single).not.toContain('oma-media-carousel__dot');
  });

  it('falls back to an honest placeholder when the product has no media', () => {
    const html = render([]);
    expect(html).toContain('oma-media-carousel--empty');
    expect(html).toContain('data-count="0"');
    expect(html).not.toContain('<img');
  });

  it('localizes labels in Arabic', () => {
    const html = render(items(2), 'ar');
    expect(html).toContain('الوسائط التالية');
    expect(html).toContain('1 من 2');
  });
});
