import { parse } from 'node-html-parser';
import { describe, expect, it } from 'vitest';
import {
  detectIgroupConfig,
  detectStorefrontPlatform,
  parseIgroupContent,
  parseShopifyProducts,
  parseWooStoreProducts,
} from './platform-catalog';
import { ProductCatalogAccumulator, productDedupeKey, productUrlKey } from './product-catalog';
import {
  detectPageProducts,
  isGenericLabel,
  isListingUrl,
  isProductDetailUrl,
  productsFromJsonLd,
} from './product-detection';
import {
  curateProductMedia,
  isNonProductMedia,
  maxProductMediaFromEnv,
  mediaIdentityKey,
  originalMediaUrl,
} from './product-media-url';
import {
  detectCurrency,
  htmlToPlainText,
  minorUnitsToAmount,
  normalizeAvailability,
  normalizePriceAmount,
  parsePriceText,
} from './product-values';

describe('product values', () => {
  it('normalizes prices including Arabic-Indic digits and separators', () => {
    expect(normalizePriceAmount('1,299.50')).toBe('1299.5');
    expect(normalizePriceAmount('١٢٠٫٥٠')).toBe('120.5');
    expect(normalizePriceAmount(55)).toBe('55');
    expect(normalizePriceAmount('free')).toBeUndefined();
    expect(minorUnitsToAmount('12990', 2)).toBe('129.9');
  });

  it('detects currency and parses price text', () => {
    expect(detectCurrency('₪55.00')).toBe('ILS');
    expect(detectCurrency('120 ر.س')).toBe('SAR');
    expect(parsePriceText('₪55.00')).toMatchObject({ amount: '55', currency: 'ILS' });
  });

  it('maps availability from schema.org, booleans and Arabic text', () => {
    expect(normalizeAvailability('https://schema.org/InStock')).toBe('InStock');
    expect(normalizeAvailability(false)).toBe('OutOfStock');
    expect(normalizeAvailability('متوفر')).toBe('InStock');
    expect(normalizeAvailability('غير متوفر')).toBe('OutOfStock');
  });

  it('turns HTML descriptions into plain text', () => {
    expect(htmlToPlainText('<p>Soft <b>cotton</b></p><p>Machine&nbsp;wash</p>')).toBe(
      'Soft cotton\nMachine wash',
    );
    expect(htmlToPlainText('   ')).toBeUndefined();
  });
});

describe('product media urls', () => {
  it('restores CDN originals and ignores resize params in identity', () => {
    expect(originalMediaUrl('https://cdn.shopify.com/s/files/shirt_200x200.jpg?v=1')).toBe(
      'https://cdn.shopify.com/s/files/shirt.jpg?v=1',
    );
    expect(originalMediaUrl('https://shop.test/wp-content/uploads/mug-300x300.jpg')).toBe(
      'https://shop.test/wp-content/uploads/mug.jpg',
    );
    expect(mediaIdentityKey('https://cdn.test/a.webp?w=200')).toBe(
      mediaIdentityKey('https://cdn.test/a.webp?width=1200'),
    );
  });

  it('rejects chrome imagery and tiny images', () => {
    expect(isNonProductMedia('https://shop.test/logo.png')).toBe(true);
    expect(isNonProductMedia('https://shop.test/icons/cart.svg')).toBe(true);
    expect(isNonProductMedia('https://shop.test/a.jpg', { width: 40, height: 40 })).toBe(true);
    expect(isNonProductMedia('https://shop.test/products/a.jpg')).toBe(false);
  });

  it('dedupes and caps media while keeping order', () => {
    const items = Array.from({ length: 30 }, (_, i) => ({
      kind: 'IMAGE' as const,
      url: `https://cdn.test/p/${i % 25}.jpg?w=${i}`,
    }));
    const out = curateProductMedia(items, { cap: 20 });
    expect(out).toHaveLength(20);
    expect(new Set(out.map((m) => mediaIdentityKey(m.url))).size).toBe(20);
    expect(out[0]!.url).toBe('https://cdn.test/p/0.jpg?w=0');
    expect(maxProductMediaFromEnv({ BRAND_MAX_PRODUCT_MEDIA: '500' })).toBe(50);
    expect(maxProductMediaFromEnv({})).toBe(20);
  });
});

describe('product detection', () => {
  it('classifies product detail vs listing urls', () => {
    expect(isProductDetailUrl('https://shop.test/ar/products/item-12')).toBe(true);
    expect(isProductDetailUrl('https://oud.test/en/-/p729697311')).toBe(true);
    expect(isProductDetailUrl('https://oud.test/en/0301020565-ramz-red-100-ml')).toBe(true);
    expect(isProductDetailUrl('https://shop.test/products')).toBe(false);
    expect(isProductDetailUrl('https://shop.test/index.php?route=x&product_id=9')).toBe(true);
    expect(isListingUrl('https://shop.test/collections/toys')).toBe(true);
    expect(isListingUrl('https://shop.test/ar/products?brand=books')).toBe(true);
  });

  it('rejects badge / generic labels as product names', () => {
    expect(isGenericLabel('مميز')).toBe(true);
    expect(isGenericLabel('New')).toBe(true);
    expect(isGenericLabel('Linen Shirt')).toBe(false);
  });

  it('reads @graph JSON-LD with offers arrays and ProductGroup variants', () => {
    const nodes = [
      {
        '@context': 'https://schema.org',
        '@graph': [
          { '@type': 'BreadcrumbList', itemListElement: [] },
          {
            '@type': 'Product',
            name: 'Linen Shirt',
            url: 'https://shop.test/products/linen-shirt',
            sku: 'LS-1',
            image: ['https://shop.test/img/ls-1.jpg', 'https://shop.test/img/ls-1.jpg'],
            offers: [
              { '@type': 'Offer', price: '89.00', priceCurrency: 'SAR' },
              { '@type': 'Offer', price: '79.00', priceCurrency: 'SAR', availability: 'InStock' },
            ],
          },
        ],
      },
      {
        '@type': 'ProductGroup',
        name: 'Mug',
        url: 'https://shop.test/products/mug',
        hasVariant: [
          { '@type': 'Product', offers: { price: 30, priceCurrency: 'USD' }, image: '/m1.jpg' },
          { '@type': 'Product', offers: { price: 25, priceCurrency: 'USD' }, image: '/m2.jpg' },
        ],
      },
    ];
    const out = productsFromJsonLd(nodes, 'https://shop.test/products/linen-shirt', 20);
    const shirt = out.find((p) => p.name === 'Linen Shirt')!;
    expect(shirt).toMatchObject({
      priceAmount: '79',
      priceCurrency: 'SAR',
      skuPublic: 'LS-1',
      extractionSource: 'JSON_LD',
    });
    expect(shirt.media).toHaveLength(1);
    const mug = out.find((p) => p.name === 'Mug')!;
    expect(mug.priceAmount).toBe('25');
    expect(mug.variantCount).toBe(2);
  });

  it('scopes microdata to its own itemscope and ignores related products', () => {
    const html = `<div itemscope itemtype="https://schema.org/Product">
        <h1 itemprop="name">Desk Lamp</h1>
        <img itemprop="image" src="https://shop.test/lamp.jpg" />
        <div itemprop="offers" itemscope itemtype="https://schema.org/Offer">
          <meta itemprop="price" content="45" /><meta itemprop="priceCurrency" content="EUR" />
        </div>
        <div itemprop="isRelatedTo" itemscope itemtype="https://schema.org/Product">
          <span itemprop="name">Bulb</span><img itemprop="image" src="https://shop.test/bulb.jpg" />
        </div>
      </div>`;
    const r = detectPageProducts({
      root: parse(html),
      pageUrl: 'https://shop.test/products/desk-lamp',
      jsonLdNodes: [],
    });
    expect(r.pageKind).toBe('PRODUCT_DETAIL');
    expect(r.products).toHaveLength(1);
    expect(r.products[0]).toMatchObject({ name: 'Desk Lamp', priceAmount: '45' });
    expect(r.products[0]!.media?.map((m) => m.url)).toEqual(['https://shop.test/lamp.jpg']);
  });

  it('collects multiple og:image tags for a product page', () => {
    const html = `<head>
      <meta property="og:type" content="product" />
      <meta property="og:title" content="Tote Bag" />
      <meta property="og:image" content="https://shop.test/tote-1.jpg" />
      <meta property="og:image" content="https://shop.test/tote-2.jpg" />
      <meta property="product:price:amount" content="19.90" />
      <meta property="product:price:currency" content="AED" />
    </head><body></body>`;
    const r = detectPageProducts({
      root: parse(html),
      pageUrl: 'https://shop.test/products/tote',
      jsonLdNodes: [],
    });
    expect(r.products[0]).toMatchObject({
      name: 'Tote Bag',
      priceAmount: '19.9',
      priceCurrency: 'AED',
      extractionSource: 'OPEN_GRAPH',
    });
    expect(r.products[0]!.media).toHaveLength(2);
  });
});

describe('product catalog', () => {
  it('builds locale/query-insensitive url keys', () => {
    expect(productUrlKey('https://www.shop.test/ar/products/Foo?variant=1')).toBe(
      'shop.test/product/foo',
    );
    expect(productUrlKey('https://shop.test/collections/x/products/foo')).toBe(
      'shop.test/product/foo',
    );
  });

  it('prefers platform id > url > sku > name for the dedupe key', () => {
    expect(productDedupeKey({ kind: 'PRODUCT', name: 'A', platformId: 'shopify:1' })).toBe(
      'pid:shopify:1',
    );
    expect(
      productDedupeKey({ kind: 'PRODUCT', name: 'A', sourceUrl: 'https://s.test/products/a' }),
    ).toBe('url:s.test/product/a');
    expect(productDedupeKey({ kind: 'PRODUCT', name: 'A', skuPublic: 'X1' })).toBe('sku:x1');
  });

  it('never merges records with different urls even when names match', () => {
    const acc = new ProductCatalogAccumulator();
    acc.add({
      kind: 'PRODUCT',
      name: 'Gift',
      sourceUrl: 'https://s.test/products/a',
      media: [{ kind: 'IMAGE', url: 'https://s.test/a.jpg' }],
    });
    acc.add({
      kind: 'PRODUCT',
      name: 'Gift',
      sourceUrl: 'https://s.test/products/b',
      media: [{ kind: 'IMAGE', url: 'https://s.test/b.jpg' }],
    });
    expect(acc.size).toBe(2);
    expect(acc.list().map((e) => e.product.media?.length)).toEqual([1, 1]);
  });

  it('respects the product cap', () => {
    const acc = new ProductCatalogAccumulator(2);
    for (const n of ['a', 'b', 'c']) {
      acc.add({ kind: 'PRODUCT', name: n, sourceUrl: `https://s.test/products/${n}` });
    }
    expect(acc.size).toBe(2);
  });
});

describe('platform adapters', () => {
  it('detects storefront platforms from HTML markers', () => {
    expect(
      detectStorefrontPlatform('<script src="https://cdn.shopify.com/x.js"></script>'),
    ).toMatchObject({ platform: 'shopify' });
    expect(
      detectStorefrontPlatform('<link href="/wp-content/plugins/woocommerce/style.css">'),
    ).toMatchObject({ platform: 'woocommerce' });
    expect(detectStorefrontPlatform('<script src="https://cdn.salla.network/x.js">')).toMatchObject(
      { platform: 'salla' },
    );
    expect(detectStorefrontPlatform('<a href="/en/-/c1037795821">catalog</a>')).toMatchObject({
      platform: 'igroup',
    });
    expect(detectStorefrontPlatform('<html></html>')).toBeNull();
  });

  it('reads iGroup storefront config from a bundle (https only)', () => {
    const js =
      'const e={VITE_IGROUP_API_URL:"https://api.example",VITE_IGROUP_COMPANY_ID:"c1",VITE_IGROUP_SITE_ID:"s1"}';
    expect(detectIgroupConfig(js)).toEqual({
      apiUrl: 'https://api.example',
      companyId: 'c1',
      siteId: 's1',
    });
    expect(detectIgroupConfig(js.replace('https', 'http'))).toBeNull();
  });

  it('refuses iGroup content for another tenant', () => {
    const json = { site: { id: 'other', companyId: 'c1' }, products: [{ id: '1', name: 'x' }] };
    expect(
      parseIgroupContent(json, {
        siteOrigin: 'https://s.test',
        locale: 'ar',
        expected: { apiUrl: 'https://api.example', companyId: 'c1', siteId: 's1' },
      }),
    ).toEqual([]);
  });

  it('parses Shopify products.json', () => {
    const json = {
      products: [
        {
          id: 7,
          title: 'Hoodie',
          handle: 'hoodie',
          body_html: '<p>Warm fleece</p>',
          vendor: 'Acme',
          product_type: 'Tops',
          tags: ['winter'],
          variants: [
            { price: '60.00', compare_at_price: '80.00', sku: 'H-S', available: true },
            { price: '65.00', sku: 'H-L', available: false },
          ],
          images: [
            { src: 'https://cdn.shopify.com/s/files/hoodie-2_400x.jpg', position: 2 },
            { src: 'https://cdn.shopify.com/s/files/hoodie-1.jpg', position: 1 },
          ],
        },
      ],
    };
    const [p] = parseShopifyProducts(json, 'https://s.test', { currency: 'USD' });
    expect(p).toMatchObject({
      name: 'Hoodie',
      description: 'Warm fleece',
      category: 'Tops',
      priceAmount: '60',
      compareAtPrice: '80',
      priceCurrency: 'USD',
      availability: 'InStock',
      sourceUrl: 'https://s.test/products/hoodie',
      platformId: 'shopify:7',
      variantCount: 2,
      extractionSource: 'PLATFORM_API',
    });
    expect(p!.media?.map((m) => m.url)).toEqual([
      'https://cdn.shopify.com/s/files/hoodie-1.jpg',
      'https://cdn.shopify.com/s/files/hoodie-2.jpg',
    ]);
  });

  it('parses WooCommerce Store API products', () => {
    const json = [
      {
        id: 12,
        name: 'Ceramic Mug',
        permalink: 'https://s.test/product/ceramic-mug/',
        sku: 'MUG-1',
        description: '<p>Hand made</p>',
        prices: {
          price: '4500',
          regular_price: '5000',
          currency_code: 'SAR',
          currency_minor_unit: 2,
        },
        is_in_stock: true,
        categories: [{ name: 'Kitchen' }],
        images: [{ src: 'https://s.test/wp-content/uploads/mug-300x300.jpg' }],
      },
    ];
    const [p] = parseWooStoreProducts(json, 'https://s.test');
    expect(p).toMatchObject({
      name: 'Ceramic Mug',
      priceAmount: '45',
      compareAtPrice: '50',
      priceCurrency: 'SAR',
      category: 'Kitchen',
      availability: 'InStock',
      platformId: 'woocommerce:12',
    });
    expect(p!.media?.[0]?.url).toBe('https://s.test/wp-content/uploads/mug.jpg');
  });
});
